import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Receipt, TrendingUp, Wallet } from "lucide-react";
import Card from "../../components/Card";
import { COLORS } from "../../lib/theme";
import { formatMoney } from "../../lib/format";
import { useReports } from "../../hooks/useReports";
import { RangeTabs, ReportSkeleton, StatCard } from "./reportWidgets";

// The original mock faked gross profit as a flat 44% of revenue. Real cost
// and profit here come from report_summary(), which sums each sold item's
// cost snapshot (order_items.cost) — actual money, not an assumption.
export default function ReportsTab({ range, setRange }) {
  const { summary, loading } = useReports(range);

  if (!summary) {
    if (loading) return <ReportSkeleton />;
    return <div style={{ padding: 40, textAlign: "center", color: COLORS.faint }}>No data yet.</div>;
  }

  const avgOrder = summary.orders > 0 ? Math.round(summary.revenue / summary.orders) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <RangeTabs range={range} setRange={setRange} />
        <span style={{ fontSize: 13, color: COLORS.muted }}>{summary.caption}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard icon={Wallet} label="Revenue" value={summary.revenue} format={formatMoney} delta={summary.delta} sub={summary.prev} accent={COLORS.accent} />
        <StatCard icon={TrendingUp} label="Gross profit" value={summary.profit} format={formatMoney} sub={`${summary.margin}% margin`} accent={COLORS.green} />
        <StatCard icon={Receipt} label="Orders" value={summary.orders} delta={summary.oDelta} sub={summary.prev} accent={COLORS.blue} />
        <StatCard icon={Wallet} label="Average order" value={avgOrder} format={formatMoney} sub={`${summary.gcash}% GCash`} accent={COLORS.gold} />
      </div>

      <Card style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Revenue over time</h3>
        <p style={{ fontSize: 13, color: COLORS.muted, margin: "4px 0 16px" }}>{summary.caption}</p>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summary.series} margin={{ top: 5, right: 5, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E2" vertical={false} />
              <XAxis dataKey="x" tickLine={false} axisLine={false} tick={{ fill: COLORS.muted, fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: COLORS.muted, fontSize: 12 }}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
              />
              <Tooltip cursor={{ fill: COLORS.soft }} contentStyle={{ borderRadius: 12, border: `1px solid ${COLORS.line}`, fontSize: 13 }} formatter={(v) => [formatMoney(v), "Revenue"]} />
              <Bar dataKey="v" fill={COLORS.accent} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Where the money goes</h3>
        <p style={{ fontSize: 13, color: COLORS.muted, margin: "4px 0 16px" }}>{summary.caption}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            ["Revenue", summary.revenue, COLORS.ink],
            ["Cost of goods", summary.cost, COLORS.red],
            ["Gross profit", summary.profit, COLORS.green],
          ].map(([label, value, color]) => (
            <div key={label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6 }}>
                <span style={{ color: COLORS.muted }}>{label}</span>
                <span style={{ fontWeight: 700, color }}>{formatMoney(value)}</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: COLORS.soft, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    width: `${summary.revenue > 0 ? (value / summary.revenue) * 100 : 0}%`,
                    background: color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
