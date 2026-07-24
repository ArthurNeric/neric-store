// supabase/functions/admin-reset-credentials/index.ts
//
// Backs the Admin "Accounts" screen — reset, delete, and (re)create the
// store's two accounts. All three need the service-role key, which must
// never reach client code, so this function:
//   1. Verifies the caller is a signed-in admin (checked against *their own*
//      JWT — never trust a role claim sent in the request body).
//   2. Uses a service-role client to perform the requested action.
//
// This app is built around exactly one admin and one staff account:
//   - action "reset" (default, backward-compatible with the original
//     payload shape): change the existing target role's username/PIN.
//   - action "delete": remove that role's account entirely. Blocked if it's
//     the caller's own account — deleting yourself while signed in as it
//     would lock you out with no other admin able to recreate it.
//   - action "create": only allowed when that role currently has NO
//     account, so there's never more than one per role.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const USERNAME_EMAIL_DOMAIN = "neric-store.internal"; // must match src/lib/supabaseClient.js
const PIN_PATTERN = /^\d{6}$/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validUsername(u: string | null) {
  return u && u.length >= 3;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Scoped to the caller's own JWT — can only ever tell us who they are and
  // confirm their role. It cannot modify anyone.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();

  if (callerError || !caller) {
    return json({ error: "Not signed in" }, 401);
  }

  const { data: callerProfile, error: profileError } = await callerClient
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single();

  if (profileError || !callerProfile || callerProfile.role !== "admin") {
    return json({ error: "Only an admin can manage accounts." }, 403);
  }

  let payload: { action?: string; target_role?: string; username?: string; pin?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = payload?.action ?? "reset";
  const targetRole = payload?.target_role;
  const nextUsername = payload?.username ? String(payload.username).trim().toLowerCase() : null;
  const nextPin = payload?.pin ? String(payload.pin).trim() : null;

  if (targetRole !== "staff" && targetRole !== "admin") {
    return json({ error: "target_role must be 'staff' or 'admin'" }, 400);
  }

  // Everything from here acts with full privileges.
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // ---------------------------------------------------------------- delete
  if (action === "delete") {
    const { data: targetProfile, error: targetError } = await admin
      .from("profiles")
      .select("id")
      .eq("role", targetRole)
      .single();

    if (targetError || !targetProfile) {
      return json({ error: `No ${targetRole} account found.` }, 404);
    }
    if (targetProfile.id === caller.id) {
      return json({ error: "You can't delete the account you're currently signed in as." }, 400);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(targetProfile.id);
    if (deleteError) {
      return json({ error: deleteError.message }, 400);
    }
    return json({ ok: true, deleted: targetRole });
  }

  // ---------------------------------------------------------------- create
  if (action === "create") {
    if (!validUsername(nextUsername)) {
      return json({ error: "Username must be at least 3 characters." }, 400);
    }
    if (!nextPin || !PIN_PATTERN.test(nextPin)) {
      return json({ error: "PIN must be exactly 6 digits." }, 400);
    }

    const { data: existing } = await admin.from("profiles").select("id").eq("role", targetRole).maybeSingle();
    if (existing) {
      return json({ error: `A ${targetRole} account already exists — delete it first if you want to replace it.` }, 409);
    }

    const { data: clash } = await admin.from("profiles").select("id").eq("username", nextUsername).maybeSingle();
    if (clash) {
      return json({ error: "That username is already taken." }, 409);
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: `${nextUsername}@${USERNAME_EMAIL_DOMAIN}`,
      password: nextPin,
      email_confirm: true,
      user_metadata: { username: nextUsername, full_name: "", role: targetRole },
    });
    if (createError || !created?.user) {
      return json({ error: createError?.message || "Couldn't create that account." }, 400);
    }

    return json({ ok: true, created: targetRole, username: nextUsername });
  }

  // ----------------------------------------------------------------- reset
  if (!nextUsername && !nextPin) {
    return json({ error: "Provide a new username, a new PIN, or both." }, 400);
  }
  if (nextUsername && !validUsername(nextUsername)) {
    return json({ error: "Username must be at least 3 characters." }, 400);
  }
  if (nextPin && !PIN_PATTERN.test(nextPin)) {
    return json({ error: "PIN must be exactly 6 digits." }, 400);
  }

  const { data: targetProfile, error: targetError } = await admin
    .from("profiles")
    .select("id, username")
    .eq("role", targetRole)
    .single();

  if (targetError || !targetProfile) {
    return json({ error: `No ${targetRole} account found.` }, 404);
  }

  if (nextUsername && nextUsername !== targetProfile.username) {
    const { data: clash } = await admin
      .from("profiles")
      .select("id")
      .eq("username", nextUsername)
      .neq("id", targetProfile.id)
      .maybeSingle();
    if (clash) {
      return json({ error: "That username is already taken." }, 409);
    }
  }

  const updateAttrs: Record<string, unknown> = {};
  if (nextUsername) {
    updateAttrs.email = `${nextUsername}@${USERNAME_EMAIL_DOMAIN}`;
    updateAttrs.email_confirm = true;
    updateAttrs.user_metadata = { username: nextUsername };
  }
  if (nextPin) {
    updateAttrs.password = nextPin;
  }

  const { error: updateAuthError } = await admin.auth.admin.updateUserById(
    targetProfile.id,
    updateAttrs
  );
  if (updateAuthError) {
    return json({ error: updateAuthError.message }, 400);
  }

  if (nextUsername) {
    const { error: updateProfileError } = await admin
      .from("profiles")
      .update({ username: nextUsername })
      .eq("id", targetProfile.id);
    if (updateProfileError) {
      return json({ error: updateProfileError.message }, 400);
    }
  }

  return json({ ok: true, username: nextUsername ?? targetProfile.username });
});
