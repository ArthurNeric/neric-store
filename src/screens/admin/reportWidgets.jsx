import { TrendingDown, TrendingUp } from "lucide-react";
import Card from "../../components/Card";
import Skeleton from "../../components/Skeleton";
import { COLORS, FONT_SERIF } from "../../lib/theme";
import { useCountUp } from "../../hooks/useCountUp";

const RANGE_TABS = [
  { key: "24h", label: "24 hours" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "12m", label: "12 months" },
  { key: "all", label: "All time" },
];

export function DeltaBadge({ value }) {
  if (value === null || value === undefined) return null;
  const positive = value >= 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 500, color: positive ? COLORS.green : COLORS.red }}>
      {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {positive ? "+" : ""}
      {value}%
    </span>
  );
}

// `value` is the raw number; `format` turns the animated in-between values
// into a display string (defaults to a plain rounded integer).
export function StatCard({ icon: Icon, label, value, format = (v) => Math.round(v).toLocaleString(), sub, delta, accent }) {
  const animated = useCountUp(value);
  return (
    <Card style={{ padding: 22 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: COLORS.muted, fontWeight: 600, margin: 0 }}>{label}</p>
          <p style={{ fontFamily: FONT_SERIF, fontSize: 30, fontWeight: 600, color: COLORS.ink, margin: "10px 0 0", lineHeight: 1 }}>{format(animated)}</p>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <DeltaBadge value={delta} />
            {sub && <span style={{ fontSize: 13, color: COLORS.muted }}>{sub}</span>}
          </div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 999, display: "grid", placeItems: "center", flexShrink: 0, marginLeft: 12, background: accent }}>
          <Icon size={18} color="#fff" />
        </div>
      </div>
    </Card>
  );
}

// Shown while report_summary() is loading — mirrors the real layout (range
// tabs, 4 stat cards, a chart, a list) so the page doesn't jump around once
// data arrives.
export function ReportSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <Skeleton width={90} height={36} radius={12} />
        <Skeleton width={80} height={36} radius={12} />
        <Skeleton width={90} height={36} radius={12} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} style={{ padding: 22 }}>
            <Skeleton width={70} height={11} />
            <Skeleton width={100} height={28} style={{ marginTop: 12 }} />
            <Skeleton width={60} height={13} style={{ marginTop: 12 }} />
          </Card>
        ))}
      </div>
      <Card style={{ padding: 20 }}>
        <Skeleton width={120} height={15} />
        <Skeleton width={180} height={13} style={{ marginTop: 8 }} />
        <Skeleton height={220} radius={12} style={{ marginTop: 16 }} />
      </Card>
      <Card style={{ padding: 20 }}>
        <Skeleton width={140} height={15} />
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={40} radius={10} />
          ))}
        </div>
      </Card>
    </div>
  );
}

export function RangeTabs({ range, setRange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {RANGE_TABS.map((r) => {
        const active = range === r.key;
        return (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            style={{ height: 36, padding: "0 14px", borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: "pointer", border: "none", background: active ? COLORS.ink : "#fff", color: active ? "#fff" : COLORS.muted, boxShadow: active ? "none" : `inset 0 0 0 1px ${COLORS.line}` }}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
