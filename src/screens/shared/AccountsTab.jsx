import { useState } from "react";
import { Check, LogOut, Mail, Plus, Trash2, UserPlus, X } from "lucide-react";
import Card from "../../components/Card";
import { COLORS } from "../../lib/theme";
import { spawnRipple } from "../../lib/ripple";
import { useToast } from "../../lib/ToastContext";

const ROLE_LABELS = { admin: "Admin", staff: "Staff" };

// Admin-only screen. Listing accounts is a normal authenticated read; the
// actual credential/create/delete changes are delegated to the
// admin-reset-credentials Edge Function via useAccounts(), which re-checks
// the caller's admin role server-side regardless of what this screen shows.
// Force-logout is a plain device_sessions update — permitted by that
// table's admin-or-owner RLS policy, no Edge Function needed. Contact email
// is reference-only (never used for login) — see migration 0005.
// This app is built around exactly one admin + one staff account: deleting
// one leaves a "Create <role> account" card in its place instead of a
// second row for the same role.
export default function AccountsTab({ accounts, currentUsername, onReset, onCreate, onDelete, onForceLogout, onSaveEmail }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [editingEmail, setEditingEmail] = useState(null);
  const [deletingAccount, setDeletingAccount] = useState(null);
  const [creatingRole, setCreatingRole] = useState(null);
  const [loggingOut, setLoggingOut] = useState(null);

  const missingRoles = ["admin", "staff"].filter((r) => !accounts.some((a) => a.role === r));

  const forceLogout = async (account) => {
    setLoggingOut(account.id);
    try {
      await onForceLogout(account.id);
      toast.success(`${account.name} was signed out of all devices`);
    } catch (err) {
      toast.error(err.message || "Couldn't force logout that account.");
    } finally {
      setLoggingOut(null);
    }
  };

  return (
    <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.line}` }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Accounts</h3>
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "2px 0 0" }}>Change the username or PIN for any account.</p>
        </div>
        <div style={{ padding: 8 }}>
          {accounts.map((a) => (
            <div key={a.id} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 12 }}>
              <div
                style={{ width: 40, height: 40, borderRadius: 999, background: a.role === "admin" ? COLORS.accent : COLORS.blue, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}
              >
                {a.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, margin: 0 }}>
                  {a.name}
                  {a.username === currentUsername && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.green, background: COLORS.greenBg, padding: "2px 6px", borderRadius: 6, marginLeft: 8 }}>
                      You
                    </span>
                  )}
                </p>
                <p style={{ fontSize: 12, color: COLORS.muted, margin: 0 }}>
                  {a.label} · <span style={{ fontFamily: "ui-monospace, monospace" }}>{a.username}</span>
                  {" · "}
                  {a.activeDevices} device{a.activeDevices !== 1 ? "s" : ""} active
                </p>
                <p style={{ fontSize: 12, color: a.contactEmail ? COLORS.muted : COLORS.faint, margin: "2px 0 0" }}>
                  {a.contactEmail || "No contact email set"}
                </p>
              </div>
              <button
                onClick={() => setEditingEmail(a)}
                title="Set contact email"
                className="press"
                style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${COLORS.line}`, background: "#fff", color: COLORS.muted, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
              >
                <Mail size={15} />
              </button>
              <button
                onClick={() => forceLogout(a)}
                disabled={a.activeDevices === 0 || loggingOut === a.id}
                title="Sign this account out of every device"
                className="press"
                style={{
                  height: 36,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: `1px solid ${COLORS.line}`,
                  background: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  color: a.activeDevices === 0 ? COLORS.faint : COLORS.red,
                  cursor: a.activeDevices === 0 || loggingOut === a.id ? "not-allowed" : "pointer",
                  opacity: loggingOut === a.id ? 0.6 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <LogOut size={14} /> {loggingOut === a.id ? "Signing out…" : "Force logout"}
              </button>
              <button
                onClick={() => setEditing(a)}
                className="press"
                style={{ height: 36, padding: "0 14px", borderRadius: 10, border: `1px solid ${COLORS.line}`, background: "#fff", fontSize: 13, fontWeight: 600, color: COLORS.ink, cursor: "pointer" }}
              >
                Reset login
              </button>
              <button
                onClick={() => setDeletingAccount(a)}
                disabled={a.username === currentUsername}
                title={a.username === currentUsername ? "You can't delete the account you're signed in as" : "Delete account"}
                className="press"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: "none",
                  background: a.username === currentUsername ? COLORS.soft : COLORS.redBg,
                  color: a.username === currentUsername ? COLORS.faint : COLORS.red,
                  cursor: a.username === currentUsername ? "not-allowed" : "pointer",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}

          {missingRoles.map((role) => (
            <button
              key={role}
              onClick={() => setCreatingRole(role)}
              className="press"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 12,
                borderRadius: 12,
                border: `2px dashed ${COLORS.line}`,
                background: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 999, border: `2px dashed ${COLORS.line}`, display: "grid", placeItems: "center", flexShrink: 0, color: COLORS.faint }}>
                <Plus size={18} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, margin: 0 }}>Create {ROLE_LABELS[role]} account</p>
                <p style={{ fontSize: 12, color: COLORS.faint, margin: 0 }}>No {role} account exists right now.</p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {editing && (
        <ResetLoginModal
          account={editing}
          accounts={accounts}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            await onReset(editing.role, payload);
            setEditing(null);
          }}
        />
      )}

      {editingEmail && (
        <EmailModal
          account={editingEmail}
          onClose={() => setEditingEmail(null)}
          onSave={async (email) => {
            await onSaveEmail(editingEmail.id, email);
            setEditingEmail(null);
          }}
        />
      )}

      {deletingAccount && (
        <DeleteAccountModal
          account={deletingAccount}
          onClose={() => setDeletingAccount(null)}
          onConfirm={async () => {
            await onDelete(deletingAccount.role);
            setDeletingAccount(null);
          }}
        />
      )}

      {creatingRole && (
        <CreateAccountModal
          role={creatingRole}
          accounts={accounts}
          onClose={() => setCreatingRole(null)}
          onCreate={async (payload) => {
            await onCreate(creatingRole, payload);
            setCreatingRole(null);
          }}
        />
      )}
    </div>
  );
}

