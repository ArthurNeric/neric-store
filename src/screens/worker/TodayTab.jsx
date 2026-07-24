import { Receipt, ShoppingBag, Trash2, Wallet } from "lucide-react";
import Card from "../../components/Card";
import { COLORS, FONT_SERIF } from "../../lib/theme";
import { categoryBackground, formatMoney } from "../../lib/format";
import { useCountUp } from "../../hooks/useCountUp";

function SectionIcon({ icon: Icon, color }) {
  return (
    <div style={{ width: 32, height: 32, borderRadius: 999, display: "grid", placeItems: "center", flexShrink: 0, background: color }}>
      <Icon size={15} color="#fff" />
    </div>
  );
}

// `orders` come from useOrders() — real rows persisted in Postgres, scoped
// to "today" in Asia/Manila time, not an in-memory array that resets on
// refresh.
export default function TodayTab({ orders, onRemove }) {
  const cash = orders.filter((o) => o.method === "Cash").reduce((s, o) => s + o.total, 0);
  const gcash = orders.filter((o) => o.method === "GCash").reduce((s, o) => s + o.total, 0);
  const itemCount = orders.reduce((s, o) => s + o.items.reduce((s2, it) => s2 + it.qty, 0), 0);

  const sold = {};
  orders.forEach((o) =>
    o.items.forEach((it) => {
      sold[it.name] = sold[it.name] || { name: it.name, emoji: it.emoji, category: it.category, qty: 0, total: 0 };
      sold[it.name].qty += it.qty;
      sold[it.name].total += it.qty * it.price;
    })
  );
  const soldList = Object.values(sold).sort((a, b) => b.qty - a.qty);
  const animatedTotal = useCountUp(cash + gcash);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,340px)", gap: 16, maxWidth: 1100, alignItems: "start" }} className="today-grid">
      <Card style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <SectionIcon icon={Receipt} color={COLORS.accent} />
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Orders today</h3>
              <p style={{ fontSize: 13, color: COLORS.muted, margin: "2px 0 0" }}>Newest first.</p>
            </div>
          </div>
          <span style={{ fontSize: 13, color: COLORS.faint }}>
            {orders.length} order{orders.length !== 1 ? "s" : ""} · {itemCount} items
          </span>
        </div>
        <div style={{ padding: 8, maxHeight: 560, overflowY: "auto" }}>
          {orders.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <Receipt size={26} color="#D8D0C8" style={{ margin: "0 auto" }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.muted, margin: "10px 0 0" }}>No sales yet today</p>
            </div>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="row-hover" style={{ padding: 14, borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink }}>{o.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: 999,
                        ...(o.method === "GCash" ? { color: COLORS.blue, background: COLORS.blueBg } : { color: COLORS.muted, background: COLORS.soft }),
                      }}
                    >
                      {o.method}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{formatMoney(o.total)}</span>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>{o.items.map((it) => `${it.qty}× ${it.name}`).join(", ")}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <p style={{ fontSize: 12, color: COLORS.faint, margin: 0 }}>{o.time}</p>
                  <button
                    onClick={() => onRemove(o.id)}
                    style={{ fontSize: 12, color: COLORS.red, fontWeight: 600, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 8 }}
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <SectionIcon icon={Wallet} color={COLORS.green} />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Total today</h3>
          </div>
          <p style={{ fontFamily: FONT_SERIF, fontSize: 36, fontWeight: 600, color: COLORS.ink, margin: "14px 0 0", lineHeight: 1 }}>{formatMoney(animatedTotal)}</p>
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              ["Cash", cash],
              ["GCash", gcash],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: COLORS.muted }}>{label}</span>
                <span style={{ fontWeight: 600, color: COLORS.ink }}>{formatMoney(value)}</span>
              </div>
            ))}
            <div style={{ paddingTop: 10, borderTop: `1px solid ${COLORS.line}`, display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: COLORS.muted }}>Orders</span>
              <span style={{ fontWeight: 600, color: COLORS.ink }}>{orders.length}</span>
            </div>
          </div>
        </Card>

        {soldList.length > 0 && (
          <Card style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.line}`, display: "flex", alignItems: "center", gap: 12 }}>
              <SectionIcon icon={ShoppingBag} color={COLORS.blue} />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Sold today</h3>
            </div>
            <div style={{ padding: 8 }}>
              {soldList.map((s) => (
                <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: categoryBackground(s.category), display: "grid", placeItems: "center", fontSize: 17 }}>
                    {s.emoji}
                  </div>
                  <p style={{ flex: 1, fontSize: 14, fontWeight: 600, color: COLORS.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.name}
                  </p>
                  <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink }}>{s.qty}</span>
                  <span style={{ fontSize: 13, color: COLORS.muted, width: 64, textAlign: "right" }}>{formatMoney(s.total)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <style>{"@media(max-width:820px){.today-grid{grid-template-columns:1fr !important}}"}</style>
    </div>
  );
}
