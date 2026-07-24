import { useState } from "react";
import { History, Pencil, Plus, Trash2, X } from "lucide-react";
import Card from "../../components/Card";
import { COLORS, colorForKey } from "../../lib/theme";
import { formatDateTime, formatQty } from "../../lib/format";
import { spawnRipple } from "../../lib/ripple";
import { useToast } from "../../lib/ToastContext";

const UNIT_OPTIONS = ["count", "pcs", "g", "kg", "ml", "L", "pack", "box"];

// Quick-fill labels for size-variant items (e.g. "Cups" in several sizes) —
// tap one to append it to the name field, so "Cups" + "16oz" becomes
// "Cups 16oz" without free-typing it every time. Each size is still its own
// fully independent inventory item/row, matching how this store already
// tracks e.g. "Fries cups" and "Cups 16oz" separately.
const SIZE_SUGGESTIONS = ["12oz", "16oz", "22oz", "Small", "Medium", "Large", "Family"];

// Known unit-family conversions, used only to offer a one-click qty
// recalculation when editing an item's unit — never applied automatically.
const UNIT_CONVERSIONS = { "kg->g": 1000, "g->kg": 1 / 1000, "L->ml": 1000, "ml->L": 1 / 1000 };

function SizeChips({ onPick }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
      {SIZE_SUGGESTIONS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          style={{ height: 26, padding: "0 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${COLORS.line}`, background: "#fff", color: COLORS.muted }}
        >
          + {s}
        </button>
      ))}
    </div>
  );
}

