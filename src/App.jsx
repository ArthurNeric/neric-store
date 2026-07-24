import { useCallback, useState } from "react";
import IntroOverlay from "./components/IntroOverlay";
import LoginScreen from "./screens/LoginScreen";
import WorkerDashboard from "./screens/worker/WorkerDashboard";
import AdminDashboard from "./screens/admin/AdminDashboard";
import { useAuth } from "./hooks/useAuth";
import { useSessionGuard } from "./hooks/useSessionGuard";
import { useToast } from "./lib/ToastContext";
import { COLORS } from "./lib/theme";

const EXPIRE_MESSAGES = {
  idle: "Signed out after an hour of inactivity.",
  revoked: "Signed out — this account reached its device limit or was signed out remotely.",
};

export default function App() {
  const auth = useAuth();
  const toast = useToast();
  const [showIntro, setShowIntro] = useState(true);

  const handleExpire = useCallback(
    (reason) => {
      toast.error(EXPIRE_MESSAGES[reason] || "Signed out.");
      auth.signOut();
    },
    [auth, toast]
  );

  useSessionGuard({ enabled: auth.isAuthenticated, deviceSessionId: auth.deviceSessionId, onExpire: handleExpire });

  return (
    <>
      {showIntro && <IntroOverlay onDone={() => setShowIntro(false)} />}
      <Router auth={auth} />
    </>
  );
}

function Router({ auth }) {
  if (auth.initializing) {
    // Restoring a persisted session — render a neutral background instead of
    // flashing the login form for a moment.
    return <div style={{ minHeight: "100vh", background: COLORS.bg }} />;
  }

  if (!auth.isAuthenticated) {
    return <LoginScreen signIn={auth.signIn} />;
  }

  if (auth.profile.role === "admin") {
    return <AdminDashboard profile={auth.profile} onSignOut={auth.signOut} />;
  }

  return <WorkerDashboard profile={auth.profile} onSignOut={auth.signOut} />;
}
