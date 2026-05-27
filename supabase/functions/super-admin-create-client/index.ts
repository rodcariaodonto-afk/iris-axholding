// Cria uma nova conta cliente + convite inicial. Apenas super admins (owner/admin de conta interna) podem usar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" }[c] || c));
}

function slugify(s: string) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);

    // Verifica super admin: owner/admin de uma conta interna
    const { data: superCheck } = await admin
      .from("account_members")
      .select("role, account:accounts!inner(is_internal)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", ["owner", "admin"]);
    const isSuper = (superCheck || []).some((m: any) => m.account?.is_internal);
    if (!isSuper) {
      return new Response(JSON.stringify({ error: "Apenas super admins podem criar contas" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { name, email, plan = "starter", role = "owner" } = body || {};
    if (!name || !email) {
      return new Response(JSON.stringify({ error: "name e email são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Gera slug único
    const baseSlug = slugify(name) || "cliente";
    let slug = baseSlug;
    let i = 1;
    while (true) {
      const { data: existing } = await admin.from("accounts").select("id").eq("slug", slug).maybeSingle();
      if (!existing) break;
      i++; slug = `${baseSlug}-${i}`;
      if (i > 50) { slug = `${baseSlug}-${Date.now()}`; break; }
    }

    // Cria a conta
    const { data: account, error: accErr } = await admin
      .from("accounts")
      .insert({ name, slug, plan, status: "active", is_internal: false })
      .select()
      .single();
    if (accErr) throw accErr;

    // Cria invite
    const inviteToken = generateToken();
    const { data: invite, error: invErr } = await admin
      .from("account_invites")
      .insert({ account_id: account.id, email: email.toLowerCase(), role, token: inviteToken, invited_by: user.id })
      .select()
      .single();
    if (invErr) throw invErr;

    // Sempre usar domínio público (preview da Lovable exige login na Lovable)
    const publicBase = Deno.env.get("PUBLIC_APP_URL") || "https://www.fce.com.br";
    const acceptUrl = `${publicBase}/invite/${inviteToken}`;

    // Envia email via send-transactional-email (Lovable Emails)
    let emailSent = false;
    let emailError: string | null = null;
    try {
      const { data: emailResp, error: invokeErr } = await admin.functions.invoke(
        "send-transactional-email",
        {
          body: {
            templateName: "account-invite",
            recipientEmail: email,
            idempotencyKey: `account-invite-${invite.id}`,
            templateData: {
              accountName: name,
              acceptUrl,
              role,
              brandName: "AXHUB",
            },
          },
        },
      );
      if (invokeErr) emailError = invokeErr.message || String(invokeErr);
      else if (emailResp?.error) emailError = emailResp.error;
      else emailSent = true;
    } catch (e) {
      emailError = (e as Error).message;
    }

    return new Response(JSON.stringify({ success: true, account, invite, acceptUrl, emailSent, emailError }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[super-admin-create-client]", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
