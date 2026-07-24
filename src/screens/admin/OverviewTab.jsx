import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Boxes, Receipt, TrendingUp, Wallet } from "lucide-react";
import Card from "../../components/Card";
import { COLORS } from "../../lib/theme";
import { formatMoney } from "../../lib/format";
import { useReports } from "../../hooks/useReports";
import { RangeTabs, ReportSkeleton, StatCard } from "./reportWidgets";

// Real replacement for the old hardcoded `Sj[range]` object — everything
// here comes from report_summary(), which aggregates actual orders.
export default function OverviewTab({ stockCount, range, setRange }) {
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
        <StatCard icon={Wallet} label="Revenue" value={summary.revenue} format={formatMoney} delta={summary.delta} sub={summary.prev} accent={COLORS.green} />
        <StatCard icon={Receipt} label="Orders" value={summary.orders} delta={summary.oDelta} sub={summary.prev} accent={COLORS.accent} />
        <StatCard icon={TrendingUp} label="Average order" value={avgOrder} format={formatMoney} sub={`${summary.gcash}% GCash`} accent={COLORS.blue} />
        <StatCard icon={Boxes} label="Stock items" value={stockCount} sub="tracked" accent={COLORS.gold} />
      </div>

      <Card style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Revenue</h3>
        <p style={{ fontSize: 13, color: COLORS.muted, margin: "4px 0 16px" }}>{summary.caption}</p>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={summary.series} margin={{ top: 5, right: 5, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="overviewRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.accent} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E2" vertical={false} />
              <XAxis dataKey="x" tickLine={false} axisLine={false} tick={{ fill: COLORS.muted, fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: COLORS.muted, fontSize: 12 }}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
              />
              <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${COLORS.line}`, fontSize: 13 }} formatter={(v) => [formatMoney(v), "Revenue"]} />
              <Area type="monotone" dataKey="v" stroke={COLORS.accent} strokeWidth={2.5} fill="url(#overviewRevenueFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.line}` }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Best sellers</h3>
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "4px 0 0" }}>{summary.caption}</p>
        </div>
        <div style={{ padding: 12 }}>
          {summary.top.length === 0 ? (
            <p style={{ fontSize: 13, color: COLORS.faint, padding: 16, textAlign: "center" }}>No sales in this period yet.</p>
          ) : (
            summary.top.map((item, i) => (
              <div key={item.name} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 12 }}>
                <span style={{ width: 20, fontSize: 13, fontWeight: 700, color: COLORS.faint }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, margin: 0 }}>{item.name}</p>
                  <div style={{ marginTop: 6, height: 6, borderRadius: 999, background: COLORS.soft, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 999, background: COLORS.accent, width: `${(item.sold / summary.top[0].sold) * 100}%` }} />
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink, margin: 0 }}>{item.sold}</p>
                  <p style={{ fontSize: 12, color: COLORS.muted, margin: 0 }}>{formatMoney(item.rev)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
