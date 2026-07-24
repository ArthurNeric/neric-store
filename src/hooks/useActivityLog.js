import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function mapEntry(row) {
  return {
    id: row.id,
    entityType: row.entity_type,
    name: row.entity_name,
    emoji: row.entity_emoji,
    action: row.action,
    actor: row.actor?.full_name || row.actor?.username || null,
    when: new Date(row.created_at),
  };
}

// Admin-only feed of every new Menu/Inventory item created in the last 7
// days — a rolling window enforced by filtering the query (not a cron
// deletion job; see the migration's comments for why). RLS on activity_log
// also restricts reads to the admin role server-side, so this is defense in
// depth, not the only gate keeping staff out.
export function useActivityLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const cutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
    const { data, error: fetchError } = await supabase
      .from("activity_log")
      .select("*, actor:profiles(username, full_name)")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setError(null);
      setEntries(data.map(mapEntry));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entries, loading, error, refresh };
}
