export default function Card({ children, style, className }) {
  return (
    <div
      className={className}
      style={{
        background: "#fff",
        border: "none",
        borderRadius: 22,
        boxShadow: "0 1px 2px rgba(28,25,23,0.04), 0 16px 36px -16px rgba(28,25,23,0.16)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
