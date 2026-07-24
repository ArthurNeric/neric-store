import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Asia/Manila has no DST, so "today" can be expressed as a fixed +08:00
// offset ISO string — no timezone library needed.
function todayStartIsoForManila() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${d}T00:00:00+08:00`;
}

function mapOrder(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    label: `Order ${row.order_number}`,
    total: Number(row.total),
    method: row.payment_method,
    time: new Date(row.created_at).toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit",
    }),
    createdAt: row.created_at,
    items: (row.order_items || []).map((it) => ({
      name: it.name,
      category: it.category,
      price: Number(it.price),
      qty: Number(it.qty),
      emoji: it.emoji,
    })),
  };
}

// Today's orders + checkout. Checkout always goes through the create_order
// RPC so order numbering and totals are computed atomically server-side —
// the client's cart total is never trusted directly.
export function useOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextOrderNumber, setNextOrderNumber] = useState(1);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .gte("created_at", todayStartIsoForManila())
      .order("created_at", { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setError(null);
      setOrders(data.map(mapOrder));
      const highest = data.reduce((max, row) => Math.max(max, row.order_number), 0);
      setNextOrderNumber(highest + 1);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const checkout = useCallback(
    async (cartItems, paymentMethod) => {
      const payloadItems = cartItems.map((it) => ({
        product_id: it.id ?? null,
        name: it.name,
        category: it.category,
        price: it.price,
        cost: it.cost ?? 0,
        qty: it.qty,
        emoji: it.emoji,
      }));
      const { data, error: rpcError } = await supabase.rpc("create_order", {
        p_payment_method: paymentMethod,
        p_items: payloadItems,
      });
      if (rpcError) throw rpcError;
      await refresh();
      return data; // { id, order_number, total, payment_method, created_at }
    },
    [refresh]
  );

  const removeOrder = useCallback(
    async (id) => {
      // void_order() reverses every recipe-driven inventory deduction the
      // order made, then deletes it — both atomically, so a mistaken sale
      // can be undone as if it never happened. Direct delete on orders is
      // no longer permitted (see migration 0003), this RPC is the only path.
      const { error: rpcError } = await supabase.rpc("void_order", { p_order_id: id });
      if (rpcError) throw rpcError;
      await refresh();
    },
    [refresh]
  );

  return { orders, loading, error, nextOrderNumber, refresh, checkout, removeOrder };
}
