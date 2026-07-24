import { useState } from "react";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import Logo from "../components/Logo";
import LoginBackdrop from "../components/LoginBackdrop";
import { COLORS, FONT_SERIF, FONT_STACK } from "../lib/theme";
import { spawnRipple } from "../lib/ripple";

// Real sign-in: `signIn` is useAuth().signIn, which calls
// supabase.auth.signInWithPassword and returns the caller's profile row (or
// throws). No client-side account lookup — Supabase Auth does the real
// hashed-password check.
export default function LoginScreen({ signIn }) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [signingInName, setSigningInName] = useState("");

  const submit = async () => {
    if (signingIn) return;
    setError("");
    if (!username.trim() || !pin.trim()) {
      setError("Enter your username and PIN.");
      return;
    }
    setSigningIn(true);
    try {
      const profile = await signIn(username.trim(), pin.trim());
      setSigningInName(profile.full_name || profile.username);
      // App swaps to the dashboard automatically once the session lands.
    } catch (err) {
      setSigningIn(false);
      setError(err.message || "That username and PIN don't match an account.");
    }
  };

  if (signingIn) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: COLORS.bg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          fontFamily: FONT_STACK,
        }}
      >
        <div style={{ position: "relative", width: 72, height: 72, display: "grid", placeItems: "center" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 24,
              border: "4px solid rgba(28,25,23,0.1)",
              borderTopColor: COLORS.ink,
              animation: "spin .7s linear infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 6,
              borderRadius: 18,
              background: "#fff",
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
            }}
          >
            <Logo size={40} />
          </div>
        </div>
        <p style={{ fontSize: 16, fontWeight: 600, color: COLORS.ink, margin: 0, animation: "upIn .5s ease both" }}>
          Signing in…
        </p>
        {signingInName && (
          <p style={{ fontSize: 13, color: COLORS.muted, margin: 0, animation: "upIn .5s ease .1s both" }}>
            {signingInName}
          </p>
        )}
      </div>
    );
  }

  const inputStyle = {
    width: "100%",
    height: 46,
    paddingLeft: 42,
    paddingRight: 16,
    borderRadius: 12,
    border: "1px solid transparent",
    background: COLORS.soft,
    fontSize: 14,
    color: COLORS.ink,
    boxSizing: "border-box",
  };

  return (
    <div
      className="nx-has-bg"
      style={{
        position: "relative",
        minHeight: "100vh",
        background: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 20px",
        fontFamily: FONT_STACK,
      }}
    >
      <LoginBackdrop />
      <div style={{ width: "100%", maxWidth: 384, animation: "upIn .5s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, justifyContent: "center" }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 16,
              background: "#fff",
              border: `1px solid ${COLORS.line}`,
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
            }}
          >
            <Logo size={40} />
          </div>
          <div>
            <p style={{ fontFamily: FONT_SERIF, fontSize: 16, fontWeight: 600, color: COLORS.ink, margin: 0, lineHeight: 1.2 }}>
              Neric Store
            </p>
            <p style={{ fontSize: 12, color: COLORS.faint, margin: 0 }}>Fries & drinks kiosk</p>
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 24,
            border: `1px solid ${COLORS.line2}`,
            boxShadow: "0 1px 2px rgba(28,25,23,0.03), 0 16px 40px -16px rgba(28,25,23,0.14)",
            padding: 28,
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Sign in</h1>
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "6px 0 22px" }}>
            Use the account for the job you're doing today.
          </p>

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.ink, marginBottom: 6 }}>
            Username
          </label>
          <div style={{ position: "relative", marginBottom: 16 }}>
            <User
              size={16}
              color={COLORS.faint}
              style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              style={inputStyle}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="username"
              autoCapitalize="none"
            />
          </div>

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.ink, marginBottom: 6 }}>
            PIN
          </label>
          <div style={{ position: "relative", marginBottom: 16 }}>
            <Lock
              size={16}
              color={COLORS.faint}
              style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              style={{ ...inputStyle, paddingRight: 44, letterSpacing: showPin ? "normal" : "0.3em" }}
              type={showPin ? "text" : "password"}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6));
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="6-digit PIN"
              inputMode="numeric"
            />
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "none",
                background: "none",
                display: "grid",
                placeItems: "center",
                color: COLORS.faint,
                cursor: "pointer",
              }}
            >
              <span style={{ position: "relative", width: 16, height: 16, display: "inline-block" }}>
                <Eye
                  size={16}
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: showPin ? 0 : 1,
                    transform: showPin ? "scale(0.5) rotate(-20deg)" : "scale(1) rotate(0deg)",
                    transition: "opacity .2s ease, transform .2s ease",
                  }}
                />
                <EyeOff
                  size={16}
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: showPin ? 1 : 0,
                    transform: showPin ? "scale(1) rotate(0deg)" : "scale(0.5) rotate(20deg)",
                    transition: "opacity .2s ease, transform .2s ease",
                  }}
                />
              </span>
            </button>
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: COLORS.redBg, animation: "popIn .2s ease" }}>
              <p style={{ fontSize: 13, color: COLORS.red, margin: 0 }}>{error}</p>
            </div>
          )}

          <button
            onClick={submit}
            onMouseDown={spawnRipple}
            className="press nx-ripple-host"
            style={{
              width: "100%",
              height: 48,
              borderRadius: 12,
              background: COLORS.ink,
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              transition: "background .15s",
            }}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
