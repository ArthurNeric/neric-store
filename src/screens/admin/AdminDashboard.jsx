import { useState } from "react";
import { BarChart3, Boxes, History, LayoutGrid, LogOut, Package, Receipt, User } from "lucide-react";
import Logo from "../../components/Logo";
import WelcomeBackOverlay from "../../components/WelcomeBackOverlay";
import { COLORS, FONT_SERIF, FONT_STACK } from "../../lib/theme";
import { useProducts } from "../../hooks/useProducts";
import { useInventory } from "../../hooks/useInventory";
import { useAccounts } from "../../hooks/useAccounts";
import OverviewTab from "./OverviewTab";
import ReportsTab from "./ReportsTab";
import SalesHistoryTab from "./SalesHistoryTab";
import ActivityLogTab from "./ActivityLogTab";
import MenuEditor from "../shared/MenuEditor";
import InventoryPanel from "../shared/InventoryPanel";
import AccountsTab from "../shared/AccountsTab";

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "sales", label: "Sales History", icon: Receipt },
  { key: "menu", label: "Menu", icon: Package },
  { key: "inventory", label: "Inventory", icon: Boxes },
  { key: "activity", label: "Activity", icon: History },
  { key: "accounts", label: "Accounts", icon: User },
];

const SUBTITLES = {
  overview: "How the shop is doing right now.",
  reports: "Sales and profit over any period.",
  sales: "Every sale ever recorded, updating live.",
  menu: "View and edit what the shop sells.",
  inventory: "View stock, add, and manage items.",
  activity: "New menu and inventory items from the last 7 days.",
  accounts: "Reset usernames, PINs, and manage devices.",
};

export default function AdminDashboard({ profile, onSignOut }) {
  const [tab, setTab] = useState("overview");
  const [range, setRange] = useState("7d");
  const [showWelcome, setShowWelcome] = useState(true);

  const { products, recipes, saveProduct, saveRecipe, deleteProduct, uploadImage } = useProducts();
  const { stock, history, addStock, createItem, updateItem, deleteItem, refresh: refreshInventory } = useInventory();
  const { accounts, resetCredentials, createAccount, deleteAccount, forceLogoutAccount, updateContactEmail } = useAccounts();

  const activeItem = NAV_ITEMS.find((n) => n.key === tab);

  const NavButton = ({ item, mobile }) => {
    const active = tab === item.key;
    return (
      <button
        onClick={() => setTab(item.key)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: mobile ? "auto" : "100%",
          padding: mobile ? "0 14px" : "0 12px",
          height: 40,
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 500,
          marginBottom: mobile ? 0 : 2,
          cursor: "pointer",
          border: "none",
          whiteSpace: "nowrap",
          background: active ? COLORS.ink : "transparent",
          color: active ? "#fff" : COLORS.muted,
        }}
      >
        <item.icon size={17} />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div style={{ height: "100vh", background: COLORS.bg, display: "flex", overflow: "hidden", fontFamily: FONT_STACK }}>
      {showWelcome && (
        <WelcomeBackOverlay name={profile.full_name || profile.username} onDone={() => setShowWelcome(false)} />
      )}

      <aside className="admin-side" style={{ width: 232, flexShrink: 0, borderRight: `1px solid ${COLORS.line}`, background: "#fff", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 20, borderBottom: `1px solid ${COLORS.line}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#fff", border: `1px solid ${COLORS.line}`, display: "grid", placeItems: "center", overflow: "hidden" }}>
              <Logo size={28} />
            </div>
            <div>
              <p style={{ fontFamily: FONT_SERIF, fontSize: 15, fontWeight: 600, color: COLORS.ink, margin: 0, lineHeight: 1.2 }}>Neric Store</p>
              <p style={{ fontSize: 11, color: COLORS.faint, margin: 0 }}>Owner dashboard</p>
            </div>
          </div>
        </div>
        <nav style={{ padding: 12, flex: 1 }}>
          {NAV_ITEMS.map((item) => (
            <NavButton key={item.key} item={item} />
          ))}
        </nav>
        <div style={{ padding: 12, borderTop: `1px solid ${COLORS.line}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 999, background: COLORS.accent, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {(profile.full_name || profile.username)
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {profile.full_name || profile.username}
              </p>
              <p style={{ fontSize: 11, color: COLORS.faint, margin: 0 }}>Owner · Admin</p>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="press"
            style={{ marginTop: 8, width: "100%", height: 40, borderRadius: 12, border: `1px solid ${COLORS.line}`, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14, fontWeight: 500, color: COLORS.muted, cursor: "pointer" }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ borderBottom: `1px solid ${COLORS.line}`, background: "#fff", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: COLORS.ink, margin: 0, lineHeight: 1.2 }}>{activeItem.label}</h1>
            <p style={{ fontSize: 13, color: COLORS.muted, margin: "2px 0 0" }}>{SUBTITLES[tab]}</p>
          </div>
          <button
            onClick={onSignOut}
            className="press"
            style={{ height: 40, padding: "0 16px", borderRadius: 12, border: `1px solid ${COLORS.line}`, background: "#fff", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 500, color: COLORS.muted, cursor: "pointer", flexShrink: 0 }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </header>

        <div className="admin-mnav" style={{ borderBottom: `1px solid ${COLORS.line}`, background: "#fff", padding: "8px 12px", display: "none", gap: 4, overflowX: "auto" }}>
          {NAV_ITEMS.map((item) => (
            <NavButton key={item.key} item={item} mobile />
          ))}
        </div>

        <main style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          <div className="page" key={tab}>
            {tab === "overview" && <OverviewTab stockCount={stock.length} range={range} setRange={setRange} />}
            {tab === "reports" && <ReportsTab range={range} setRange={setRange} />}
            {tab === "sales" && <SalesHistoryTab onOrderVoided={refreshInventory} />}
            {tab === "menu" && (
              <MenuEditor
                menu={products}
                recipes={recipes}
                inventoryOptions={stock}
                onSave={saveProduct}
                onSaveRecipe={saveRecipe}
                onDelete={deleteProduct}
                uploadImage={uploadImage}
              />
            )}
            {tab === "inventory" && (
              <InventoryPanel
                stock={stock}
                history={history}
                onAddStock={addStock}
                onCreateItem={createItem}
                onUpdateItem={updateItem}
                onDeleteItem={deleteItem}
              />
            )}
            {tab === "activity" && <ActivityLogTab />}
            {tab === "accounts" && (
              <AccountsTab
                accounts={accounts}
                currentUsername={profile.username}
                onReset={resetCredentials}
                onCreate={createAccount}
                onDelete={deleteAccount}
                onForceLogout={forceLogoutAccount}
                onSaveEmail={updateContactEmail}
              />
            )}
          </div>
        </main>
      </div>

      <style>{"@media(max-width:860px){.admin-side{display:none !important}.admin-mnav{display:flex !important}}"}</style>
    </div>
  );
}
