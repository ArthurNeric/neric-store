// Shimmering placeholder block shown in place of content while it loads.
export default function Skeleton({ width = "100%", height = 16, radius = 8, style }) {
  return <div className="nx-skeleton" style={{ width, height, borderRadius: radius, ...style }} />;
}
