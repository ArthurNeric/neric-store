# Neric Store

A single-store point-of-sale, inventory, and sales-reporting app: a Worker
view (Sell / Menu / Today / Inventory) and an Admin view (Overview / Reports
/ Menu / Inventory / Accounts), backed by Supabase (Postgres + Auth +
Storage).

This app was rebuilt from a minified demo bundle that had no backend at all
— every account, product, sale, and chart was hardcoded or held only in
React state. Everything now reads and writes real data. See
`.claude/plans` history or ask the maintainer for the full list of what
changed if you need it; the short version: real login, a real Postgres
database, real Storage-hosted photos, and analytics computed live from real
orders instead of a hand-written fake numbers object.

## One-time setup

### 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), create a new project.
2. In **Project Settings → API**, copy the **Project URL** and the
   **anon/public** key.
3. In **Project Settings → API**, also copy the **service_role** key —
   you'll need it once for seeding, but it must never go in `.env` or ship
   to the browser.

### 2. Configure the frontend

```bash
cp .env.example .env
# edit .env and paste in your Project URL + anon key
npm install
```

### 3. Run the database migration

Using the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

(Or paste the contents of `supabase/migrations/0001_init.sql` into the SQL
Editor in the Supabase dashboard and run it — same effect.)

This creates every table, Row Level Security policy, the Storage bucket for
product photos, and three Postgres functions the app depends on:
`create_order` (atomic checkout), `add_inventory_stock` (atomic stock
additions), and `report_summary` (the Overview/Reports analytics).

### 4. Deploy the Edge Function

The Accounts screen's "Reset login" action needs to change another
account's password, which requires the service-role key — something that
can only run on Supabase's servers, never in the browser:

```bash
supabase functions deploy admin-reset-credentials
```

No secrets to set for this one — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` are automatically available to every Edge
Function.

### 5. Seed the two accounts + starter data

This creates the `staff` and `admin` accounts (with random 6-digit PINs
printed to your terminal — write them down, then change them from the
Accounts screen after your first login) and a starter menu/inventory so the
app isn't empty on first run.

```bash
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
node scripts/seed.mjs
```

Safe to re-run — it skips anything that already exists.

### 6. Run it

```bash
npm run dev
```

Sign in with the `admin` or `staff` username and the PIN printed by the
seed script.

## Why usernames instead of email addresses?

Supabase Auth is email/password under the hood. To keep the exact
username + PIN sign-in experience, usernames are mapped to a fixed internal
email domain (`username@neric-store.internal`, see
`src/lib/supabaseClient.js`). Nobody ever sees or emails that address — it's
purely how the app talks to Supabase Auth. PINs must be 6 digits because
that's Supabase Auth's minimum password length.

## Project layout

```
src/
  lib/            Supabase client, formatting helpers, color tokens
  hooks/          useAuth, useProducts, useInventory, useOrders, useReports, useAccounts
  components/     Logo, Card, intro/welcome overlays, login backdrop
  screens/
    LoginScreen.jsx
    worker/       Sell, Today (+ shares MenuEditor/InventoryPanel)
    admin/        Overview, Reports (+ shares MenuEditor/InventoryPanel/AccountsTab)
    shared/       MenuEditor, InventoryPanel, AccountsTab — used by both roles
supabase/
  migrations/     Schema, RLS policies, RPC functions, Storage bucket
  functions/      admin-reset-credentials Edge Function
scripts/
  seed.mjs        One-time account + starter-data seeding script
```

## Notes on scope

- **Single store.** There's no sign-up flow and no multi-store switcher —
  matches the original UI, which only ever showed one staff + one admin
  account. The schema has no store-scoping columns; if you need
  multi-tenant support later, that's a schema migration, not a UI change.
- **Staff and Admin share full Menu/Inventory CRUD**, exactly like the
  original — both dashboards render the same components. The one real
  privilege boundary is Accounts → Reset login, enforced server-side in the
  Edge Function regardless of what any client sends.
- **Gross profit is real**, computed from each sold item's cost snapshot at
  time of sale (`order_items.cost`) — not the flat 44%-of-revenue guess the
  original mock used.
