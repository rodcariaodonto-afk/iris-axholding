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

    if (session.provider === "meta_cloud") {
      // Same logic as connect for meta
      return json({ ok: true, status: session.status, phone_number: session.phone_number });
    }

    const { data: settings } = await supabase
      .from("whatsapp_account_settings").select("evolution_api_url, evolution_api_key")
      .eq("account_id", session.account_id).maybeSingle();
    if (!settings?.evolution_api_url || !settings?.evolution_api_key) {
      return json({ ok: true, status: session.status });
    }

    const baseUrl = settings.evolution_api_url.replace(/\/$/, "");
    const r = await fetch(`${baseUrl}/instance/connectionState/${session.evolution_instance_name}`, {
      headers: { apikey: settings.evolution_api_key },
    });
    if (!r.ok) return json({ ok: true, status: session.status });
    const data = await r.json();
    const state = data?.instance?.state ?? data?.state;
    let newStatus: string = session.status;
    let phoneNumber: string | null = session.phone_number;
    const normalizedState = String(state ?? "").toLowerCase();
    if (["open", "connected"].includes(normalizedState)) {
      newStatus = "connected";
      // Try fetch profile
      const prof = await fetch(`${baseUrl}/instance/fetchInstances?instanceName=${session.evolution_instance_name}`, {
        headers: { apikey: settings.evolution_api_key },
      });
      if (prof.ok) {
        const arr = await prof.json();
        const inst = Array.isArray(arr) ? arr[0] : arr;
        phoneNumber = inst?.ownerJid?.split("@")[0] ?? inst?.number ?? phoneNumber;
      }
    } else if (normalizedState === "connecting") newStatus = "connecting";
    else if (["close", "closed", "disconnected"].includes(normalizedState)) newStatus = "disconnected";

    await supabase.from("whatsapp_sessions").update({
      status: newStatus,
      phone_number: phoneNumber,
      last_connected_at: newStatus === "connected" ? new Date().toISOString() : session.last_connected_at,
      qr_code: newStatus === "connected" ? null : session.qr_code,
    }).eq("id", session_id);

    return json({ ok: true, status: newStatus, phone_number: phoneNumber });
  } catch (e) {
    return json({ error: 'Erro interno do servidor' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
