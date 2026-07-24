import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function mapProfile(row, deviceCounts) {
  return {
    id: row.id,
    role: row.role,
    username: row.username,
    name: row.full_name || row.username,
    label: row.role === "admin" ? "Owner · Admin" : "Employee Dashboard",
    activeDevices: deviceCounts[row.id] || 0,
    contactEmail: row.contact_email || "",
  };
}

// Every privileged account operation (reset/create/delete) goes through the
// same admin-reset-credentials Edge Function — the only place in this app
// that touches the service-role key, so it can never run from the browser.
async function invokeAccountFn(body) {
  const { data, error: fnError } = await supabase.functions.invoke("admin-reset-credentials", { body });
  if (fnError) {
    let message = fnError.message || "That didn't work.";
    try {
      const errBody = await fnError.context?.json?.();
      if (errBody?.error) message = errBody.error;
    } catch {
      // fall back to fnError.message
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// Lists this store's accounts and lets an admin reset/create/delete an
// account through the Edge Function above. Also surfaces each account's
// active device count and lets an admin force-logout every device on an
// account (a plain update, permitted by device_sessions' admin-or-owner RLS
// policy — no Edge Function needed for that one).
export function useAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select("id, role, username, full_name, contact_email")
      .order("role", { ascending: true });
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    // Best-effort — if device_sessions isn't there yet (migration not run),
    // the accounts list still renders, just without device counts.
    const deviceCounts = {};
    const { data: sessionRows } = await supabase.from("device_sessions").select("user_id").eq("revoked", false);
    (sessionRows || []).forEach((row) => {
      deviceCounts[row.user_id] = (deviceCounts[row.user_id] || 0) + 1;
    });

    setError(null);
    setAccounts(data.map((row) => mapProfile(row, deviceCounts)));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const resetCredentials = useCallback(
    async (targetRole, { username, pin }) => {
      const data = await invokeAccountFn({ action: "reset", target_role: targetRole, username, pin });
      await refresh();
      return data;
    },
    [refresh]
  );

  // Only succeeds if that role currently has no account (this app is built
  // around exactly one admin + one staff) — enforced server-side too.
  const createAccount = useCallback(
    async (targetRole, { username, pin }) => {
      const data = await invokeAccountFn({ action: "create", target_role: targetRole, username, pin });
      await refresh();
      return data;
    },
    [refresh]
  );

  // Blocked server-side from deleting the caller's own account, so an admin
  // can never lock themselves out with this button.
  const deleteAccount = useCallback(
    async (targetRole) => {
      const data = await invokeAccountFn({ action: "delete", target_role: targetRole });
      await refresh();
      return data;
    },
    [refresh]
  );

  const forceLogoutAccount = useCallback(
    async (profileId) => {
      const { error: updateError } = await supabase
        .from("device_sessions")
        .update({ revoked: true, revoked_at: new Date().toISOString() })
        .eq("user_id", profileId)
        .eq("revoked", false);
      if (updateError) throw new Error(updateError.message || "Couldn't force logout that account.");
      await refresh();
    },
    [refresh]
  );

  // Reference-only — never used for login. update_contact_email() can only
  // ever touch this one column (see migration 0005), so this can't be used
  // to smuggle a role/username change through.
  const updateContactEmail = useCallback(
    async (profileId, email) => {
      const { error: rpcError } = await supabase.rpc("update_contact_email", {
        p_profile_id: profileId,
        p_contact_email: email,
      });
      if (rpcError) throw new Error(rpcError.message || "Couldn't save that email.");
      await refresh();
    },
    [refresh]
  );

  return {
    accounts,
    loading,
    error,
    refresh,
    resetCredentials,
    createAccount,
    deleteAccount,
    forceLogoutAccount,
    updateContactEmail,
  };
}
