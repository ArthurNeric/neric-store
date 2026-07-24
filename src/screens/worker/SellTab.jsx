import { useState } from "react";
import { Check, Minus, Plus, ShoppingCart, X } from "lucide-react";
import { COLORS } from "../../lib/theme";
import { categoryBackground, categoryColor, formatMoney } from "../../lib/format";
import { spawnRipple } from "../../lib/ripple";

function ItemThumb({ item, size, fontSize }) {
  return (
    <div style={{ height: size, display: "grid", placeItems: "center", background: categoryBackground(item.category), position: "relative", overflow: "hidden" }}>
      {item.img ? (
        <img src={item.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontSize }}>{item.emoji}</span>
      )}
    </div>
  );
}

const CATEGORY_TABS = ["Favorites", "Fries", "Drinks"];

// `onCheckout` is useOrders().checkout — it calls the create_order RPC, so
// the order number and total returned here are always the real,
// server-computed ones, never the client's local guess.
export default function SellTab({ menu, orderNo, onCheckout }) {
  const [tab, setTab] = useState("Favorites");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const visible = menu.filter((m) => (tab === "Favorites" ? m.fav : m.category === tab));
  const orderLabel = `Order ${orderNo}`;

  const addToCart = (item) => {
    const existing = cart.find((c) => c.id === item.id);
    setCart(
      existing
        ? cart.map((c) => (c.id === item.id ? { ...c, qty: c.qty + 1 } : c))
        : [...cart, { ...item, qty: 1 }]
    );
  };
  const adjustQty = (id, delta) =>
    setCart(cart.map((c) => (c.id === id ? { ...c, qty: c.qty + delta } : c)).filter((c) => c.qty > 0));

  const total = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const itemCount = cart.reduce((sum, c) => sum + c.qty, 0);

  const pay = async (method) => {
    setPaying(true);
    setError("");
    try {
      const order = await onCheckout(cart, method);
      setConfirmation({ total, method, items: itemCount, label: `Order ${order.order_number}` });
      setCart([]);
      setCheckoutOpen(false);
      setCartOpen(false);
    } catch (err) {
      setError(err.message || "Couldn't complete this sale.");
    } finally {
      setPaying(false);
    }
  };

  const CartBody = () => (
    <>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {cart.length === 0 ? (
          <div style={{ height: "100%", display: "grid", placeItems: "center", padding: 40, textAlign: "center", color: COLORS.faint }}>
            <div>
              <ShoppingCart size={26} color="#D8D0C8" style={{ margin: "0 auto" }} />
              <p style={{ fontSize: 13, margin: "10px 0 0" }}>No items yet</p>
            </div>
          </div>
        ) : (
          cart.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${COLORS.line2}` }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: categoryBackground(c.category), display: "grid", placeItems: "center", fontSize: 18, flexShrink: 0, overflow: "hidden" }}>
                {c.img ? <img src={c.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : c.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.name}
                </p>
                <p style={{ fontSize: 12, color: COLORS.muted, margin: 0 }}>{formatMoney(c.price)}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <button onClick={() => adjustQty(c.id, -1)} className="press" style={{ width: 28, height: 28, borderRadius: 8, background: COLORS.soft, border: "none", display: "grid", placeItems: "center", color: COLORS.ink, cursor: "pointer" }}>
                  <Minus size={13} />
                </button>
                <span style={{ width: 18, textAlign: "center", fontSize: 14, fontWeight: 600 }}>{c.qty}</span>
                <button onClick={() => adjustQty(c.id, 1)} className="press" style={{ width: 28, height: 28, borderRadius: 8, background: COLORS.ink, border: "none", display: "grid", placeItems: "center", color: "#fff", cursor: "pointer" }}>
                  <Plus size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div style={{ borderTop: `1px solid ${COLORS.line}`, padding: 16, flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: COLORS.muted }}>
            {itemCount} item{itemCount !== 1 ? "s" : ""}
          </span>
          <span style={{ fontSize: 22, fontWeight: 700, color: COLORS.ink }}>{formatMoney(total)}</span>
        </div>
        <button
          onClick={() => setCheckoutOpen(true)}
          onMouseDown={spawnRipple}
          disabled={cart.length === 0}
          className="press nx-ripple-host"
          style={{ width: "100%", height: 50, borderRadius: 14, background: COLORS.ink, color: "#fff", fontSize: 15, fontWeight: 700, border: "none", cursor: cart.length ? "pointer" : "not-allowed", opacity: cart.length ? 1 : 0.3 }}
        >
          Checkout {formatMoney(total)}
        </button>
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexShrink: 0 }}>
          {CATEGORY_TABS.map((c) => {
            const active = tab === c;
            const color = categoryColor(c);
            return (
              <button
                key={c}
                onClick={() => setTab(c)}
                style={{ height: 38, padding: "0 18px", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none", background: active ? color : "#fff", color: active ? "#fff" : COLORS.muted, boxShadow: active ? "none" : `inset 0 0 0 1px ${COLORS.line}` }}
              >
                {c}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingBottom: 90 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
            {visible.map((item) => {
              const inCart = cart.find((c) => c.id === item.id)?.qty || 0;
              return (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="lift press"
                  style={{ position: "relative", background: "#fff", borderRadius: 16, border: `1px solid ${COLORS.line}`, overflow: "hidden", textAlign: "left", cursor: "pointer", padding: 0 }}
                >
                  {inCart > 0 && (
                    <div
                      key={inCart}
                      style={{ position: "absolute", top: 8, right: 8, zIndex: 2, width: 24, height: 24, borderRadius: 999, background: categoryColor(item.category), display: "grid", placeItems: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.2)", animation: "popIn .25s cubic-bezier(0.16,1,0.3,1)" }}
                    >
                      <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>{inCart}</span>
                    </div>
                  )}
                  <ItemThumb item={item} size={90} fontSize={38} />
                  <div style={{ padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: categoryColor(item.category), flexShrink: 0 }} />
                      <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink, margin: 0, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.name}
                      </p>
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: "4px 0 0" }}>{formatMoney(item.price)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="sell-cart-desktop" style={{ width: 340, flexShrink: 0, background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 16, display: "flex", flexDirection: "column", marginLeft: 16, minHeight: 0 }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${COLORS.line}`, flexShrink: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink, margin: 0 }}>{orderLabel}</p>
          <p style={{ fontSize: 11, color: COLORS.faint, margin: 0 }}>Numbered automatically</p>
        </div>
        <CartBody />
      </div>

      <div className="sell-bottombar" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30, background: "#fff", borderTop: `1px solid ${COLORS.line}`, padding: "12px 16px", display: "none", alignItems: "center", gap: 12, boxShadow: "0 -4px 16px rgba(28,25,23,0.06)" }}>
        <button onClick={() => setCartOpen(true)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <div style={{ position: "relative", width: 40, height: 40, borderRadius: 12, background: COLORS.soft, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <ShoppingCart size={18} color={COLORS.ink} />
            {itemCount > 0 && (
              <span
                key={itemCount}
                style={{ position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 999, background: COLORS.ink, color: "#fff", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center", animation: "popIn .25s cubic-bezier(0.16,1,0.3,1)" }}
              >
                {itemCount}
              </span>
            )}
          </div>
          <div style={{ textAlign: "left" }}>
            <p style={{ fontSize: 12, color: COLORS.muted, margin: 0 }}>
              {orderLabel} · {itemCount} item{itemCount !== 1 ? "s" : ""}
            </p>
            <p style={{ fontSize: 18, fontWeight: 700, color: COLORS.ink, margin: 0 }}>{formatMoney(total)}</p>
          </div>
        </button>
        <button
          onClick={() => cart.length && setCheckoutOpen(true)}
          onMouseDown={spawnRipple}
          disabled={cart.length === 0}
          className="press nx-ripple-host"
          style={{ padding: "0 22px", height: 46, borderRadius: 12, background: COLORS.ink, color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: cart.length ? "pointer" : "not-allowed", opacity: cart.length ? 1 : 0.3, whiteSpace: "nowrap" }}
        >
          Checkout
        </button>
      </div>

      {cartOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(28,25,23,0.4)", display: "flex", alignItems: "flex-end", animation: "fadeIn .2s ease" }} onClick={() => setCartOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: "#fff", borderRadius: "24px 24px 0 0", maxHeight: "80vh", display: "flex", flexDirection: "column", animation: "sheetUp .3s cubic-bezier(0.16,1,0.3,1)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 12px", borderBottom: `1px solid ${COLORS.line}`, flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: 0 }}>{orderLabel}</p>
                <p style={{ fontSize: 11, color: COLORS.faint, margin: 0 }}>Numbered automatically</p>
              </div>
              <button onClick={() => setCartOpen(false)} style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: COLORS.soft, display: "grid", placeItems: "center", cursor: "pointer", color: COLORS.muted }}>
                <X size={18} />
              </button>
            </div>
            <CartBody />
          </div>
        </div>
      )}

      {checkoutOpen && (
        <PaymentSheet total={total} label={orderLabel} error={error} paying={paying} onClose={() => setCheckoutOpen(false)} onPay={pay} />
      )}
      {confirmation && <ConfirmationModal {...confirmation} onClose={() => setConfirmation(null)} />}

      <style>{`
        @media (max-width: 820px) {
          .sell-cart-desktop { display: none !important; }
          .sell-bottombar { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

function PaymentSheet({ total, label, error, paying, onClose, onPay }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 16, background: "rgba(28,25,23,0.45)", animation: "fadeIn .2s ease" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 24, width: "100%", maxWidth: 380, animation: "popIn .25s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${COLORS.line}` }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink, margin: 0 }}>How did they pay?</h3>
            <p style={{ fontSize: 12, color: COLORS.faint, margin: "2px 0 0" }}>{label}</p>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: COLORS.soft, display: "grid", placeItems: "center", cursor: "pointer", color: COLORS.muted }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <p style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: COLORS.faint, fontWeight: 600, margin: 0 }}>Total</p>
            <p style={{ fontSize: 40, fontWeight: 700, color: COLORS.ink, margin: "6px 0 0", lineHeight: 1 }}>{formatMoney(total)}</p>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <button
              disabled={paying}
              onClick={() => onPay("Cash")}
              onMouseDown={spawnRipple}
              className="press nx-ripple-host nx-ripple-host--dark"
              style={{ height: 58, borderRadius: 16, border: `2px solid ${COLORS.ink}`, background: "#fff", fontSize: 16, fontWeight: 700, color: COLORS.ink, cursor: paying ? "not-allowed" : "pointer", opacity: paying ? 0.6 : 1 }}
            >
              Cash
            </button>
            <button
              disabled={paying}
              onClick={() => onPay("GCash")}
              onMouseDown={spawnRipple}
              className="press nx-ripple-host"
              style={{ height: 58, borderRadius: 16, border: "none", background: "#0A7CFF", color: "#fff", fontSize: 16, fontWeight: 700, cursor: paying ? "not-allowed" : "pointer", opacity: paying ? 0.6 : 1 }}
            >
              GCash
            </button>
          </div>
          {error && <p style={{ fontSize: 13, color: COLORS.red, textAlign: "center", margin: "14px 0 0" }}>{error}</p>}
          <p style={{ fontSize: 12, color: COLORS.faint, textAlign: "center", margin: "16px 0 0" }}>
            {paying ? "Recording the sale…" : "Tap one and the sale is recorded."}
          </p>
        </div>
      </div>
    </div>
  );
}

function ConfirmationModal({ total, method, items, label, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 16, background: "rgba(28,25,23,0.45)", animation: "fadeIn .2s ease" }}>
      <div style={{ background: "#fff", borderRadius: 24, width: "100%", maxWidth: 340, padding: 28, textAlign: "center", animation: "popIn .3s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: COLORS.green, display: "grid", placeItems: "center", margin: "0 auto", boxShadow: "0 8px 20px rgba(63,107,75,0.3)", animation: "popIn .4s cubic-bezier(0.16,1,0.3,1)" }}>
          <Check size={28} color="#fff" />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: COLORS.ink, margin: "16px 0 0" }}>{label} recorded</h3>
        <p style={{ fontSize: 14, color: COLORS.muted, margin: "4px 0 0" }}>
          {items} item{items !== 1 ? "s" : ""} · {formatMoney(total)} · {method}
        </p>
        <button
          onClick={onClose}
          className="press"
          style={{ marginTop: 20, width: "100%", height: 48, borderRadius: 14, border: "none", background: COLORS.ink, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
        >
          Next order
        </button>
      </div>
    </div>
  );
}
