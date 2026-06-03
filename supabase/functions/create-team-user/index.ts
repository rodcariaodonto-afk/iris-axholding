// Cria um usuário de equipe diretamente: cria conta no auth com senha temporária
// (já confirmada), insere/atualiza o team_member com status 'active' e tenta
// enviar email com as credenciais (se a infra de email transacional estiver pronta).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function generateTempPassword(length = 12) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Require an authenticated caller
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const caller = userRes?.user;
    if (!caller) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const {
      name,
      email,
      role = "agent",
      team_id,
      function_id,
      weight = 1,
      password: providedPassword,
      account_id,
    } = body || {};

    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: "name e email são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!account_id) {
      return new Response(
        JSON.stringify({ error: "account_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Authorize: caller must be owner/admin of the target account (or a super admin)
    const { data: callerMember } = await admin
      .from("account_members")
      .select("role")
      .eq("account_id", account_id)
      .eq("user_id", caller.id)
      .eq("status", "active")
      .maybeSingle();
    const { data: isSuper } = await admin.rpc("is_super_admin");
    const callerIsAdmin = callerMember?.role === "owner" || callerMember?.role === "admin";
    if (!callerIsAdmin && isSuper !== true) {
      return new Response(
        JSON.stringify({ error: "Apenas owner/admin podem criar usuários" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    // Valida limite de usuários do plano (a função SQL já soma ativos + convites pendentes)
    const { data: limitCheck } = await admin.rpc("check_account_limit", {
      _account_id: account_id,
      _resource: "users",
    });
    if (limitCheck && limitCheck.allowed === false) {
      // Se o email já é membro ativo, permite (é update, não cria novo "slot")
      const { data: existingActive } = await admin
        .from("team_members")
        .select("id, status")
        .eq("account_id", account_id)
        .eq("email", email)
        .eq("status", "active")
        .maybeSingle();
      if (!existingActive) {
        return new Response(JSON.stringify({
          error: "limit_reached",
          message: `Limite de usuários do plano ${limitCheck.plan} atingido (${limitCheck.current}/${limitCheck.limit}). Faça upgrade para criar mais usuários.`,
          ...limitCheck,
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const tempPassword = providedPassword || generateTempPassword();

    // 1) Cria o usuário no auth (ou recupera se já existe)
    let userId: string | null = null;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: name, must_change_password: true },
    });

    if (createErr) {
      // Se já existe, busca o id existente
      const msg = (createErr.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        const { data: list } = await admin.auth.admin.listUsers();
        const existing = list?.users?.find(
          (u) => (u.email || "").toLowerCase() === email.toLowerCase(),
        );
        if (existing) {
          userId = existing.id;
          // Atualiza senha do usuário existente (reset)
          await admin.auth.admin.updateUserById(userId, {
            password: tempPassword,
            email_confirm: true,
            user_metadata: { ...(existing.user_metadata || {}), full_name: name, must_change_password: true },
          });
        } else {
          throw createErr;
        }
      } else {
        throw createErr;
      }
    } else {
      userId = created.user?.id ?? null;
    }

    // 2) Upsert do team_member
    const { data: existingMember } = await admin
      .from("team_members")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let memberRow;
    if (existingMember) {
      const { data, error } = await admin
        .from("team_members")
        .update({
          name,
          role,
          team_id: team_id || null,
          function_id: function_id || null,
          weight,
          status: "active",
          user_id: userId,
          account_id,
        })
        .eq("id", existingMember.id)
        .select()
        .single();
      if (error) throw error;
      memberRow = data;
    } else {
      const { data, error } = await admin
        .from("team_members")
        .insert({
          name,
          email,
          role,
          team_id: team_id || null,
          function_id: function_id || null,
          weight,
          status: "active",
          user_id: userId,
          account_id,
        })
        .select()
        .single();
      if (error) throw error;
      memberRow = data;
    }

    // 2.1) Garante membership na conta (account_members)
    if (userId) {
      const accountRole =
        role === "admin" ? "admin" : role === "manager" ? "manager" : "sdr";
      const { error: amErr } = await admin
        .from("account_members")
        .upsert(
          { account_id, user_id: userId, role: accountRole, status: "active" },
          { onConflict: "account_id,user_id" },
        );
      if (amErr) console.error("[create-team-user] account_members upsert error", amErr);
    }

    // 3) Tenta enviar email com as credenciais via Resend (se configurado)
    let emailSent = false;
    let emailError: string | null = null;
    try {
      const loginUrl = `${req.headers.get("origin") || ""}/auth`;
      const { data: emailResp, error: invokeErr } = await admin.functions.invoke(
        "send-invite-email",
        {
          body: {
            mode: "invite",
            to: email,
            name,
            email,
            tempPassword,
            loginUrl,
            role,
          },
        },
      );
      if (invokeErr) {
        emailError = invokeErr.message || String(invokeErr);
      } else if (emailResp?.error) {
        emailError = emailResp.error;
      } else {
        emailSent = true;
      }
    } catch (e) {
      emailError = (e as Error).message;
    }

    return new Response(
      JSON.stringify({
        success: true,
        member: memberRow,
        tempPassword,
        emailSent,
        emailError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[create-team-user] error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
