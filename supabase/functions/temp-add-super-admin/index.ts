import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { email, password, name, account_id } = await req.json();

    let userId: string | null = null;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: name, must_change_password: true },
    });
    if (createErr) {
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users?.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
      if (!existing) throw createErr;
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, {
        password, email_confirm: true,
        user_metadata: { ...(existing.user_metadata || {}), full_name: name, must_change_password: true },
      });
    } else {
      userId = created.user!.id;
    }

    await admin.from("profiles").upsert({ user_id: userId, full_name: name }, { onConflict: "user_id" });

    const { error: amErr } = await admin.from("account_members").upsert(
      { account_id, user_id: userId, role: "admin", status: "active" },
      { onConflict: "account_id,user_id" },
    );
    if (amErr) throw amErr;

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
