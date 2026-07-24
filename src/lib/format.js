// Formatting helpers, ported from the original build's `De`/`Vs`/`ef` helpers.
import { COLORS } from "./theme";

export function formatMoney(value) {
  return "₱" + Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 });
}

export function formatQty(value, unit) {
  const n = Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 });
  return unit && unit !== "count" ? `${n} ${unit}` : n;
}

export function formatClockTime(date = new Date()) {
  return date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
}

export function formatDateTime(date) {
  return (
    date.toLocaleDateString("en-PH", { month: "short", day: "numeric" }) +
    ", " +
    date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })
  );
}

export function categoryBackground(category) {
  if (category === "Fries") return "#FBF0DA";
  if (category === "Drinks") return "#E4F0F5";
  return "#F3EAD9";
}

// Solid accent per category — used for tab pills and the small category dot
// on product tiles, so each category reads as its own color at a glance.
export function categoryColor(category) {
  if (category === "Fries") return COLORS.gold;
  if (category === "Drinks") return COLORS.blue;
  return COLORS.accent;
}
