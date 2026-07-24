import { COLORS } from "../lib/theme";

// Bold geometric "N" mark, drawn as a single inline SVG path instead of a
// bitmap asset — crisp at every size it's used (16px nav icon to 100px intro
// badge) and themeable via `color`, with no external file to go stale.
export default function Logo({ size, color = COLORS.ink, className, style }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      style={{ display: "block", ...style }}
      role="img"
      aria-label="Neric Store"
    >
      <path
        d="M10 38 L10 10 L18 10 L30 31.5 L30 10 L38 10 L38 38 L30 38 L18 16.5 L18 38 Z"
        fill={color}
      />
    </svg>
  );
}
