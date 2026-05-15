// Cria um convite para um usuário entrar em uma conta. Envia email com link /invite/:token.
// Requer JWT do usuário convidador, valida que ele é owner/admin da conta.
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

function inviteEmailHtml(opts: { accountName: string; inviterName: string; role: string; acceptUrl: string }) {
  return `<!doctype html>
<html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:22px;margin:0 0 8px">Você foi convidado(a) para ${opts.accountName}</h1>
    <p style="color:#475569;margin:0 0 20px">${opts.inviterName} convidou você para colaborar como <b>${opts.role}</b>.</p>
    <a href="${opts.acceptUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Aceitar convite</a>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">Este convite expira em 7 dias. Se você não esperava por isso, ignore este email.</p>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { account_id, email, role = "sdr" } = body || {};
    if (!account_id || !email) {
      return new Response(JSON.stringify({ error: "account_id e email são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Valida que o convidador é owner/admin da conta
    const { data: membership } = await admin
      .from("account_members")
      .select("role")
      .eq("account_id", account_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Sem permissão para convidar nesta conta" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Valida limite de usuários do plano (membros ativos + convites pendentes)
    const { data: limitCheck } = await admin.rpc("check_account_limit", {
      _account_id: account_id,
      _resource: "users",
    });
    if (limitCheck && limitCheck.allowed === false) {
      return new Response(JSON.stringify({
        error: "limit_reached",
        message: `Limite de usuários do plano ${limitCheck.plan} atingido (${limitCheck.current}/${limitCheck.limit}). Faça upgrade para convidar mais pessoas.`,
        ...limitCheck,
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const inviteToken = generateToken();

    // Revoga convites pendentes anteriores para o mesmo email/conta
    await admin
      .from("account_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("account_id", account_id)
      .eq("email", email.toLowerCase())
      .is("accepted_at", null)
      .is("revoked_at", null);

    const { data: invite, error: insertErr } = await admin
      .from("account_invites")
      .insert({
        account_id,
        email: email.toLowerCase(),
        role,
        token: inviteToken,
        invited_by: user.id,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Busca dados para o email
    const { data: account } = await admin
      .from("accounts").select("name").eq("id", account_id).maybeSingle();
    const { data: profile } = await admin
      .from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();

    const origin = req.headers.get("origin") || "";
    const acceptUrl = `${origin}/invite/${inviteToken}`;

    let emailSent = false;
    let emailError: string | null = null;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      try {
        const { data: settings } = await admin
          .from("nina_settings")
          .select("invite_from_email, invite_from_name, company_name")
          .eq("account_id", account_id)
          .maybeSingle();
        const fromEmail = settings?.invite_from_email;
        const fromName = settings?.invite_from_name || settings?.company_name || account?.name || "AXHUB";

        if (fromEmail) {
          const html = inviteEmailHtml({
            accountName: account?.name || "AXHUB",
            inviterName: profile?.full_name || user.email || "Sua equipe",
            role,
            acceptUrl,
          });
          const resendResp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: `${fromName} <${fromEmail}>`,
              to: [email],
              subject: `Convite para ${account?.name || "AXHUB"}`,
              html,
            }),
          });
          if (resendResp.ok) emailSent = true;
          else emailError = (await resendResp.json())?.message || "Falha no envio";
        } else {
          emailError = "invite_from_email não configurado em nina_settings";
        }
      } catch (e) {
        emailError = (e as Error).message;
      }
    } else {
      emailError = "RESEND_API_KEY não configurada";
    }

    return new Response(
      JSON.stringify({ success: true, invite, acceptUrl, emailSent, emailError }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[account-invite] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
