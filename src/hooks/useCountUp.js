import { useEffect, useRef, useState } from "react";

// Animates a displayed number from its previous value to `target` whenever
// target changes (ease-out tween via rAF). Non-numeric targets pass through
// unchanged so callers can share one prop for both animated and static values.
export function useCountUp(target, duration = 700) {
  const numericTarget = typeof target === "number" ? target : Number(target);
  const isNumeric = Number.isFinite(numericTarget);

  const [display, setDisplay] = useState(numericTarget);
  const fromRef = useRef(numericTarget);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!isNumeric) return;
    const from = fromRef.current;
    const to = numericTarget;
    if (from === to) return;

    const start = performance.now();
    cancelAnimationFrame(rafRef.current);

    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericTarget, duration, isNumeric]);

  return isNumeric ? display : target;
}
