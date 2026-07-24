import { useEffect, useState } from "react";
import Logo from "./Logo";

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Generic dark "Welcome / Neric Store" splash shown once each time the
// Worker dashboard mounts (mirrors the Admin dashboard's welcome-back, but
// staff accounts aren't personalized by name in the original product).
export default function StaffWelcomeOverlay({ onDone }) {
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (prefersReducedMotion) {
      const t = setTimeout(() => {
        setMounted(false);
        onDone?.();
      }, 500);
      return () => clearTimeout(t);
    }
    const riseTimer = setTimeout(() => setClosing(true), 1900);
    const removeTimer = setTimeout(() => {
      setMounted(false);
      onDone?.();
    }, 2550);
    return () => {
      clearTimeout(riseTimer);
      clearTimeout(removeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  return (
    <div id="nx-welcome" className={closing ? "nx-rise nx-out" : ""}>
      <div className="nx-w-stage">
        <div className="nx-w-badge">
          <Logo className="nx-badge-mark" />
        </div>
        <h2>Welcome</h2>
        <p>Neric Store</p>
      </div>
    </div>
  );
}
