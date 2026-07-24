import { useEffect, useState } from "react";
import Logo from "./Logo";
import { COLORS, FONT_SERIF, FONT_STACK } from "../lib/theme";

// Personalized "Welcome back / <admin name>" splash shown once each time the
// Admin dashboard mounts.
export default function WelcomeBackOverlay({ name, onDone }) {
  const [rising, setRising] = useState(false);

  useEffect(() => {
    const riseTimer = setTimeout(() => setRising(true), 1900);
    const doneTimer = setTimeout(() => onDone?.(), 2500);
    return () => {
      clearTimeout(riseTimer);
      clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        background: COLORS.ink,
        fontFamily: FONT_STACK,
        opacity: rising ? 0 : 1,
        transition: "opacity .55s ease",
      }}
    >
      <div style={{ textAlign: "center", transform: rising ? "translateY(-8px)" : "none", transition: "transform .55s ease" }}>
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: 24,
            background: "#fff",
            margin: "0 auto",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            animation: "popIn .6s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          <Logo size={64} />
        </div>
        <p
          style={{
            fontSize: 13,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: COLORS.muted,
            margin: "24px 0 0",
            animation: "upIn .6s ease .15s both",
          }}
        >
          Welcome back
        </p>
        <h1
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 30,
            fontWeight: 600,
            color: "#FBF8F2",
            margin: "8px 0 0",
            animation: "upIn .6s ease .3s both",
          }}
        >
          {name}
        </h1>
        <div
          style={{
            height: 3,
            borderRadius: 999,
            background: COLORS.accent,
            margin: "22px auto 0",
            width: 120,
            animation: "barGrow 1.4s ease .5s both",
          }}
        />
      </div>
    </div>
  );
}
