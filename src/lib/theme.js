// Color tokens & font stacks. Base neutrals (bg/ink/muted/faint/soft/line)
// unchanged; accent/green/blue/gold are the saturated set used for solid
// icon-circle badges (StatCard, avatar chips, section icons) throughout.
export const COLORS = {
  bg: "#FAF8F4",
  ink: "#1C1917",
  muted: "#78716C",
  faint: "#A8A29E",
  soft: "#F5F2EE",
  line: "rgba(28,25,23,0.08)",
  line2: "rgba(28,25,23,0.05)",
  accent: "#A8623F",
  green: "#3F6B4B",
  greenBg: "#EDF4EE",
  red: "#B4443A",
  redBg: "#FBEDEB",
  blue: "#2C5C86",
  blueBg: "#E7F0F7",
  gold: "#A87F3F",
  rose: "#B9667A",
  teal: "#3E7A78",
};

// Cycled across the saturated set for anything that wants deterministic
// per-item color variety (stock icon chips, etc.) — same key always maps to
// the same color so a given product/item reads consistently across renders.
const CYCLE_COLORS = [COLORS.accent, COLORS.green, COLORS.blue, COLORS.gold, COLORS.rose, COLORS.teal];
export function colorForKey(key) {
  const str = String(key ?? "");
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return CYCLE_COLORS[hash % CYCLE_COLORS.length];
}

export const FONT_STACK =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// Reserved for brand/hero moments only (wordmark, personalized welcome
// greeting) — every other heading stays on FONT_STACK.
export const FONT_SERIF = '"Fraunces", Georgia, "Times New Roman", serif';