// Used, unmodified, by both the Worker "Inventory" tab and the Admin
// "Inventory" screen — stock levels, add-stock, new-item, edit, and delete
// are all available to either role, matching the original product.
export default function InventoryPanel({ stock, history, onAddStock, onCreateItem, onUpdateItem, onDeleteItem }) {
  const [addingTo, setAddingTo] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [creating, setCreating] = useState(false);

  const totalValue = stock.reduce((sum, s) => sum + (s.cost || 0) * s.qty, 0);

  return (
    <div style={{ maxWidth: 1000, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,340px)", gap: 16, alignItems: "start" }} className="inv-grid">
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Stock on hand</h3>
            <p style={{ fontSize: 12, color: COLORS.faint, margin: "2px 0 0" }}>
              Total value ₱{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="press"
            style={{ height: 38, padding: "0 14px", borderRadius: 12, background: "#fff", border: `1px solid ${COLORS.line}`, fontSize: 13, fontWeight: 600, color: COLORS.ink, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={15} /> New item
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {stock.map((s) => (
            <Card key={s.id} style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: colorForKey(s.name), display: "grid", placeItems: "center", fontSize: 22, flexShrink: 0 }}>
                  {s.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.name}
                  </p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: COLORS.ink, margin: "2px 0 0" }}>{formatQty(s.qty, s.unit)}</p>
                  {s.cost > 0 && (
                    <p style={{ fontSize: 11, color: COLORS.faint, margin: "2px 0 0" }}>
                      ₱{s.cost.toLocaleString()}/{s.unit} · ₱{(s.cost * s.qty).toLocaleString(undefined, { maximumFractionDigits: 0 })} value
                    </p>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => setAddingTo(s)}
                  className="press"
                  style={{ flex: 1, height: 38, borderRadius: 10, background: COLORS.ink, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <Plus size={15} /> Add stock
                </button>
                <button
                  onClick={() => setEditingItem(s)}
                  title="Edit item"
                  className="press"
                  style={{ width: 38, height: 38, borderRadius: 10, background: COLORS.soft, color: COLORS.ink, border: "none", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => onDeleteItem(s.id)}
                  title="Remove item"
                  className="press"
                  style={{ width: 38, height: 38, borderRadius: 10, background: COLORS.redBg, color: COLORS.red, border: "none", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Card style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.line}`, display: "flex", alignItems: "center", gap: 8 }}>
          <History size={16} color={COLORS.muted} />
          <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Stock activity</h3>
        </div>
        <div style={{ padding: 8, maxHeight: 520, overflowY: "auto" }}>
          {history.length === 0 ? (
            <p style={{ fontSize: 13, color: COLORS.faint, padding: 16, textAlign: "center" }}>Nothing yet.</p>
          ) : (
            history.map((h) => {
              const positive = h.qty >= 0;
              const reasonLabel = h.reason === "sale" ? "Sold" : h.reason === "sale_reversal" ? "Sale voided" : "Restocked";
              return (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: colorForKey(h.name), display: "grid", placeItems: "center", fontSize: 17, flexShrink: 0 }}>
                    {h.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {h.name}
                    </p>
                    <p style={{ fontSize: 12, color: COLORS.faint, margin: 0 }}>
                      {reasonLabel} · {formatDateTime(h.when)}
                    </p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: positive ? COLORS.green : COLORS.red, flexShrink: 0 }}>
                    {positive ? "+" : ""}
                    {formatQty(h.qty, h.unit)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {addingTo && (
        <AddStockModal
          item={addingTo}
          onClose={() => setAddingTo(null)}
          onAdd={async (qty) => {
            await onAddStock(addingTo.id, qty);
            setAddingTo(null);
          }}
        />
      )}
      {creating && (
        <NewItemModal
          onClose={() => setCreating(false)}
          onCreate={async (item) => {
            await onCreateItem(item);
            setCreating(false);
          }}
        />
      )}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={async (updates) => {
            await onUpdateItem(editingItem.id, updates);
            setEditingItem(null);
          }}
        />
      )}

      <style>{"@media(max-width:820px){.inv-grid{grid-template-columns:1fr !important}}"}</style>
    </div>
  );
}

function AddStockModal({ item, onClose, onAdd }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const qty = Number(amount) || 0;
  const canAdd = qty > 0;

  const submit = async () => {
    if (!canAdd) return;
    setSaving(true);
    setError("");
    try {
      await onAdd(qty);
      toast.success(`Added ${formatQty(qty, item.unit)} to ${item.name}`);
    } catch (err) {
      setError(err.message || "Couldn't add stock.");
      toast.error(err.message || "Couldn't add stock.");
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 16, background: "rgba(28,25,23,0.45)", animation: "fadeIn .2s ease" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 24, width: "100%", maxWidth: 380, animation: "popIn .25s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${COLORS.line}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Add stock</h3>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: COLORS.soft, display: "grid", placeItems: "center", cursor: "pointer", color: COLORS.muted }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, background: COLORS.soft, marginBottom: 16 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "#fff", display: "grid", placeItems: "center", fontSize: 22 }}>{item.emoji}</div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, margin: 0 }}>{item.name}</p>
              <p style={{ fontSize: 12, color: COLORS.muted, margin: 0 }}>
                Now: {formatQty(item.qty, item.unit)} → {formatQty(item.qty + qty, item.unit)}
              </p>
            </div>
          </div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.ink, marginBottom: 6 }}>Quantity to add</label>
          <div style={{ position: "relative" }}>
            <input
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="0"
              inputMode="decimal"
              style={{ width: "100%", height: 52, padding: "0 52px 0 16px", borderRadius: 14, border: "1px solid transparent", background: COLORS.soft, fontSize: 20, fontWeight: 700, color: COLORS.ink, boxSizing: "border-box" }}
            />
            {item.unit && item.unit !== "count" && (
              <span style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", fontSize: 14, fontWeight: 600, color: COLORS.faint }}>
                {item.unit}
              </span>
            )}
          </div>
          {error && <p style={{ fontSize: 13, color: COLORS.red, margin: "10px 0 0" }}>{error}</p>}
          <button
            disabled={!canAdd || saving}
            onClick={submit}
            onMouseDown={spawnRipple}
            className="press nx-ripple-host"
            style={{ marginTop: 16, width: "100%", height: 50, borderRadius: 14, border: "none", background: COLORS.ink, color: "#fff", fontSize: 15, fontWeight: 700, cursor: canAdd && !saving ? "pointer" : "not-allowed", opacity: canAdd && !saving ? 1 : 0.3 }}
          >
            {saving ? "Adding…" : "Add to stock"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewItemModal({ onClose, onCreate }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", unit: "count", qty: "", emoji: "📦", cost: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const isCount = form.unit === "count";
  const canCreate = form.name.trim() && form.unit.trim();

  const submit = async () => {
    if (!canCreate) return;
    setSaving(true);
    setError("");
    try {
      await onCreate({
        name: form.name.trim(),
        unit: form.unit.trim(),
        qty: Number(form.qty) || 0,
        emoji: form.emoji,
        cost: Number(form.cost) || 0,
      });
      toast.success(`${form.name.trim()} added to inventory`);
    } catch (err) {
      setError(err.message || "Couldn't create this item.");
      toast.error(err.message || "Couldn't create this item.");
      setSaving(false);
    }
  };

  const inputStyle = { width: "100%", height: 44, padding: "0 14px", borderRadius: 12, border: "1px solid transparent", background: COLORS.soft, fontSize: 14, color: COLORS.ink, boxSizing: "border-box" };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: COLORS.ink, marginBottom: 6 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 16, background: "rgba(28,25,23,0.45)", animation: "fadeIn .2s ease" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 24, width: "100%", maxWidth: 400, animation: "popIn .25s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${COLORS.line}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink, margin: 0 }}>New stock item</h3>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: COLORS.soft, display: "grid", placeItems: "center", cursor: "pointer", color: COLORS.muted }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Item name</label>
            <input style={inputStyle} value={form.name} onChange={set("name")} placeholder="Potatoes, or Cups" autoFocus />
            <p style={{ fontSize: 12, color: COLORS.faint, margin: "8px 0 0" }}>
              For items that come in sizes (like cups), tap a size to add it to the name — each size is tracked as its
              own item.
            </p>
            <SizeChips onPick={(s) => setForm((f) => ({ ...f, name: f.name.trim() ? `${f.name.trim()} ${s}` : s }))} />
          </div>
          <div>
            <label style={labelStyle}>How is it measured?</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {UNIT_OPTIONS.map((u) => {
                const active = form.unit === u;
                const label = u === "count" ? "Just a number" : u;
                return (
                  <button
                    key={u}
                    onClick={() => setForm({ ...form, unit: u })}
                    style={{ height: 36, padding: "0 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: active ? COLORS.ink : COLORS.soft, color: active ? "#fff" : COLORS.muted }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {isCount ? (
              <p style={{ fontSize: 12, color: COLORS.faint, margin: 0 }}>Counted as a plain number — e.g. 5, 12, 100.</p>
            ) : (
              <input style={inputStyle} value={form.unit} onChange={set("unit")} placeholder="or type a custom unit — sachet, tray…" />
            )}
          </div>
          <div>
            <label style={labelStyle}>Starting quantity</label>
            <div style={{ position: "relative" }}>
              <input style={{ ...inputStyle, paddingRight: isCount ? 14 : 48 }} value={form.qty} onChange={set("qty")} placeholder="0" inputMode="decimal" />
              {!isCount && (
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 600, color: COLORS.faint }}>
                  {form.unit}
                </span>
              )}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Cost per unit (optional)</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: COLORS.faint }}>₱</span>
              <input style={{ ...inputStyle, paddingLeft: 28 }} value={form.cost} onChange={set("cost")} placeholder="0.00" inputMode="decimal" />
            </div>
            <p style={{ fontSize: 12, color: COLORS.faint, margin: "6px 0 0" }}>
              What one {form.unit && form.unit !== "count" ? form.unit : "unit"} costs you — used for stock value.
            </p>
          </div>
          {error && <p style={{ fontSize: 13, color: COLORS.red, margin: 0 }}>{error}</p>}
        </div>
        <div style={{ display: "flex", gap: 8, padding: "14px 20px", borderTop: `1px solid ${COLORS.line}` }}>
          <button
            onClick={onClose}
            style={{ height: 44, padding: "0 16px", borderRadius: 12, border: `1px solid ${COLORS.line}`, background: "#fff", fontSize: 14, fontWeight: 600, color: COLORS.muted, cursor: "pointer", marginLeft: "auto" }}
          >
            Cancel
          </button>
          <button
            disabled={!canCreate || saving}
            onClick={submit}
            onMouseDown={spawnRipple}
            className="press nx-ripple-host"
            style={{ height: 44, padding: "0 20px", borderRadius: 12, border: "none", background: COLORS.ink, color: "#fff", fontSize: 14, fontWeight: 600, cursor: canCreate && !saving ? "pointer" : "not-allowed", opacity: canCreate && !saving ? 1 : 0.3, display: "flex", alignItems: "center", gap: 8 }}
          >
            <Plus size={16} /> {saving ? "Adding…" : "Add item"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditItemModal({ item, onClose, onSave }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: item.name, unit: item.unit, qty: String(item.qty), cost: String(item.cost ?? "") });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const isCount = form.unit === "count";
  const canSave = form.name.trim() && form.unit.trim();

  const conversionFactor = UNIT_CONVERSIONS[`${item.unit}->${form.unit}`];
  const convertedQty = conversionFactor ? item.qty * conversionFactor : null;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      await onSave({
        name: form.name.trim(),
        unit: form.unit.trim(),
        qty: Number(form.qty) || 0,
        cost: Number(form.cost) || 0,
      });
      toast.success(`${form.name.trim()} updated`);
    } catch (err) {
      setError(err.message || "Couldn't update this item.");
      toast.error(err.message || "Couldn't update this item.");
      setSaving(false);
    }
  };

  const inputStyle = { width: "100%", height: 44, padding: "0 14px", borderRadius: 12, border: "1px solid transparent", background: COLORS.soft, fontSize: 14, color: COLORS.ink, boxSizing: "border-box" };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: COLORS.ink, marginBottom: 6 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 16, background: "rgba(28,25,23,0.45)", animation: "fadeIn .2s ease" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 24, width: "100%", maxWidth: 400, animation: "popIn .25s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${COLORS.line}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Edit item</h3>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: COLORS.soft, display: "grid", placeItems: "center", cursor: "pointer", color: COLORS.muted }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Item name</label>
            <input style={inputStyle} value={form.name} onChange={set("name")} autoFocus />
            <SizeChips onPick={(s) => setForm((f) => ({ ...f, name: f.name.trim() ? `${f.name.trim()} ${s}` : s }))} />
          </div>
          <div>
            <label style={labelStyle}>How is it measured?</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {UNIT_OPTIONS.map((u) => {
                const active = form.unit === u;
                const label = u === "count" ? "Just a number" : u;
                return (
                  <button
                    key={u}
                    onClick={() => setForm({ ...form, unit: u })}
                    style={{ height: 36, padding: "0 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: active ? COLORS.ink : COLORS.soft, color: active ? "#fff" : COLORS.muted }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {!isCount && <input style={inputStyle} value={form.unit} onChange={set("unit")} placeholder="or type a custom unit" />}
          </div>
          <div>
            <label style={labelStyle}>Quantity on hand</label>
            <div style={{ position: "relative" }}>
              <input style={{ ...inputStyle, paddingRight: isCount ? 14 : 48 }} value={form.qty} onChange={set("qty")} inputMode="decimal" />
              {!isCount && (
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 600, color: COLORS.faint }}>
                  {form.unit}
                </span>
              )}
            </div>
            {convertedQty !== null && form.unit !== item.unit && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, qty: String(convertedQty) }))}
                style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: COLORS.blue, background: COLORS.blueBg, border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}
              >
                Convert {formatQty(item.qty, item.unit)} → {formatQty(convertedQty, form.unit)}
              </button>
            )}
            {form.unit !== item.unit && conversionFactor === undefined && (
              <p style={{ fontSize: 11, color: COLORS.faint, margin: "8px 0 0" }}>
                Changing the unit doesn't convert the quantity number — update it above if needed.
              </p>
            )}
          </div>
          <div>
            <label style={labelStyle}>Cost per unit (optional)</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: COLORS.faint }}>₱</span>
              <input style={{ ...inputStyle, paddingLeft: 28 }} value={form.cost} onChange={set("cost")} placeholder="0.00" inputMode="decimal" />
            </div>
          </div>
          <p style={{ fontSize: 11, color: COLORS.faint, margin: 0 }}>
            Any Menu recipes already linked to this item keep their existing numbers — double-check them if you change
            the unit here.
          </p>
          {error && <p style={{ fontSize: 13, color: COLORS.red, margin: 0 }}>{error}</p>}
        </div>
        <div style={{ display: "flex", gap: 8, padding: "14px 20px", borderTop: `1px solid ${COLORS.line}` }}>
          <button
            onClick={onClose}
            style={{ height: 44, padding: "0 16px", borderRadius: 12, border: `1px solid ${COLORS.line}`, background: "#fff", fontSize: 14, fontWeight: 600, color: COLORS.muted, cursor: "pointer", marginLeft: "auto" }}
          >
            Cancel
          </button>
          <button
            disabled={!canSave || saving}
            onClick={submit}
            onMouseDown={spawnRipple}
            className="press nx-ripple-host"
            style={{ height: 44, padding: "0 20px", borderRadius: 12, border: "none", background: COLORS.ink, color: "#fff", fontSize: 14, fontWeight: 600, cursor: canSave && !saving ? "pointer" : "not-allowed", opacity: canSave && !saving ? 1 : 0.3, display: "flex", alignItems: "center", gap: 8 }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
