import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function mapItem(row) {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    qty: Number(row.qty),
    cost: Number(row.cost),
    emoji: row.emoji,
  };
}

function mapTransaction(row) {
  return {
    id: row.id,
    name: row.item_name,
    emoji: row.emoji,
    qty: Number(row.qty_delta),
    unit: row.unit,
    reason: row.reason,
    when: new Date(row.created_at),
  };
}

// Real stock levels + an append-only add-history log. `addStock` calls the
// add_inventory_stock RPC so the qty bump and history row are atomic — two
// people restocking the same item at once can't clobber each other.
export function useInventory() {
  const [stock, setStock] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [itemsRes, txRes] = await Promise.all([
      supabase.from("inventory_items").select("*").order("name", { ascending: true }),
      supabase
        .from("inventory_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (itemsRes.error || txRes.error) {
      setError(itemsRes.error?.message || txRes.error?.message);
    } else {
      setError(null);
      setStock(itemsRes.data.map(mapItem));
      setHistory(txRes.data.map(mapTransaction));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addStock = useCallback(
    async (itemId, qtyToAdd) => {
      const { error: rpcError } = await supabase.rpc("add_inventory_stock", {
        p_item_id: itemId,
        p_qty: qtyToAdd,
      });
      if (rpcError) throw rpcError;
      await refresh();
    },
    [refresh]
  );

  const createItem = useCallback(
    async (newItem) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error: insertError } = await supabase
        .from("inventory_items")
        .insert({
          name: newItem.name,
          unit: newItem.unit,
          qty: newItem.qty,
          cost: newItem.cost,
          emoji: newItem.emoji,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      if (newItem.qty > 0) {
        const { error: txError } = await supabase.from("inventory_transactions").insert({
          item_id: data.id,
          item_name: data.name,
          emoji: data.emoji,
          unit: data.unit,
          qty_delta: newItem.qty,
          reason: "restock",
          created_by: userData.user?.id ?? null,
        });
        if (txError) throw txError;
      }
      await refresh();
    },
    [refresh]
  );

  const deleteItem = useCallback(
    async (id) => {
      const { error: deleteError } = await supabase.from("inventory_items").delete().eq("id", id);
      if (deleteError) throw deleteError;
      await refresh();
    },
    [refresh]
  );

  // Edits name/unit/cost, and — since changing the unit (e.g. kg -> g)
  // changes what the stored qty number even means — optionally corrects qty
  // too, logging the difference as a normal stock-activity row so the
  // history stays complete (qty never changes silently).
  const updateItem = useCallback(
    async (id, updates) => {
      const current = stock.find((s) => s.id === id);
      const { data: userData } = await supabase.auth.getUser();

      const { error: updateError } = await supabase
        .from("inventory_items")
        .update({ name: updates.name, unit: updates.unit, cost: updates.cost })
        .eq("id", id);
      if (updateError) throw updateError;

      const nextQty = Number(updates.qty);
      const delta = current ? nextQty - current.qty : 0;
      if (Math.abs(delta) > 1e-9) {
        const { error: qtyError } = await supabase.from("inventory_items").update({ qty: nextQty }).eq("id", id);
        if (qtyError) throw qtyError;
        const { error: txError } = await supabase.from("inventory_transactions").insert({
          item_id: id,
          item_name: updates.name,
          emoji: current?.emoji,
          unit: updates.unit,
          qty_delta: delta,
          reason: "restock",
          created_by: userData.user?.id ?? null,
        });
        if (txError) throw txError;
      }
      await refresh();
    },
    [refresh, stock]
  );

  return { stock, history, loading, error, refresh, addStock, createItem, updateItem, deleteItem };
}
