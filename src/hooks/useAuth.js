import { useCallback, useEffect, useState } from "react";
import { supabase, usernameToEmail } from "../lib/supabaseClient";

const DEVICE_SESSION_KEY = "nx-device-session-id";

// Best-effort "Chrome on Windows"-style label so an admin can tell devices
// apart in the Accounts screen — not a fingerprint, just a hint.
function guessDeviceLabel() {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent;

  let browser = "Browser";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Chrome/") && !ua.includes("Chromium")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";

  let os = "device";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS X")) os = "Mac";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return `${browser} on ${os}`;
}

// Wraps a real Supabase Auth session + the matching `profiles` row (which
// carries the username/full name/role the UI actually renders). Replaces
// the old client-side `accounts.find(...)` lookup with a real hashed-
// password login and a persisted, auto-refreshing session.
export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [deviceSessionId, setDeviceSessionId] = useState(() =>
    typeof window !== "undefined" ? window.localStorage.getItem(DEVICE_SESSION_KEY) : null
  );

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return null;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, role")
      .eq("id", userId)
      .single();
    if (error) {
      console.error("Failed to load profile:", error.message);
      setProfile(null);
      return null;
    }
    setProfile(data);
    return data;
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      loadProfile(data.session?.user?.id).finally(() => {
        if (active) setInitializing(false);
      });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      loadProfile(nextSession?.user?.id);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (username, pin) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(username),
        password: pin,
      });
      if (error) {
        throw new Error("That username and PIN don't match an account.");
      }
      const nextProfile = await loadProfile(data.user.id);
      if (!nextProfile) {
        throw new Error("Signed in, but couldn't load your account profile.");
      }

      // Registers this browser as a new device session and evicts the oldest
      // session(s) beyond this role's device limit (2 for admin, 3 for
      // staff). Only ever called here, on a real credential sign-in — never
      // on page reload/token refresh, or every reload would count as a new
      // device and evict a still-in-use one.
      const { data: newSessionId, error: sessionError } = await supabase.rpc("register_device_session", {
        p_device_label: guessDeviceLabel(),
      });
      if (sessionError) {
        // Device-session tracking is a safety net, not the login itself —
        // don't block sign-in over it (e.g. migration not applied yet).
        console.error("Failed to register device session:", sessionError.message);
      } else {
        setDeviceSessionId(newSessionId);
        window.localStorage.setItem(DEVICE_SESSION_KEY, newSessionId);
      }

      return nextProfile;
    },
    [loadProfile]
  );

  const signOut = useCallback(async () => {
    if (deviceSessionId) {
      // Best-effort — keeps the admin's device list accurate immediately
      // instead of waiting for a future login to evict this row. Must run
      // before auth.signOut() since the RLS check needs the still-live
      // session's auth.uid().
      await supabase
        .from("device_sessions")
        .update({ revoked: true, revoked_at: new Date().toISOString() })
        .eq("id", deviceSessionId);
    }
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setDeviceSessionId(null);
    window.localStorage.removeItem(DEVICE_SESSION_KEY);
  }, [deviceSessionId]);

  return {
    session,
    profile,
    initializing,
    isAuthenticated: Boolean(session && profile),
    deviceSessionId,
    signIn,
    signOut,
  };
}
