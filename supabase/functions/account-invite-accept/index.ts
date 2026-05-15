// Aceita um convite. Pode ser chamada por usuário recém-criado (verify_jwt = false).
// Recebe: { token, user_id } — valida o convite, insere/atualiza account_members.
// O fluxo no frontend:
//   1) Usuário acessa /invite/:token
//   2) Faz signup ou login (auth.signUp / signInWithPassword)
//   3) Frontend chama esta função com { token, user_id }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { token, user_id, action = "accept", password, full_name } = body || {};

    if (!token) {
      return new Response(JSON.stringify({ error: "token é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lookup do convite
    const { data: invite, error: invErr } = await admin
      .from("account_invites")
      .select("id, account_id, email, role, expires_at, accepted_at, revoked_at, accounts:accounts(id, name, slug, logo_url)")
      .eq("token", token)
      .maybeSingle();

    if (invErr) throw invErr;
    if (!invite) {
      return new Response(JSON.stringify({ error: "Convite inválido" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (invite.revoked_at) {
      return new Response(JSON.stringify({ error: "Convite revogado" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (invite.accepted_at) {
      return new Response(JSON.stringify({ error: "Convite já aceito" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Convite expirado" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET / preview: apenas devolve info do convite (sem aceitar)
    if (action === "preview") {
      return new Response(
        JSON.stringify({
          email: invite.email,
          role: invite.role,
          account: invite.accounts,
          expires_at: invite.expires_at,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id é obrigatório para aceitar" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirma que o user existe
    const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(user_id);
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Garante que o email do user bate com o do convite
    if ((userRes.user.email || "").toLowerCase() !== invite.email.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Email do convite não confere com o usuário logado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Upsert membership
    const { error: memberErr } = await admin
      .from("account_members")
      .upsert(
        {
          account_id: invite.account_id,
          user_id,
          role: invite.role,
          status: "active",
          invited_by: null,
          invited_at: new Date().toISOString(),
          joined_at: new Date().toISOString(),
        },
        { onConflict: "account_id,user_id" },
      );
    if (memberErr) throw memberErr;

    // Marca convite como aceito
    await admin
      .from("account_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    return new Response(
      JSON.stringify({
        success: true,
        account_id: invite.account_id,
        role: invite.role,
        account: invite.accounts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[account-invite-accept] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
