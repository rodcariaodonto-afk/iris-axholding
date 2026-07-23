// Concede/revoga acesso temporário de um Super Admin a uma conta de cliente.
// Cria (ou reativa) uma linha em account_members com role=admin e
// marca metadata.impersonation=true para permitir revogar depois.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "Token inválido" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Verifica super admin: owner/admin em conta interna
    const { data: superCheck } = await admin
      .from("account_members")
      .select("role, account:accounts!inner(is_internal)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", ["owner", "admin"]);
    const isSuper = (superCheck || []).some((m: any) => m.account?.is_internal);
    if (!isSuper) return json({ error: "Apenas super admins" }, 403);

    const body = await req.json().catch(() => ({}));
    const action: "grant" | "revoke" = body?.action || "grant";
    const targetAccountId: string | undefined = body?.account_id;
    if (!targetAccountId) return json({ error: "account_id obrigatório" }, 400);

    // Não permite impersonar uma conta interna (você já é super admin lá)
    const { data: acc } = await admin
      .from("accounts")
      .select("id, is_internal, name")
      .eq("id", targetAccountId)
      .maybeSingle();
    if (!acc) return json({ error: "Conta não encontrada" }, 404);
    if (acc.is_internal) return json({ error: "Conta interna não requer impersonação" }, 400);

    // Verifica membership existente
    const { data: existing } = await admin
      .from("account_members")
      .select("id, status, role, metadata")
      .eq("account_id", targetAccountId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (action === "revoke") {
      // Só remove se foi criado via impersonação
      if (existing && (existing.metadata as any)?.impersonation) {
        await admin.from("account_members").delete().eq("id", existing.id);
      }
      return json({ success: true, revoked: true });
    }

    // grant
    if (existing) {
      // Já é membro real — apenas reativa se estiver inativo
      if (existing.status !== "active") {
        await admin
          .from("account_members")
          .update({ status: "active" })
          .eq("id", existing.id);
      }
      return json({ success: true, account_id: targetAccountId, account_name: acc.name, already_member: true });
    }

    const { error: insErr } = await admin.from("account_members").insert({
      account_id: targetAccountId,
      user_id: user.id,
      role: "admin",
      status: "active",
      metadata: { impersonation: true, granted_at: new Date().toISOString() },
    });
    if (insErr) return json({ error: insErr.message }, 500);

    // Log de auditoria (best-effort)
    try {
      await admin.from("audit_logs").insert({
        account_id: targetAccountId,
        actor_user_id: user.id,
        action: "super_admin.impersonate",
        resource_type: "account",
        resource_id: targetAccountId,
        metadata: { account_name: acc.name },
      });
    } catch { /* ignore */ }

    return json({ success: true, account_id: targetAccountId, account_name: acc.name });
  } catch (e: any) {
    return json({ error: e?.message || "Erro interno" }, 500);
  }
});
