import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly in dev instead of silently talking to nothing.
  // eslint-disable-next-line no-console
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project's values."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Supabase Auth requires a real email address; usernames are mapped to a
// fixed internal domain so staff/admin can still "sign in with a username
// and PIN" exactly like the original UI. Must match scripts/seed.mjs.
const USERNAME_EMAIL_DOMAIN = "neric-store.internal";

export function usernameToEmail(username) {
  return `${String(username).trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
}
