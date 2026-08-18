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

    const baseUrl = settings.evolution_api_url.replace(/\/+$/, "");
    const instanceName = session.evolution_instance_name;
    if (!instanceName) {
      await supabase.from("whatsapp_sessions").update({
        status: "disconnected",
        error_message: null,
      }).eq("id", session_id);

      return json({
        ok: true,
        status: "disconnected",
        live: false,
        evolution_state: "not_created",
        reachable: true,
        reason: "missing_instance_name",
      });
    }

    const encodedInstanceName = encodeURIComponent(instanceName);
    let r: Response;
    let responseText = "";
    try {
      r = await fetch(`${baseUrl}/instance/connectionState/${encodedInstanceName}`, {
        headers: { apikey: settings.evolution_api_key },
      });
    } catch (_e) {
      return json({ ok: true, status: session.status, live: false, evolution_state: null, reachable: false, reason: "fetch_failed" });
    }
    if (!r.ok) {
      try {
        responseText = await r.text();
      } catch (_e) {
        responseText = "";
      }

      const lower = responseText.toLowerCase();
      const instanceMissing = r.status === 404 || lower.includes("not found") || lower.includes("não encontrado") || lower.includes("instance");

      if (instanceMissing) {
        await supabase.from("whatsapp_sessions").update({
          status: "disconnected",
          error_message: null,
          qr_code: null,
        }).eq("id", session_id);

        return json({
          ok: true,
          status: "disconnected",
          live: false,
          evolution_state: "not_created",
          reachable: true,
          reason: "instance_not_found",
        });
      }

      const errorMessage = r.status === 401
        ? "Evolution: credencial do servidor não autorizada (401)"
        : `Evolution: servidor respondeu HTTP ${r.status}`;
      await supabase.from("whatsapp_sessions").update({
        status: "error",
        error_message: errorMessage,
      }).eq("id", session_id).eq("account_id", session.account_id);
      return json({ ok: true, status: "error", live: false, evolution_state: null, reachable: false, reason: `http_${r.status}` });
    }
    const data = await r.json();
    const state = data?.instance?.state ?? data?.state;
    let newStatus: string = session.status;
    let phoneNumber: string | null = session.phone_number;
    const normalizedState = String(state ?? "").toLowerCase();
    const live = ["open", "connected"].includes(normalizedState);
    let reconnectAttempted = false;
    let qrCode: string | null = null;
    if (live) {
      newStatus = "connected";
      // Try fetch profile
      const prof = await fetch(`${baseUrl}/instance/fetchInstances?instanceName=${encodedInstanceName}`, {
        headers: { apikey: settings.evolution_api_key },
      });
      if (prof.ok) {
        const arr = await prof.json();
        const inst = Array.isArray(arr) ? arr[0] : arr;
        phoneNumber = inst?.ownerJid?.split("@")[0] ?? inst?.number ?? phoneNumber;
      }
    } else if (normalizedState === "connecting") newStatus = "connecting";
    else if (["close", "closed", "disconnected"].includes(normalizedState)) {
      reconnectAttempted = true;
      try {
        const reconnectResp = await fetch(`${baseUrl}/instance/connect/${encodedInstanceName}`, {
          headers: { apikey: settings.evolution_api_key },
        });
        if (reconnectResp.ok) {
          const reconnectData = await reconnectResp.json();
          qrCode = extractEvolutionQrCode(reconnectData);
          newStatus = qrCode ? "qr_pending" : "connecting";
        } else {
          newStatus = "disconnected";
        }
      } catch (_e) {
        newStatus = "disconnected";
      }
    }

    await supabase.from("whatsapp_sessions").update({
      status: newStatus,
      phone_number: phoneNumber,
      last_connected_at: newStatus === "connected" ? new Date().toISOString() : session.last_connected_at,
      qr_code: newStatus === "connected" ? null : (qrCode ?? session.qr_code),
      error_message: live ? null : session.error_message,
    }).eq("id", session_id).eq("account_id", session.account_id);

    // Reenfileira automaticamente mensagens que falharam por desconexão
    // (e travadas em "processing") assim que a conexão real volta a ficar online.
    let requeued = 0;
    let webhookRepaired = false;
    if (live) {
      requeued = await requeueDisconnectedMessages(session.account_id, session_id);
      // Auto-reparo: a Evolution perde a configuração de webhook em restarts/reconexões,
      // deixando a instância "conectada" porém sem entregar mensagens ao sistema.
      webhookRepaired = await ensureWebhook(baseUrl, settings.evolution_api_key, encodedInstanceName);
    }

    console.log(JSON.stringify({
      event: "evolution_session_check",
      account_id: session.account_id,
      session_id,
      instance: instanceName,
      state: normalizedState || null,
      live,
      reconnect_attempted: reconnectAttempted,
      webhook_repaired: webhookRepaired,
      requeued,
    }));
    return json({ ok: true, status: newStatus, phone_number: phoneNumber, live, evolution_state: normalizedState || null, reachable: true, requeued, webhook_repaired: webhookRepaired, reconnect_attempted: reconnectAttempted, qr_pending: Boolean(qrCode) });
  } catch (e) {
    return json({ error: 'Erro interno do servidor' }, 500);
  }
});

const WEBHOOK_EVENTS = [
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "CONNECTION_UPDATE",
  "QRCODE_UPDATED",
  "SEND_MESSAGE",
];

/**
 * Garante que a instância Evolution esteja com o webhook correto apontando para
 * o `whatsapp-webhook` deste projeto, com o evento de novas mensagens habilitado.
 * Retorna true quando precisou reaplicar a configuração.
 */
async function ensureWebhook(baseUrl: string, apiKey: string, encodedInstanceName: string): Promise<boolean> {
  const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-webhook`;
  try {
    let needsFix = true;
    try {
      const r = await fetch(`${baseUrl}/webhook/find/${encodedInstanceName}`, {
        headers: { apikey: apiKey },
      });
      if (r.ok) {
        const cfg = await r.json();
        const events: string[] = (cfg?.events ?? []).map((e: string) => String(e).toUpperCase());
        needsFix = !(cfg?.enabled === true && cfg?.url === webhookUrl && events.includes("MESSAGES_UPSERT"));
      }
    } catch (_e) {
      // Sem leitura confiável, reaplica por segurança.
    }

    if (!needsFix) return false;

    console.warn("[status] Webhook divergente/ausente — reaplicando:", webhookUrl);
    let wr = await fetch(`${baseUrl}/webhook/set/${encodedInstanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: true, events: WEBHOOK_EVENTS },
      }),
    });
    if (!wr.ok) {
      wr = await fetch(`${baseUrl}/webhook/set/${encodedInstanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: true,
          enabled: true,
          events: WEBHOOK_EVENTS,
        }),
      });
    }
    if (!wr.ok) {
      console.error("[status] Falha ao reaplicar webhook:", await wr.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[status] Erro no auto-reparo do webhook:", e);
    return false;
  }
}

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

function extractEvolutionQrCode(data: any): string | null {
  const candidates = [
    data?.qrcode?.base64,
    data?.qrcode?.code,
    data?.qr?.base64,
    data?.qr?.code,
    data?.base64,
    data?.code,
  ];
  const value = candidates.find((item) => typeof item === "string" && item.trim().length > 0);
  if (!value) return null;
  const qr = value.trim();
  if (qr.startsWith("data:image")) return qr;
  if (qr.startsWith("/9j/") || qr.startsWith("iVBOR") || qr.startsWith("R0lGOD")) {
    return `data:image/png;base64,${qr}`;
  }
  return qr;
}
