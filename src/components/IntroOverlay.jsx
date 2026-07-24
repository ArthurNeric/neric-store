import { useEffect, useState } from "react";
import Logo from "./Logo";

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useSparks(count) {
  const [sparks] = useState(() =>
    Array.from({ length: count }, () => ({
      left: Math.round(Math.random() * 100),
      bottom: Math.round(Math.random() * 40),
      size: (3 + Math.random() * 5).toFixed(1),
      duration: (5 + Math.random() * 5).toFixed(2),
      delay: (Math.random() * 5).toFixed(2),
      warm: Math.random() > 0.65,
    }))
  );
  return sparks;
}

// Cinematic splash shown once per page load, before the login screen —
// reimplemented as a proper React component (was a MutationObserver-driven
// vanilla-JS overlay bolted onto the DOM in the original bundle).
export default function IntroOverlay({ onDone }) {
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(true);
  const sparkCount = typeof window !== "undefined" && window.innerWidth < 640 ? 10 : 18;
  const sparks = useSparks(sparkCount);

  useEffect(() => {
    const hold = prefersReducedMotion ? 400 : 2900;
    const closeTimer = setTimeout(() => setClosing(true), hold);
    const removeTimer = setTimeout(() => {
      setMounted(false);
      onDone?.();
    }, hold + 750);
    return () => {
      clearTimeout(closeTimer);
      clearTimeout(removeTimer);
    };
    // Runs exactly once on mount — intentionally ignores onDone identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  return (
    <div id="nx-intro" className={closing ? "nx-out" : ""} role="status" aria-label="Neric Store">
      <div className="nx-mesh" />
      {sparks.map((s, i) => (
        <span
          key={i}
          className={`nx-spark${s.warm ? " nx-spark-warm" : ""}`}
          style={{
            left: `${s.left}%`,
            bottom: `${s.bottom}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
      <div className="nx-vignette" />
      <div className="nx-stage">
        <div className="nx-mark">
          <div className="nx-orbit" />
          <div className="nx-orbit nx-orbit2" />
          <div className="nx-orbit-dot" />
          <div className="nx-badge">
            <Logo className="nx-badge-mark" />
          </div>
        </div>
        <div className="nx-word">
          <h1>Neric Store</h1>
        </div>
        <div className="nx-tag">
          <p>Retail Management System</p>
        </div>
        <div className="nx-bar">
          <span />
        </div>
      </div>
    </div>
  );
}
