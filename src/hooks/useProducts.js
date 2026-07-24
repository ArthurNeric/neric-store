import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    cost: Number(row.cost),
    emoji: row.emoji,
    img: row.image_url,
    fav: row.is_favorite,
  };
}

function mapRecipeRow(row) {
  return {
    inventoryItemId: row.inventory_item_id,
    qtyPerUnit: Number(row.qty_per_unit),
    name: row.inventory_item?.name,
    unit: row.inventory_item?.unit,
    emoji: row.inventory_item?.emoji,
  };
}

// Real CRUD (+ Storage-backed photo upload) for the product catalog.
// Replaces the old `useState([...8 hardcoded items])` in the bundle. Also
// carries each product's recipe (the inventory ingredients it consumes per
// sale, deducted atomically inside create_order() — see useOrders.checkout).
export function useProducts() {
  const [products, setProducts] = useState([]);
  const [recipes, setRecipes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [productsRes, recipesRes] = await Promise.all([
      supabase.from("products").select("*").eq("is_active", true).order("created_at", { ascending: true }),
      supabase.from("product_recipes").select("*, inventory_item:inventory_items(name, unit, emoji)"),
    ]);
    if (productsRes.error) {
      setError(productsRes.error.message);
    } else {
      setError(null);
      setProducts(productsRes.data.map(mapRow));
      const byProduct = {};
      (recipesRes.data || []).forEach((row) => {
        (byProduct[row.product_id] ||= []).push(mapRecipeRow(row));
      });
      setRecipes(byProduct);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const uploadImage = useCallback(async (file) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  }, []);

  const saveProduct = useCallback(
    async (item) => {
      const payload = {
        name: item.name,
        category: item.category,
        price: item.price,
        cost: item.cost,
        emoji: item.emoji,
        image_url: item.img ?? null,
        is_favorite: item.fav,
      };
      let productId = item.id;
      if (productId) {
        const { error: updateError } = await supabase.from("products").update(payload).eq("id", productId);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase.from("products").insert(payload).select("id").single();
        if (insertError) throw insertError;
        productId = data.id;
      }
      await refresh();
      return productId;
    },
    [refresh]
  );

  // Atomic replace-all for one product's recipe rows — see
  // save_product_recipe() in migrations/0003_product_recipes.sql. `rows` is
  // [{ inventoryItemId, qtyPerUnit }], each qty already expressed in that
  // ingredient's own inventory unit (no conversion attempted).
  const saveRecipe = useCallback(
    async (productId, rows) => {
      const payload = (rows || [])
        .filter((r) => r.inventoryItemId && Number(r.qtyPerUnit) > 0)
        .map((r) => ({ inventory_item_id: r.inventoryItemId, qty_per_unit: Number(r.qtyPerUnit) }));
      const { error: rpcError } = await supabase.rpc("save_product_recipe", {
        p_product_id: productId,
        p_recipe: payload,
      });
      if (rpcError) throw rpcError;
      await refresh();
    },
    [refresh]
  );

  const deleteProduct = useCallback(
    async (id) => {
      const { error: deleteError } = await supabase.from("products").delete().eq("id", id);
      if (deleteError) throw deleteError;
      await refresh();
    },
    [refresh]
  );

  return { products, recipes, loading, error, refresh, saveProduct, saveRecipe, deleteProduct, uploadImage };
}
