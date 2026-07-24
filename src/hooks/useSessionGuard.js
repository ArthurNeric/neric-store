import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

const IDLE_LIMIT_MS = 60 * 60 * 1000; // 1 hour
const IDLE_CHECK_INTERVAL_MS = 30 * 1000;
const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "touchstart", "scroll"];

// Two independent guards bundled under one mount point (App.jsx):
//   1. Idle timeout — signs out after an hour with no mouse/keyboard/touch
//      activity. No backend dependency.
//   2. Device-revocation watcher — once `deviceSessionId` exists (set by
//      useAuth after a real sign-in, via the register_device_session RPC),
//      watches this browser's own device_sessions row and signs out the
//      instant it's revoked (over the per-role device limit, or an admin's
//      "force logout"). Realtime-first, with a heartbeat poll fallback for
//      networks where the websocket can't connect. No-ops until a
//      deviceSessionId is supplied, so this is safe to mount before the
//      device_sessions migration exists.
export function useSessionGuard({ enabled, deviceSessionId, onExpire }) {
  const lastActivityRef = useRef(Date.now());
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!enabled) return;
    const markActive = () => {
      lastActivityRef.current = Date.now();
    };
    lastActivityRef.current = Date.now();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }));

    const idleTimer = setInterval(() => {
      if (Date.now() - lastActivityRef.current > IDLE_LIMIT_MS) {
        onExpireRef.current?.("idle");
      }
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActive));
      clearInterval(idleTimer);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !deviceSessionId) return;

    const heartbeat = async () => {
      const { data, error } = await supabase
        .from("device_sessions")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", deviceSessionId)
        .select("revoked")
        .single();
      if (!error && data?.revoked) onExpireRef.current?.("revoked");
    };
    heartbeat();
    const heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);

    const channel = supabase
      .channel(`device-session-${deviceSessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "device_sessions", filter: `id=eq.${deviceSessionId}` },
        (payload) => {
          if (payload.new?.revoked) onExpireRef.current?.("revoked");
        }
      )
      .subscribe();

    return () => {
      clearInterval(heartbeatTimer);
      supabase.removeChannel(channel);
    };
  }, [enabled, deviceSessionId]);
}
