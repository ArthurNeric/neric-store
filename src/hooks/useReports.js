import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Real replacement for the old hardcoded `Sj[range]` object — calls the
// report_summary(p_range) Postgres function, which computes revenue,
// orders, deltas, the chart series, and top sellers live from real
// orders/order_items rows.
export function useReports(range) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("report_summary", { p_range: range });
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setError(null);
      setSummary(data);
    }
    setLoading(false);
  }, [range]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { summary, loading, error, refresh };
}
