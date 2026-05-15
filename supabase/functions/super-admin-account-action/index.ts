// Ações de Super Admin sobre contas: suspender, reativar, excluir (soft) e cancelar exclusão.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "suspend" | "reactivate" | "delete" | "cancel_deletion";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "Token inválido" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Verifica super admin
    const { data: superCheck } = await admin
      .from("account_members")
      .select("role, account:accounts!inner(is_internal)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", ["owner", "admin"]);
    const isSuper = (superCheck || []).some((m: any) => m.account?.is_internal);
    if (!isSuper) return json({ error: "Apenas super admins podem executar esta ação" }, 403);

    const body = await req.json();
    const { account_id, action, reason } = body || {};
    if (!account_id || !action) return json({ error: "account_id e action são obrigatórios" }, 400);
    if (!["suspend", "reactivate", "delete", "cancel_deletion"].includes(action)) {
      return json({ error: "Ação inválida" }, 400);
    }

    const { data: account, error: accErr } = await admin.from("accounts").select("*").eq("id", account_id).maybeSingle();
    if (accErr || !account) return json({ error: "Conta não encontrada" }, 404);
    if (account.is_internal) return json({ error: "Contas internas não podem ser modificadas" }, 403);

    const oldValues = { status: account.status, deletion_status: account.deletion_status };
    let updates: Record<string, any> = {};
    let pauseAi = false;
    let resumeAi = false;
    let severity: "info" | "warn" | "critical" = "info";
    let eventType = "";

    switch (action as Action) {
      case "suspend":
        updates = { status: "suspended" };
        pauseAi = true;
        severity = "warn";
        eventType = "account.suspended";
        break;
      case "reactivate":
        updates = {
          status: "active",
          deletion_status: "none",
          deletion_scheduled_at: null,
          delete_after: null,
          deletion_reason: null,
          cancelled_at: null,
        };
        resumeAi = true;
        severity = "info";
        eventType = "account.reactivated";
        break;
      case "delete": {
        const now = new Date();
        const after = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        updates = {
          status: "cancelled",
          deletion_status: "scheduled",
          deletion_scheduled_at: now.toISOString(),
          delete_after: after.toISOString(),
          deletion_reason: reason || null,
          cancelled_at: now.toISOString(),
        };
        pauseAi = true;
        severity = "critical";
        eventType = "account.deletion_scheduled";
        break;
      }
      case "cancel_deletion":
        updates = {
          status: "active",
          deletion_status: "none",
          deletion_scheduled_at: null,
          delete_after: null,
          deletion_reason: null,
          cancelled_at: null,
        };
        resumeAi = true;
        severity = "warn";
        eventType = "account.deletion_cancelled";
        break;
    }

    const { error: updErr } = await admin.from("accounts").update(updates).eq("id", account_id);
    if (updErr) throw updErr;

    if (pauseAi) {
      await admin.from("nina_settings").update({ is_active: false, auto_response_enabled: false }).eq("account_id", account_id);
    }
    if (resumeAi) {
      await admin.from("nina_settings").update({ is_active: true, auto_response_enabled: true }).eq("account_id", account_id);
    }

    // Audit
    await admin.rpc("log_audit_v2", {
      _account_id: account_id,
      _event_type: eventType,
      _severity: severity,
      _entity_type: "account",
      _entity_id: account_id,
      _action: eventType,
      _old: oldValues,
      _new: updates,
      _metadata: { reason: reason || null, actor_email: user.email },
    });

    return json({ success: true, action, account_id, updates });
  } catch (e) {
    console.error("[super-admin-account-action]", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
