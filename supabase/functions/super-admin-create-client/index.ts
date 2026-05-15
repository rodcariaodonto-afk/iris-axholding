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

    const origin = req.headers.get("origin") || "";
    const acceptUrl = `${origin}/invite/${inviteToken}`;

    // Tenta enviar email se Resend estiver configurado (best-effort)
    let emailSent = false;
    let emailError: string | null = null;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      try {
        const html = `<!doctype html><html><body style="margin:0;background:#fff;font-family:Arial,sans-serif;color:#0f172a">
          <div style="max-width:560px;margin:0 auto;padding:32px 24px">
            <h1 style="font-size:22px;margin:0 0 8px">Bem-vindo(a) à IRIS</h1>
            <p style="color:#475569;margin:0 0 20px">Sua conta <b>${name}</b> foi criada. Clique abaixo para definir sua senha e acessar a plataforma.</p>
            <a href="${acceptUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Definir minha senha</a>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px">Este link expira em 7 dias.</p>
          </div></body></html>`;
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "IRIS <onboarding@resend.dev>", to: [email], subject: `Bem-vindo(a) à IRIS - ${name}`, html }),
        });
        if (r.ok) emailSent = true;
        else emailError = (await r.json())?.message || "Falha no envio";
      } catch (e) {
        emailError = (e as Error).message;
      }
    } else {
      emailError = "RESEND_API_KEY não configurada — use o link manualmente";
    }

    return new Response(JSON.stringify({ success: true, account, invite, acceptUrl, emailSent, emailError }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[super-admin-create-client]", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
