// Envia email de convite (e teste) usando Resend API.
// Modos:
//   - { mode: "test", to } -> envia email de teste
//   - { mode: "invite", to, name, email, tempPassword, loginUrl, role } -> convite
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function inviteHtml(opts: {
  name: string; email: string; tempPassword: string; loginUrl: string; role: string; companyName: string;
}) {
  return `<!doctype html>
<html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:22px;margin:0 0 8px">Bem-vindo(a) à equipe ${opts.companyName}</h1>
    <p style="color:#475569;margin:0 0 24px">Olá ${opts.name}, sua conta foi criada. Use as credenciais abaixo para acessar.</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:20px">
      <div style="font-size:12px;color:#64748b;text-transform:uppercase;margin-bottom:4px">Email</div>
      <div style="font-family:Menlo,monospace;font-size:14px;margin-bottom:14px">${opts.email}</div>
      <div style="font-size:12px;color:#64748b;text-transform:uppercase;margin-bottom:4px">Senha temporária</div>
      <div style="font-family:Menlo,monospace;font-size:14px;color:#0369a1">${opts.tempPassword}</div>
    </div>
    <a href="${opts.loginUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Acessar plataforma</a>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">Por segurança, altere sua senha em Configurações → Conta após o primeiro acesso.</p>
  </div>
</body></html>`;
}

function testHtml(companyName: string) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;padding:24px">
    <h2>Teste de envio bem-sucedido ✅</h2>
    <p>Este é um email de teste enviado por <b>${companyName}</b> para validar a configuração de envio.</p>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY não configurada nos secrets do projeto." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: settings } = await admin
      .from("nina_settings")
      .select("invite_from_email, invite_from_name, company_name")
      .limit(1)
      .maybeSingle();

    const fromEmail = settings?.invite_from_email;
    const fromName = settings?.invite_from_name || settings?.company_name || "Equipe";
    const companyName = settings?.company_name || "Plataforma";

    if (!fromEmail) {
      return new Response(JSON.stringify({ error: "Email do remetente (invite_from_email) não configurado." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const mode = body.mode || "invite";
    const to = body.to;
    if (!to) {
      return new Response(JSON.stringify({ error: "'to' é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let subject: string;
    let html: string;
    if (mode === "test") {
      subject = `[${companyName}] Teste de configuração de email`;
      html = testHtml(companyName);
    } else {
      subject = `Suas credenciais de acesso — ${companyName}`;
      html = inviteHtml({
        name: body.name || "",
        email: body.email || to,
        tempPassword: body.tempPassword || "",
        loginUrl: body.loginUrl || "",
        role: body.role || "agent",
        companyName,
      });
    }

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html,
      }),
    });

    const respData = await resendResp.json();
    if (!resendResp.ok) {
      return new Response(JSON.stringify({ error: respData?.message || "Falha no envio", details: respData }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "test") {
      await admin
        .from("nina_settings")
        .update({ invite_email_verified_at: new Date().toISOString() })
        .not("id", "is", null);
    }

    return new Response(JSON.stringify({ success: true, id: respData?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-invite-email] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
