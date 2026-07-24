import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const PAGE_SIZE = 25;
const SELECT = "*, order_items(*), created_by:profiles(username, full_name)";

function mapOrder(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    label: `Order ${row.order_number}`,
    total: Number(row.total),
    method: row.payment_method,
    createdAt: row.created_at,
    createdBy: row.created_by?.full_name || row.created_by?.username || null,
    items: (row.order_items || []).map((it) => ({
      name: it.name,
      category: it.category,
      price: Number(it.price),
      qty: Number(it.qty),
      emoji: it.emoji,
    })),
  };
}

// All-time order history for the admin-only Sales History tab — distinct
// from the aggregated Reports charts and from TodayTab's today-only view.
// Newest first, cursor-paginated on (created_at, id) rather than
// LIMIT/OFFSET, since offset pagination silently skips or duplicates rows
// once realtime inserts start shifting row positions underneath it.
// Subscribes to new order INSERTs so the tab updates live while open.
export function useSalesHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const cursorRef = useRef(null);
  const pagedRef = useRef(false);

  const fetchPage = useCallback((cursor) => {
    let query = supabase
      .from("orders")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE);
    if (cursor) {
      query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
    }
    return query;
  }, []);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchError } = await fetchPage(null);
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setError(null);
      setOrders(data.map(mapOrder));
      setHasMore(data.length === PAGE_SIZE);
      cursorRef.current = data.length
        ? { createdAt: data[data.length - 1].created_at, id: data[data.length - 1].id }
        : null;
      pagedRef.current = false;
      setNewCount(0);
    }
    setLoading(false);
  }, [fetchPage]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !cursorRef.current) return;
    setLoadingMore(true);
    const { data, error: fetchError } = await fetchPage(cursorRef.current);
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setOrders((prev) => [...prev, ...data.map(mapOrder)]);
      setHasMore(data.length === PAGE_SIZE);
      if (data.length) {
        cursorRef.current = { createdAt: data[data.length - 1].created_at, id: data[data.length - 1].id };
      }
      pagedRef.current = true;
    }
    setLoadingMore(false);
  }, [fetchPage, hasMore, loadingMore]);

  useEffect(() => {
    const channel = supabase
      .channel("sales-history-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => {
        // Realtime payload only carries `orders` columns, not the
        // order_items/profiles join — so re-run the real query rather than
        // try to reconstruct the row from the event. If the admin has
        // already paged further back, surface a pill instead of yanking
        // their scroll position underneath them.
        if (pagedRef.current) {
          setNewCount((n) => n + 1);
        } else {
          loadFirstPage();
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadFirstPage]);

  // Same void_order() RPC the staff Today tab uses — reverses every
  // recipe-driven inventory deduction the order made, then deletes it,
  // atomically. Removed from local state directly rather than refetching,
  // so it doesn't reset the admin's scroll position/loaded pages.
  const removeOrder = useCallback(async (id) => {
    const { error: rpcError } = await supabase.rpc("void_order", { p_order_id: id });
    if (rpcError) throw rpcError;
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }, []);

  return { orders, loading, loadingMore, error, hasMore, newCount, loadMore, refresh: loadFirstPage, removeOrder };
}
