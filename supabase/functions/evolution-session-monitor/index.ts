import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return response({ ok: true });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const authHeader = req.headers.get("Authorization");
  const allowedTokens = [serviceRoleKey, anonKey].filter((token): token is string => Boolean(token));
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!serviceRoleKey || !supabaseUrl || !bearerToken || !allowedTokens.includes(bearerToken)) {
    return response({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: activeAccounts, error: accountsError } = await admin
    .from("accounts")
    .select("id")
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(500);

  if (accountsError) return response({ error: "Failed to load active accounts" }, 500);
  const accountIds = (activeAccounts ?? []).map((account) => account.id);
  if (accountIds.length === 0) return response({ ok: true, checked: 0, results: [] });

  const { data: sessions, error: sessionsError } = await admin
    .from("whatsapp_sessions")
    .select("id, account_id, evolution_instance_name")
    .eq("provider", "evolution")
    .in("account_id", accountIds)
    .not("evolution_instance_name", "is", null)
    .order("updated_at", { ascending: true })
    .limit(100);

  if (sessionsError) return response({ error: "Failed to load Evolution sessions" }, 500);

  const results: Array<Record<string, unknown>> = [];
  for (const session of sessions ?? []) {
    try {
      const statusResp = await fetch(`${supabaseUrl}/functions/v1/whatsapp-session-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session_id: session.id }),
      });
      const body = await statusResp.json().catch(() => ({ error: `HTTP ${statusResp.status}` }));
      const result = {
        account_id: session.account_id,
        session_id: session.id,
        instance: session.evolution_instance_name,
        ok: statusResp.ok && body?.ok === true,
        live: body?.live ?? false,
        state: body?.evolution_state ?? null,
        reachable: body?.reachable ?? false,
        webhook_repaired: body?.webhook_repaired ?? false,
        reconnect_attempted: body?.reconnect_attempted ?? false,
        reason: body?.reason ?? body?.error ?? null,
      };
      results.push(result);
      console.log(JSON.stringify({ event: "evolution_monitor_result", ...result }));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      results.push({ account_id: session.account_id, session_id: session.id, instance: session.evolution_instance_name, ok: false, reason });
      console.error(JSON.stringify({ event: "evolution_monitor_error", account_id: session.account_id, session_id: session.id, reason }));
    }
  }

  return response({
    ok: true,
    checked: results.length,
    online: results.filter((item) => item.live === true).length,
    repaired: results.filter((item) => item.webhook_repaired === true).length,
    reconnect_attempts: results.filter((item) => item.reconnect_attempted === true).length,
    results,
  });
});

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}