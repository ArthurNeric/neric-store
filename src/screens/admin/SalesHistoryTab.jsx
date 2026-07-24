import { useState } from "react";
import { Receipt, Trash2 } from "lucide-react";
import Card from "../../components/Card";
import Skeleton from "../../components/Skeleton";
import { COLORS } from "../../lib/theme";
import { formatDateTime, formatMoney } from "../../lib/format";
import { useSalesHistory } from "../../hooks/useSalesHistory";
import { useToast } from "../../lib/ToastContext";

// Admin-only, all-time — distinct from the aggregated Reports charts and
// from the staff Today tab's today-only view. Updates live via realtime;
// see useSalesHistory for the cursor-pagination + subscription details.
// `onOrderVoided` is optional — AdminDashboard passes its own useInventory()
// refresh in, since void_order() restores stock server-side and this tab's
// own hook has no way to know that unless told.
export default function SalesHistoryTab({ onOrderVoided }) {
  const toast = useToast();
  const { orders, loading, loadingMore, error, hasMore, newCount, loadMore, refresh, removeOrder } = useSalesHistory();
  const [removingId, setRemovingId] = useState(null);

  const handleRemove = async (order) => {
    setRemovingId(order.id);
    try {
      await removeOrder(order.id);
      await onOrderVoided?.();
      toast.success(`${order.label} voided — stock restored`);
    } catch (err) {
      toast.error(err.message || "Couldn't void this sale.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ overflow: "hidden" }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${COLORS.line}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: 0 }}>All sales</h3>
            <p style={{ fontSize: 13, color: COLORS.muted, margin: "2px 0 0" }}>Every order, newest first — updates live.</p>
          </div>
          {newCount > 0 && (
            <button
              onClick={refresh}
              className="press"
              style={{ height: 32, padding: "0 12px", borderRadius: 999, border: "none", background: COLORS.green, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}
            >
              {newCount} new sale{newCount !== 1 ? "s" : ""}
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={54} radius={12} />
            ))}
          </div>
        ) : error ? (
          <p style={{ padding: 40, textAlign: "center", color: COLORS.red, fontSize: 13 }}>{error}</p>
        ) : orders.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Receipt size={26} color="#D8D0C8" style={{ margin: "0 auto" }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.muted, margin: "10px 0 0" }}>No sales yet</p>
          </div>
        ) : (
          <div style={{ padding: 8 }}>
            {orders.map((o) => (
              <div key={o.id} className="row-hover" style={{ padding: 14, borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink }}>{o.label}</span>
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
                  <p style={{ fontSize: 12, color: COLORS.faint, margin: 0 }}>
                    {formatDateTime(new Date(o.createdAt))}
                    {o.createdBy && ` · Rung up by ${o.createdBy}`}
                  </p>
                  <button
                    onClick={() => handleRemove(o)}
                    disabled={removingId === o.id}
                    style={{
                      fontSize: 12,
                      color: COLORS.red,
                      fontWeight: 600,
                      background: "none",
                      border: "none",
                      cursor: removingId === o.id ? "not-allowed" : "pointer",
                      opacity: removingId === o.id ? 0.5 : 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 8px",
                      borderRadius: 8,
                    }}
                  >
                    <Trash2 size={13} /> {removingId === o.id ? "Voiding…" : "Void"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasMore && !loading && orders.length > 0 && (
          <div style={{ padding: 16, borderTop: `1px solid ${COLORS.line}` }}>
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="press"
              style={{ width: "100%", height: 42, borderRadius: 12, border: `1px solid ${COLORS.line}`, background: "#fff", fontSize: 13, fontWeight: 600, color: COLORS.ink, cursor: loadingMore ? "not-allowed" : "pointer" }}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
