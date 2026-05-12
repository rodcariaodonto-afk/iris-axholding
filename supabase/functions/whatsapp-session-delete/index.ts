import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
    if (cErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    const { session_id } = await req.json();
    if (!session_id) return json({ error: "session_id required" }, 400);

    const { data: session, error: sErr } = await supabase
      .from("whatsapp_sessions").select("*").eq("id", session_id).single();
    if (sErr || !session) return json({ error: "Not found" }, 404);

    const { data: roleOk } = await supabase.rpc("has_account_role", {
      _account_id: session.account_id,
      _roles: ["owner", "admin", "manager"],
    });
    if (!roleOk) return json({ error: "Forbidden" }, 403);

    // Tenta deletar instância na Evolution
    if (session.provider === "evolution" && session.evolution_instance_name) {
      const { data: settings } = await supabase
        .from("whatsapp_account_settings").select("evolution_api_url, evolution_api_key")
        .eq("account_id", session.account_id).maybeSingle();
      if (settings?.evolution_api_url && settings?.evolution_api_key) {
        const baseUrl = settings.evolution_api_url.replace(/\/$/, "");
        // logout primeiro, depois delete
        await fetch(`${baseUrl}/instance/logout/${session.evolution_instance_name}`, {
          method: "DELETE", headers: { apikey: settings.evolution_api_key },
        }).catch(() => {});
        await fetch(`${baseUrl}/instance/delete/${session.evolution_instance_name}`, {
          method: "DELETE", headers: { apikey: settings.evolution_api_key },
        }).catch(() => {});
      }
    }

    const { error: delErr } = await supabase.from("whatsapp_sessions").delete().eq("id", session_id);
    if (delErr) return json({ error: delErr.message }, 400);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
