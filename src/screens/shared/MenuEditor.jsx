import { useState } from "react";
import { Camera, Check, Package, Plus, Trash2, X } from "lucide-react";
import Card from "../../components/Card";
import { COLORS } from "../../lib/theme";
import { categoryBackground, formatMoney, formatQty } from "../../lib/format";
import { spawnRipple } from "../../lib/ripple";
import { useToast } from "../../lib/ToastContext";

function ItemThumb({ item, size = 96, fontSize = 40 }) {
  return (
    <div
      style={{
        height: size,
        display: "grid",
        placeItems: "center",
        background: categoryBackground(item.category),
        position: "relative",
        overflow: "hidden",
      }}
    >
      {item.img ? (
        <img src={item.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontSize }}>{item.emoji}</span>
      )}
    </div>
  );
}

const BLANK_ITEM = { id: null, name: "", category: "Fries", price: "", cost: "", emoji: "🍽️", fav: true, img: null };

// Used, unmodified, by both the Worker "Menu" tab and the Admin "Menu"
// screen in the original product — full add/edit/delete CRUD is available
// to either role. `uploadImage` comes from useProducts() and uploads to
// Supabase Storage, replacing the old base64-in-state photo handling.
// `recipes`/`inventoryOptions`/`onSaveRecipe` back the "Ingredients" section
// — the bill-of-materials link that makes a sale deduct inventory.
export default function MenuEditor({ menu, recipes, inventoryOptions, onSave, onSaveRecipe, onDelete, uploadImage }) {
  const [editing, setEditing] = useState(null);

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>Edit names, prices, photos, and ingredients.</p>
        <button
          onClick={() => setEditing(BLANK_ITEM)}
          className="press"
          style={{ height: 40, padding: "0 16px", borderRadius: 12, background: COLORS.ink, color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
        >
          <Plus size={16} /> Add item
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        {menu.map((item) => (
          <Card key={item.id} className="lift" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <button
              onClick={() => setEditing(item)}
              style={{ border: "none", background: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
            >
              <ItemThumb item={item} size={100} />
              <div style={{ padding: "14px 14px 10px" }}>
                <p style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: COLORS.faint, fontWeight: 600, margin: 0 }}>
                  {item.category}
                </p>
                <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, margin: "4px 0 0" }}>{item.name}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink, margin: "6px 0 0" }}>{formatMoney(item.price)}</p>
              </div>
            </button>
            <div style={{ display: "flex", borderTop: `1px solid ${COLORS.line2}`, marginTop: "auto" }}>
              <button
                onClick={() => setEditing(item)}
                style={{ flex: 1, height: 40, border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: COLORS.muted, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <Package size={14} /> Edit
              </button>
              <button
                onClick={() => onDelete(item.id)}
                style={{ flex: 1, height: 40, border: "none", borderLeft: `1px solid ${COLORS.line2}`, background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: COLORS.red, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          </Card>
        ))}

        <button
          onClick={() => setEditing(BLANK_ITEM)}
          className="press"
          style={{ minHeight: 180, borderRadius: 16, border: `2px dashed ${COLORS.line}`, background: "none", cursor: "pointer", display: "grid", placeItems: "center", color: COLORS.faint }}
        >
          <div style={{ textAlign: "center" }}>
            <Plus size={24} style={{ margin: "0 auto" }} />
            <p style={{ fontSize: 13, fontWeight: 600, margin: "8px 0 0" }}>Add item</p>
          </div>
        </button>
      </div>

      {editing && (
        <MenuItemModal
          item={editing}
          recipe={(editing.id && recipes?.[editing.id]) || []}
          inventoryOptions={inventoryOptions || []}
          onClose={() => setEditing(null)}
          onSave={async (item, ingredientRows) => {
            const productId = await onSave(item);
            if (onSaveRecipe) await onSaveRecipe(productId, ingredientRows);
            setEditing(null);
          }}
          onDelete={
            editing.id
              ? async () => {
                  await onDelete(editing.id);
                  setEditing(null);
                }
              : null
          }
          uploadImage={uploadImage}
        />
      )}
    </div>
  );
}

function MenuItemModal({ item, recipe, inventoryOptions, onClose, onSave, onDelete, uploadImage }) {
  const toast = useToast();
  const [form, setForm] = useState({ ...item, price: String(item.price ?? ""), cost: String(item.cost ?? "") });
  const [ingredients, setIngredients] = useState(recipe);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const canSave = form.name.trim() && Number(form.price) > 0;

  const pickedIds = new Set(ingredients.map((r) => r.inventoryItemId));
  const availableToAdd = inventoryOptions.filter((opt) => !pickedIds.has(opt.id));

  const addIngredient = (invItem) => {
    setIngredients((rows) => [...rows, { inventoryItemId: invItem.id, name: invItem.name, unit: invItem.unit, emoji: invItem.emoji, qtyPerUnit: "" }]);
  };
  const updateIngredientQty = (invItemId, qty) => {
    setIngredients((rows) => rows.map((r) => (r.inventoryItemId === invItemId ? { ...r, qtyPerUnit: qty } : r)));
  };
  const removeIngredient = (invItemId) => {
    setIngredients((rows) => rows.filter((r) => r.inventoryItemId !== invItemId));
  };

  const handleFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, img: url }));
    } catch (err) {
      setError(err.message || "Couldn't upload that photo.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave({ ...form, price: Number(form.price) || 0, cost: Number(form.cost) || 0 }, ingredients);
      toast.success(`${form.name.trim()} saved`);
    } catch (err) {
      setError(err.message || "Couldn't save this item.");
      toast.error(err.message || "Couldn't save this item.");
      setSaving(false);
    }
  };

  const inputStyle = { width: "100%", height: 44, padding: "0 14px", borderRadius: 12, border: "1px solid transparent", background: COLORS.soft, fontSize: 14, color: COLORS.ink, boxSizing: "border-box" };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: COLORS.ink, marginBottom: 6 };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 16, background: "rgba(28,25,23,0.45)", animation: "fadeIn .2s ease" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 24, width: "100%", maxWidth: 440, maxHeight: "90vh", display: "flex", flexDirection: "column", animation: "popIn .25s cubic-bezier(0.16,1,0.3,1)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${COLORS.line}`, flexShrink: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink, margin: 0 }}>{item.id ? "Edit item" : "New item"}</h3>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: COLORS.soft, display: "grid", placeItems: "center", cursor: "pointer", color: COLORS.muted }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 12 }}>
            <label
              style={{ width: 92, height: 92, flexShrink: 0, borderRadius: 16, overflow: "hidden", cursor: "pointer", border: `2px dashed ${COLORS.line}`, display: "grid", placeItems: "center", background: categoryBackground(form.category), position: "relative" }}
            >
              {uploading ? (
                <span style={{ fontSize: 11, color: COLORS.muted, textAlign: "center" }}>Uploading…</span>
              ) : form.img ? (
                <img src={form.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 34 }}>{form.emoji}</span>
              )}
              <div style={{ position: "absolute", bottom: 4, right: 4, background: "rgba(255,255,255,0.85)", borderRadius: 8, padding: 3 }}>
                <Camera size={13} color={COLORS.muted} />
              </div>
              <input type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} disabled={uploading} />
            </label>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} value={form.name} onChange={set("name")} placeholder="Large Fries" autoFocus />
              <p style={{ fontSize: 12, color: COLORS.faint, margin: "8px 0 0", lineHeight: 1.4 }}>
                Tap the box to add a photo. Optional — an emoji shows if you skip it.
              </p>
              {form.img && (
                <button
                  onClick={() => setForm({ ...form, img: null })}
                  style={{ marginTop: 4, fontSize: 12, color: COLORS.red, fontWeight: 600, border: "none", background: "none", cursor: "pointer", padding: 0 }}
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Category</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["Fries", "Drinks"].map((c) => {
                const active = form.category === c;
                return (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, category: c })}
                    style={{ height: 40, padding: "0 18px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: active ? COLORS.ink : COLORS.soft, color: active ? "#fff" : COLORS.muted }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Selling price</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: COLORS.faint }}>₱</span>
                <input style={{ ...inputStyle, paddingLeft: 28 }} value={form.price} onChange={set("price")} placeholder="0" inputMode="decimal" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Cost (optional)</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: COLORS.faint }}>₱</span>
                <input style={{ ...inputStyle, paddingLeft: 28 }} value={form.cost} onChange={set("cost")} placeholder="0" inputMode="decimal" />
              </div>
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, background: COLORS.soft, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.fav}
              onChange={(e) => setForm({ ...form, fav: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: COLORS.ink }}
            />
            <span style={{ fontSize: 13, color: COLORS.ink }}>Show in Favorites tab</span>
          </label>

          <div>
            <label style={labelStyle}>Ingredients (optional)</label>
            <p style={{ fontSize: 12, color: COLORS.faint, margin: "0 0 8px" }}>
              How much of each inventory item one sale uses. Enter the amount in that item's own unit — e.g. if
              Potatoes are tracked in kg, 150g is entered as 0.15.
            </p>
            {ingredients.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                {ingredients.map((row) => (
                  <div key={row.inventoryItemId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: COLORS.soft, display: "grid", placeItems: "center", fontSize: 16, flexShrink: 0 }}>
                      {row.emoji}
                    </div>
                    <span style={{ flex: 1, fontSize: 13, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
                    <div style={{ position: "relative", width: 110, flexShrink: 0 }}>
                      <input
                        value={row.qtyPerUnit}
                        onChange={(e) => updateIngredientQty(row.inventoryItemId, e.target.value)}
                        placeholder="0"
                        inputMode="decimal"
                        style={{ ...inputStyle, height: 38, paddingRight: 44, fontSize: 13 }}
                      />
                      <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 600, color: COLORS.faint }}>
                        {row.unit}
                      </span>
                    </div>
                    <button
                      onClick={() => removeIngredient(row.inventoryItemId)}
                      style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: COLORS.redBg, color: COLORS.red, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {availableToAdd.length > 0 ? (
              <select
                value=""
                onChange={(e) => {
                  const picked = availableToAdd.find((o) => o.id === e.target.value);
                  if (picked) addIngredient(picked);
                }}
                style={{ ...inputStyle, height: 38, fontSize: 13, color: COLORS.muted }}
              >
                <option value="">+ Add ingredient…</option>
                {availableToAdd.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.emoji} {opt.name} ({formatQty(opt.qty, opt.unit)} in stock)
                  </option>
                ))}
              </select>
            ) : (
              ingredients.length === 0 && <p style={{ fontSize: 12, color: COLORS.faint, margin: 0 }}>No inventory items to link yet.</p>
            )}
          </div>

          {error && (
            <div style={{ padding: 12, borderRadius: 12, background: COLORS.redBg }}>
              <p style={{ fontSize: 13, color: COLORS.red, margin: 0 }}>{error}</p>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, padding: "14px 20px", borderTop: `1px solid ${COLORS.line}`, flexShrink: 0 }}>
          {onDelete && (
            <button
              onClick={onDelete}
              style={{ height: 44, padding: "0 16px", borderRadius: 12, border: `1px solid ${COLORS.redBg}`, background: COLORS.redBg, fontSize: 14, fontWeight: 600, color: COLORS.red, cursor: "pointer" }}
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            style={{ height: 44, padding: "0 16px", borderRadius: 12, border: `1px solid ${COLORS.line}`, background: "#fff", fontSize: 14, fontWeight: 600, color: COLORS.muted, cursor: "pointer", marginLeft: "auto" }}
          >
            Cancel
          </button>
          <button
            disabled={!canSave || saving || uploading}
            onClick={save}
            onMouseDown={spawnRipple}
            className="press nx-ripple-host"
            style={{ height: 44, padding: "0 20px", borderRadius: 12, border: "none", background: COLORS.ink, color: "#fff", fontSize: 14, fontWeight: 600, cursor: canSave && !saving ? "pointer" : "not-allowed", opacity: canSave && !saving ? 1 : 0.3, display: "flex", alignItems: "center", gap: 8 }}
          >
            <Check size={16} /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
