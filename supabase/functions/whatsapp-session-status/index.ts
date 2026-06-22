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
      return json({ ok: true, status: session.status, phone_number: session.phone_number, live: null, evolution_state: null });
    }

    const { data: settings } = await supabase
      .from("whatsapp_account_settings").select("evolution_api_url, evolution_api_key")
      .eq("account_id", session.account_id).maybeSingle();
    if (!settings?.evolution_api_url || !settings?.evolution_api_key) {
      return json({ ok: true, status: session.status, live: false, evolution_state: null, reachable: false, reason: "no_credentials" });
    }

    const baseUrl = settings.evolution_api_url.replace(/\/$/, "");
    let r: Response;
    try {
      r = await fetch(`${baseUrl}/instance/connectionState/${session.evolution_instance_name}`, {
        headers: { apikey: settings.evolution_api_key },
      });
    } catch (_e) {
      return json({ ok: true, status: session.status, live: false, evolution_state: null, reachable: false, reason: "fetch_failed" });
    }
    if (!r.ok) {
      return json({ ok: true, status: session.status, live: false, evolution_state: null, reachable: false, reason: `http_${r.status}` });
    }
    const data = await r.json();
    const state = data?.instance?.state ?? data?.state;
    let newStatus: string = session.status;
    let phoneNumber: string | null = session.phone_number;
    const normalizedState = String(state ?? "").toLowerCase();
    const live = ["open", "connected"].includes(normalizedState);
    if (live) {
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

    // Reenfileira automaticamente mensagens que falharam por desconexão
    // (e travadas em "processing") assim que a conexão real volta a ficar online.
    let requeued = 0;
    if (live) {
      requeued = await requeueDisconnectedMessages(session.account_id, session_id);
    }

    return json({ ok: true, status: newStatus, phone_number: phoneNumber, live, evolution_state: normalizedState || null, reachable: true, requeued });
  } catch (e) {
    return json({ error: 'Erro interno do servidor' }, 500);
  }
});

async function requeueDisconnectedMessages(accountId: string, sessionId: string): Promise<number> {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Busca itens falhados/travados desta sessão por problema de conexão
    const { data: items } = await admin
      .from("send_queue")
      .select("id, status, error_message")
      .eq("account_id", accountId)
      .eq("session_id", sessionId)
      .in("status", ["failed", "processing"])
      .order("created_at", { ascending: true })
      .limit(500);

    if (!items || items.length === 0) return 0;

    const connKeywords = ["connection closed", "internal server error", "timeout", "econn", "fetch", "503", "502", "500"];
    const toRequeue = items.filter((it) => {
      if (it.status === "processing") return true; // travado
      const msg = String(it.error_message ?? "").toLowerCase();
      return connKeywords.some((k) => msg.includes(k));
    });

    if (toRequeue.length === 0) return 0;

    // Reenfileira com espaçamento (anti-ban): ~40s entre cada mensagem.
    const SPACING_MS = 40000;
    let i = 0;
    for (const it of toRequeue) {
      const scheduledAt = new Date(Date.now() + i * SPACING_MS).toISOString();
      await admin.from("send_queue").update({
        status: "pending",
        retry_count: 0,
        error_message: null,
        scheduled_at: scheduledAt,
      }).eq("id", it.id);
      i++;
    }
    return toRequeue.length;
  } catch (_e) {
    return 0;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
