import { Boxes, History, Package } from "lucide-react";
import Card from "../../components/Card";
import Skeleton from "../../components/Skeleton";
import { COLORS } from "../../lib/theme";
import { formatDateTime } from "../../lib/format";
import { useActivityLog } from "../../hooks/useActivityLog";

// Admin-only. Only logs *creation* of new products/inventory items (not
// edits or deletes), and only shows the last 7 days — see useActivityLog.
export default function ActivityLogTab() {
  const { entries, loading, error } = useActivityLog();

  return (
    <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.line}`, display: "flex", alignItems: "center", gap: 8 }}>
          <History size={16} color={COLORS.muted} />
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Recently added</h3>
            <p style={{ fontSize: 12, color: COLORS.faint, margin: "2px 0 0" }}>New menu and inventory items from the last 7 days.</p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={48} radius={10} />
            ))}
          </div>
        ) : error ? (
          <p style={{ padding: 40, textAlign: "center", color: COLORS.red, fontSize: 13 }}>{error}</p>
        ) : entries.length === 0 ? (
          <p style={{ fontSize: 13, color: COLORS.faint, padding: 40, textAlign: "center" }}>Nothing added in the last 7 days.</p>
        ) : (
          <div style={{ padding: 8 }}>
            {entries.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: e.entityType === "product" ? COLORS.gold : COLORS.blue,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  {e.entityType === "product" ? <Package size={15} color="#fff" /> : <Boxes size={15} color="#fff" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.emoji ? `${e.emoji} ` : ""}
                    {e.name}
                  </p>
                  <p style={{ fontSize: 12, color: COLORS.faint, margin: 0 }}>
                    Added to {e.entityType === "product" ? "Menu" : "Inventory"}
                    {e.actor ? ` by ${e.actor}` : ""}
                  </p>
                </div>
                <p style={{ fontSize: 12, color: COLORS.faint, margin: 0, flexShrink: 0, textAlign: "right" }}>{formatDateTime(e.when)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