function EmailModal({ account, onClose, onSave }) {
  const toast = useToast();
  const [email, setEmail] = useState(account.contactEmail || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inputStyle = { width: "100%", height: 44, padding: "0 14px", borderRadius: 12, border: "1px solid transparent", background: COLORS.soft, fontSize: 14, color: COLORS.ink, boxSizing: "border-box" };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: COLORS.ink, marginBottom: 6 };

  const submit = async () => {
    const trimmed = email.trim();
    if (trimmed && !/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError("That doesn't look like a valid email.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(trimmed);
      toast.success(`${account.name}'s contact email was saved`);
    } catch (err) {
      setError(err.message || "Couldn't save that email.");
      toast.error(err.message || "Couldn't save that email.");
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 16, background: "rgba(28,25,23,0.45)", animation: "fadeIn .2s ease" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 24, width: "100%", maxWidth: 400, animation: "popIn .25s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${COLORS.line}` }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Contact email</h3>
            <p style={{ fontSize: 12, color: COLORS.faint, margin: "2px 0 0" }}>{account.name}</p>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: COLORS.soft, display: "grid", placeItems: "center", cursor: "pointer", color: COLORS.muted }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              style={inputStyle}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              placeholder="name@example.com"
              autoCapitalize="none"
              inputMode="email"
            />
          </div>
          <p style={{ fontSize: 12, color: COLORS.faint, margin: 0 }}>
            Reference only — this is not used to sign in. Login still works with username + PIN.
          </p>
          {error && (
            <div style={{ padding: 12, borderRadius: 12, background: COLORS.redBg }}>
              <p style={{ fontSize: 13, color: COLORS.red, margin: 0 }}>{error}</p>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, padding: "14px 20px", borderTop: `1px solid ${COLORS.line}` }}>
          <button
            onClick={onClose}
            style={{ height: 44, padding: "0 16px", borderRadius: 12, border: `1px solid ${COLORS.line}`, background: "#fff", fontSize: 14, fontWeight: 600, color: COLORS.muted, cursor: "pointer", marginLeft: "auto" }}
          >
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={submit}
            onMouseDown={spawnRipple}
            className="press nx-ripple-host"
            style={{ height: 44, padding: "0 20px", borderRadius: 12, border: "none", background: COLORS.ink, color: "#fff", fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, display: "flex", alignItems: "center", gap: 8 }}
          >
            <Check size={16} /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetLoginModal({ account, accounts, onClose, onSave }) {
  const toast = useToast();
  const [username, setUsername] = useState(account.username);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const inputStyle = { width: "100%", height: 44, padding: "0 14px", borderRadius: 12, border: "1px solid transparent", background: COLORS.soft, fontSize: 14, color: COLORS.ink, boxSizing: "border-box" };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: COLORS.ink, marginBottom: 6 };

  const submit = async () => {
    const nextUsername = username.trim().toLowerCase();
    if (!nextUsername) {
      setError("Username can't be empty.");
      return;
    }
    if (accounts.some((a) => a.role !== account.role && a.username === nextUsername)) {
      setError("That username is already taken.");
      return;
    }
    if (pin || confirmPin) {
      if (!/^\d{6}$/.test(pin)) {
        setError("PIN must be exactly 6 digits.");
        return;
      }
      if (pin !== confirmPin) {
        setError("The two PINs don't match.");
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      const payload = { username: nextUsername };
      if (pin) payload.pin = pin;
      await onSave(payload);
      toast.success(`${account.name}'s login was reset`);
    } catch (err) {
      setError(err.message || "Couldn't reset this account.");
      toast.error(err.message || "Couldn't reset this account.");
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 16, background: "rgba(28,25,23,0.45)", animation: "fadeIn .2s ease" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 24, width: "100%", maxWidth: 400, animation: "popIn .25s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${COLORS.line}` }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Reset login</h3>
            <p style={{ fontSize: 12, color: COLORS.faint, margin: "2px 0 0" }}>{account.name}</p>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: COLORS.soft, display: "grid", placeItems: "center", cursor: "pointer", color: COLORS.muted }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Username</label>
            <input
              style={inputStyle}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              autoCapitalize="none"
            />
          </div>
          <div>
            <label style={labelStyle}>New PIN</label>
            <input
              style={inputStyle}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6));
                setError("");
              }}
              placeholder="Leave blank to keep current"
              inputMode="numeric"
              type="password"
            />
          </div>
          {pin && (
            <div>
              <label style={labelStyle}>Confirm new PIN</label>
              <input
                style={inputStyle}
                value={confirmPin}
                onChange={(e) => {
                  setConfirmPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6));
                  setError("");
                }}
                placeholder="Type it again"
                inputMode="numeric"
                type="password"
              />
            </div>
          )}
          {error && (
            <div style={{ padding: 12, borderRadius: 12, background: COLORS.redBg }}>
              <p style={{ fontSize: 13, color: COLORS.red, margin: 0 }}>{error}</p>
            </div>
          )}
          <p style={{ fontSize: 12, color: COLORS.faint, margin: 0 }}>
            Leave the PIN blank to change only the username. PINs must be 6 digits.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, padding: "14px 20px", borderTop: `1px solid ${COLORS.line}` }}>
          <button
            onClick={onClose}
            style={{ height: 44, padding: "0 16px", borderRadius: 12, border: `1px solid ${COLORS.line}`, background: "#fff", fontSize: 14, fontWeight: 600, color: COLORS.muted, cursor: "pointer", marginLeft: "auto" }}
          >
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={submit}
            onMouseDown={spawnRipple}
            className="press nx-ripple-host"
            style={{ height: 44, padding: "0 20px", borderRadius: 12, border: "none", background: COLORS.ink, color: "#fff", fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, display: "flex", alignItems: "center", gap: 8 }}
          >
            <Check size={16} /> {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteAccountModal({ account, onClose, onConfirm }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setConfirming(true);
    setError("");
    try {
      await onConfirm();
      toast.success(`${account.name}'s account was deleted`);
    } catch (err) {
      setError(err.message || "Couldn't delete this account.");
      toast.error(err.message || "Couldn't delete this account.");
      setConfirming(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 16, background: "rgba(28,25,23,0.45)", animation: "fadeIn .2s ease" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 24, width: "100%", maxWidth: 380, animation: "popIn .25s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${COLORS.line}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Delete account?</h3>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: COLORS.soft, display: "grid", placeItems: "center", cursor: "pointer", color: COLORS.muted }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 14, color: COLORS.ink, margin: 0 }}>
            This permanently deletes <strong>{account.name}</strong>'s login (username <span style={{ fontFamily: "ui-monospace, monospace" }}>{account.username}</span>). Sales,
            menu, and inventory data are unaffected — this only removes the ability to sign in as this account.
          </p>
          <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>
            You can create a new {ROLE_LABELS[account.role]?.toLowerCase()} account afterward from this same screen.
          </p>
          {error && (
            <div style={{ padding: 12, borderRadius: 12, background: COLORS.redBg }}>
              <p style={{ fontSize: 13, color: COLORS.red, margin: 0 }}>{error}</p>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, padding: "14px 20px", borderTop: `1px solid ${COLORS.line}` }}>
          <button
            onClick={onClose}
            style={{ height: 44, padding: "0 16px", borderRadius: 12, border: `1px solid ${COLORS.line}`, background: "#fff", fontSize: 14, fontWeight: 600, color: COLORS.muted, cursor: "pointer", marginLeft: "auto" }}
          >
            Cancel
          </button>
          <button
            disabled={confirming}
            onClick={submit}
            onMouseDown={spawnRipple}
            className="press nx-ripple-host"
            style={{ height: 44, padding: "0 20px", borderRadius: 12, border: "none", background: COLORS.red, color: "#fff", fontSize: 14, fontWeight: 600, cursor: confirming ? "not-allowed" : "pointer", opacity: confirming ? 0.6 : 1, display: "flex", alignItems: "center", gap: 8 }}
          >
            <Trash2 size={16} /> {confirming ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateAccountModal({ role, accounts, onClose, onCreate }) {
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const inputStyle = { width: "100%", height: 44, padding: "0 14px", borderRadius: 12, border: "1px solid transparent", background: COLORS.soft, fontSize: 14, color: COLORS.ink, boxSizing: "border-box" };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: COLORS.ink, marginBottom: 6 };

  const submit = async () => {
    const nextUsername = username.trim().toLowerCase();
    if (!nextUsername || nextUsername.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    if (accounts.some((a) => a.username === nextUsername)) {
      setError("That username is already taken.");
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError("PIN must be exactly 6 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setError("The two PINs don't match.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onCreate({ username: nextUsername, pin });
      toast.success(`${ROLE_LABELS[role]} account created`);
    } catch (err) {
      setError(err.message || "Couldn't create this account.");
      toast.error(err.message || "Couldn't create this account.");
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 16, background: "rgba(28,25,23,0.45)", animation: "fadeIn .2s ease" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 24, width: "100%", maxWidth: 400, animation: "popIn .25s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${COLORS.line}` }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Create {ROLE_LABELS[role]} account</h3>
            <p style={{ fontSize: 12, color: COLORS.faint, margin: "2px 0 0" }}>Sets up a brand new login for this role.</p>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: COLORS.soft, display: "grid", placeItems: "center", cursor: "pointer", color: COLORS.muted }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Username</label>
            <input
              style={inputStyle}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              placeholder="e.g. maria"
              autoCapitalize="none"
              autoFocus
            />
          </div>
          <div>
            <label style={labelStyle}>PIN</label>
            <input
              style={inputStyle}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6));
                setError("");
              }}
              placeholder="6 digits"
              inputMode="numeric"
              type="password"
            />
          </div>
          <div>
            <label style={labelStyle}>Confirm PIN</label>
            <input
              style={inputStyle}
              value={confirmPin}
              onChange={(e) => {
                setConfirmPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6));
                setError("");
              }}
              placeholder="Type it again"
              inputMode="numeric"
              type="password"
            />
          </div>
          {error && (
            <div style={{ padding: 12, borderRadius: 12, background: COLORS.redBg }}>
              <p style={{ fontSize: 13, color: COLORS.red, margin: 0 }}>{error}</p>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, padding: "14px 20px", borderTop: `1px solid ${COLORS.line}` }}>
          <button
            onClick={onClose}
            style={{ height: 44, padding: "0 16px", borderRadius: 12, border: `1px solid ${COLORS.line}`, background: "#fff", fontSize: 14, fontWeight: 600, color: COLORS.muted, cursor: "pointer", marginLeft: "auto" }}
          >
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={submit}
            onMouseDown={spawnRipple}
            className="press nx-ripple-host"
            style={{ height: 44, padding: "0 20px", borderRadius: 12, border: "none", background: COLORS.ink, color: "#fff", fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, display: "flex", alignItems: "center", gap: 8 }}
          >
            <UserPlus size={16} /> {saving ? "Creating…" : "Create account"}
          </button>
        </div>
      </div>
    </div>
  );
}
