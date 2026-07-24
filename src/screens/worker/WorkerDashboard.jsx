import { useState } from "react";
import { Boxes, LogOut, Package, Receipt, ShoppingBag } from "lucide-react";
import Logo from "../../components/Logo";
import StaffWelcomeOverlay from "../../components/StaffWelcomeOverlay";
import { COLORS, FONT_STACK } from "../../lib/theme";
import { useProducts } from "../../hooks/useProducts";
import { useInventory } from "../../hooks/useInventory";
import { useOrders } from "../../hooks/useOrders";
import SellTab from "./SellTab";
import TodayTab from "./TodayTab";
import MenuEditor from "../shared/MenuEditor";
import InventoryPanel from "../shared/InventoryPanel";

const NAV_TABS = [
  { key: "sell", label: "Sell", icon: ShoppingBag, sub: "Tap products, then checkout.", color: COLORS.accent },
  { key: "menu", label: "Menu", icon: Package, sub: "Edit names, prices, and photos.", color: COLORS.gold },
  { key: "today", label: "Today", icon: Receipt, sub: "Orders and the day's total.", color: COLORS.green },
  { key: "inventory", label: "Inventory", icon: Boxes, sub: "Add stock and see what came in.", color: COLORS.blue },
];

export default function WorkerDashboard({ profile, onSignOut }) {
  const [tab, setTab] = useState("sell");
  const [showWelcome, setShowWelcome] = useState(true);

  const { products, recipes, saveProduct, saveRecipe, deleteProduct, uploadImage } = useProducts();
  const { stock, history, addStock, createItem, updateItem, deleteItem, refresh: refreshInventory } = useInventory();
  const { orders, nextOrderNumber, checkout, removeOrder } = useOrders();

  const active = NAV_TABS.find((t) => t.key === tab);

  // checkout()/removeOrder() deduct or restore recipe ingredients server-side
  // (inside create_order/void_order), but that's a completely separate
  // useInventory() instance from the one InventoryPanel reads — it has no
  // way to know a sale just happened unless told to refetch.
  const handleCheckout = async (cartItems, paymentMethod) => {
    const result = await checkout(cartItems, paymentMethod);
    await refreshInventory();
    return result;
  };
  const handleRemoveOrder = async (id) => {
    await removeOrder(id);
    await refreshInventory();
  };

  return (
    <div style={{ height: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: FONT_STACK }}>
      {showWelcome && <StaffWelcomeOverlay onDone={() => setShowWelcome(false)} />}

      <header style={{ borderBottom: `1px solid ${COLORS.line}`, background: "#fff", padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "#fff", border: `1px solid ${COLORS.line}`, display: "grid", placeItems: "center", flexShrink: 0, overflow: "hidden" }}>
          <Logo size={30} />
        </div>
        <div style={{ display: "flex", gap: 4, flex: 1, overflowX: "auto" }}>
          {NAV_TABS.map((t) => {
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{ height: 40, padding: "0 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", border: "none", background: isActive ? t.color : "transparent", color: isActive ? "#fff" : COLORS.muted }}
              >
                <t.icon size={16} color={isActive ? "#fff" : t.color} /> {t.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div className="worker-who" style={{ textAlign: "right" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink, margin: 0, lineHeight: 1.2 }}>
              {profile.full_name || profile.username}
            </p>
            <p style={{ fontSize: 11, color: COLORS.faint, margin: 0 }}>Employee Dashboard</p>
          </div>
          <button onClick={onSignOut} title="Sign out" className="press" style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${COLORS.line}`, background: "#fff", display: "grid", placeItems: "center", color: COLORS.muted, cursor: "pointer" }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div style={{ padding: "16px 20px 4px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: active.color, flexShrink: 0 }} />
          <h1 style={{ fontSize: 19, fontWeight: 700, color: COLORS.ink, margin: 0, lineHeight: 1.2 }}>{active.label}</h1>
        </div>
        <p style={{ fontSize: 13, color: COLORS.muted, margin: "2px 0 0 16px" }}>{active.sub}</p>
      </div>

      <main style={{ flex: 1, padding: 20, minHeight: 0, display: "flex", flexDirection: "column", overflowY: tab === "sell" ? "hidden" : "auto" }}>
        <div className="page" key={tab} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          {tab === "sell" && <SellTab menu={products} orderNo={nextOrderNumber} onCheckout={handleCheckout} />}
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
          {tab === "today" && <TodayTab orders={orders} onRemove={handleRemoveOrder} />}
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
        </div>
      </main>

      <style>{"@media(max-width:600px){.worker-who{display:none}}"}</style>
    </div>
  );
}
