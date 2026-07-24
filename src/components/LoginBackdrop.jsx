// Animated blurred blob backdrop shown only behind the login form.
export default function LoginBackdrop() {
  return (
    <div id="nx-bg" aria-hidden="true">
      <div className="nx-grid" />
      <div className="nx-blob nx-b1" />
      <div className="nx-blob nx-b2" />
      <div className="nx-blob nx-b3" />
      <div className="nx-blob nx-b4" />
      <div className="nx-shape nx-shape-ring" />
      <div className="nx-shape nx-shape-square" />
      <div className="nx-shape nx-shape-dot" />
      <div className="nx-shape nx-shape-ring2" />
      <div className="nx-shape nx-shape-triangle" />
      <div className="nx-shape nx-shape-bar" />
      <div className="nx-shape nx-shape-dot2" />
      <div className="nx-shape nx-shape-plus" />
    </div>
  );
}
