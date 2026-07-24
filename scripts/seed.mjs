#!/usr/bin/env node
// One-time setup: creates the two accounts this app expects (staff + admin)
// and seeds a starter menu + inventory so the app isn't empty on first run.
//
// Usage (from the project root, after `npm install`):
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxxx node scripts/seed.mjs
//
// Requires the *service role* key (Supabase dashboard: Project Settings ->
// API -> service_role, "secret"). Never put that key in the frontend .env —
// it belongs only here, run once from a trusted machine, then thrown away.
// Safe to re-run: it skips accounts/data that already exist.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars before running this script."
  );
  process.exit(1);
}

// Must match USERNAME_EMAIL_DOMAIN in src/lib/supabaseClient.js — usernames
// are mapped to this fixed internal domain so Supabase Auth (which requires
// an email) can still be driven by a plain "username".
const USERNAME_EMAIL_DOMAIN = "neric-store.internal";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function randomPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function ensureAccount({ username, fullName, role, pin }) {
  const email = `${username}@${USERNAME_EMAIL_DOMAIN}`;
  const { error } = await admin.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
    user_metadata: { username, full_name: fullName, role },
  });

  if (error) {
    if (String(error.message).toLowerCase().includes("already been registered")) {
      console.log(`- ${username}: account already exists, leaving credentials as-is.`);
      return;
    }
    throw error;
  }

  console.log(
    `- ${username} (${role}): PIN is ${pin} — sign in once, then change it from the Accounts screen.`
  );
}

async function seedProducts() {
  const { count, error: countError } = await admin
    .from("products")
    .select("id", { count: "exact", head: true });
  if (countError) throw countError;
  if (count && count > 0) {
    console.log(`- products: ${count} already exist, skipping starter menu.`);
    return;
  }

  const items = [
    { name: "Regular Fries", price: 45, cost: 20, category: "Fries", emoji: "🍟", is_favorite: true },
    { name: "Large Fries", price: 65, cost: 28, category: "Fries", emoji: "🍟", is_favorite: true },
    { name: "Cheese Fries", price: 75, cost: 32, category: "Fries", emoji: "🧀", is_favorite: true },
    { name: "BBQ Fries", price: 70, cost: 30, category: "Fries", emoji: "🍖", is_favorite: false },
    { name: "Coke", price: 35, cost: 15, category: "Drinks", emoji: "🥤", is_favorite: true },
    { name: "Sprite", price: 35, cost: 15, category: "Drinks", emoji: "🥤", is_favorite: false },
    { name: "Iced Tea", price: 40, cost: 18, category: "Drinks", emoji: "🧃", is_favorite: true },
    { name: "Bottled Water", price: 25, cost: 10, category: "Drinks", emoji: "💧", is_favorite: true },
  ];
  const { error } = await admin.from("products").insert(items);
  if (error) throw error;
  console.log(`- products: seeded ${items.length} starter menu items.`);
}

async function seedInventory() {
  const { count, error: countError } = await admin
    .from("inventory_items")
    .select("id", { count: "exact", head: true });
  if (countError) throw countError;
  if (count && count > 0) {
    console.log(`- inventory_items: ${count} already exist, skipping starter stock.`);
    return;
  }

  const items = [
    { name: "Potatoes (frozen cut)", unit: "kg", qty: 18.5, cost: 85, emoji: "🥔" },
    { name: "Cooking oil", unit: "L", qty: 12, cost: 75, emoji: "🧴" },
    { name: "Cheese powder", unit: "g", qty: 1400, cost: 1.2, emoji: "🧀" },
    { name: "BBQ powder", unit: "g", qty: 320, cost: 1.5, emoji: "🌶️" },
    { name: "Fries cups", unit: "pcs", qty: 240, cost: 2.5, emoji: "🥤" },
    { name: "Cups 16oz", unit: "pcs", qty: 180, cost: 3, emoji: "🥤" },
  ];
  const { error } = await admin.from("inventory_items").insert(items);
  if (error) throw error;
  console.log(`- inventory_items: seeded ${items.length} starter stock items.`);
}

async function main() {
  console.log("Creating accounts...");
  await ensureAccount({ username: "admin", fullName: "Flordeliza Neric", role: "admin", pin: randomPin() });
  await ensureAccount({ username: "staff", fullName: "Employee", role: "staff", pin: randomPin() });

  console.log("Seeding starter data...");
  await seedProducts();
  await seedInventory();

  console.log("\nDone. Sign in at the app with the username/PIN pairs printed above.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
