import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  session_id: string;
}

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

    const { session_id } = (await req.json()) as Body;
    if (!session_id) return json({ error: "session_id required" }, 400);

    const { data: session, error: sErr } = await supabase
      .from("whatsapp_sessions").select("*").eq("id", session_id).single();
    if (sErr || !session) return json({ error: "Session not found" }, 404);

    const { data: roleOk } = await supabase.rpc("has_account_role", {
      _account_id: session.account_id,
      _roles: ["owner", "admin", "manager"],
    });
    if (!roleOk) return json({ error: "Forbidden" }, 403);

    if (session.provider === "meta_cloud") {
      // Validar credenciais Meta
      if (!session.whatsapp_access_token || !session.whatsapp_phone_number_id) {
        await supabase.from("whatsapp_sessions").update({
          status: "error", error_message: "Meta Cloud credentials missing",
        }).eq("id", session_id);
        return json({ error: "Meta credentials missing" }, 400);
      }
      const r = await fetch(`https://graph.facebook.com/v20.0/${session.whatsapp_phone_number_id}?fields=display_phone_number,verified_name`, {
        headers: { Authorization: `Bearer ${session.whatsapp_access_token}` },
      });
      if (!r.ok) {
        const err = await r.text();
        await supabase.from("whatsapp_sessions").update({
          status: "error", error_message: `Meta API error: ${err.slice(0, 200)}`,
        }).eq("id", session_id);
        return json({ error: "Meta API error", details: err }, 400);
      }
      const meta = await r.json();
      await supabase.from("whatsapp_sessions").update({
        status: "connected",
        phone_number: meta.display_phone_number ?? null,
        last_connected_at: new Date().toISOString(),
        error_message: null,
      }).eq("id", session_id);
      return json({ ok: true, status: "connected", phone_number: meta.display_phone_number });
    }

    // Evolution: cria/recupera instância e retorna QR
    const { data: settings } = await supabase
      .from("whatsapp_account_settings").select("evolution_api_url, evolution_api_key")
      .eq("account_id", session.account_id).maybeSingle();
    if (!settings?.evolution_api_url || !settings?.evolution_api_key) {
      return json({ error: "Evolution server not configured for this account" }, 400);
    }
    const baseUrl = settings.evolution_api_url.replace(/\/$/, "");
    const apiKey = settings.evolution_api_key;
    const instanceName = session.evolution_instance_name || `iris-${session.id.slice(0, 8)}`;

    // 1) Tenta criar instância (se já existe, segue)
    const createResp = await fetch(`${baseUrl}/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });
    let qrCode: string | null = null;
    let instanceId: string | null = null;
    if (createResp.ok) {
      const data = await createResp.json();
      qrCode = data?.qrcode?.base64 ?? data?.qrcode?.code ?? null;
      instanceId = data?.instance?.instanceId ?? null;
    } else {
      // Connect existing
      const connResp = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
        headers: { apikey: apiKey },
      });
      if (connResp.ok) {
        const data = await connResp.json();
        qrCode = data?.base64 ?? data?.code ?? null;
      } else {
        const err = await connResp.text();
        await supabase.from("whatsapp_sessions").update({
          status: "error", error_message: `Evolution: ${err.slice(0, 200)}`,
        }).eq("id", session_id);
        return json({ error: "Evolution connect failed", details: err }, 400);
      }
    }

    let resolvedStatus = qrCode ? "qr_pending" : "connecting";
    let resolvedPhoneNumber = session.phone_number ?? null;

    try {
      const stateResp = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
        headers: { apikey: apiKey },
      });
      if (stateResp.ok) {
        const stateData = await stateResp.json();
        const state = String(stateData?.instance?.state ?? stateData?.state ?? "").toLowerCase();
        if (["open", "connected"].includes(state)) {
          resolvedStatus = "connected";
          qrCode = null;
          const prof = await fetch(`${baseUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
            headers: { apikey: apiKey },
          });
          if (prof.ok) {
            const arr = await prof.json();
            const inst = Array.isArray(arr) ? arr[0] : arr;
            resolvedPhoneNumber = inst?.ownerJid?.split("@")[0] ?? inst?.number ?? resolvedPhoneNumber;
          }
        }
      }
    } catch (e) {
      console.error("[connect] Erro ao consultar estado da instância:", e);
    }

    await supabase.from("whatsapp_sessions").update({
      status: resolvedStatus,
      qr_code: qrCode,
      phone_number: resolvedPhoneNumber,
      last_connected_at: resolvedStatus === "connected" ? new Date().toISOString() : session.last_connected_at,
      evolution_instance_name: instanceName,
      evolution_instance_id: instanceId,
      error_message: null,
    }).eq("id", session_id);

    // Configurar webhook na Evolution para receber mensagens
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-webhook`;
    const events = [
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "CONNECTION_UPDATE",
      "QRCODE_UPDATED",
      "SEND_MESSAGE",
    ];
    try {
      // Evolution v2 payload
      let wr = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: true,
            events,
          },
        }),
      });
      if (!wr.ok) {
        // Fallback Evolution v1 payload
        wr = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({
            url: webhookUrl,
            webhook_by_events: false,
            webhook_base64: true,
            enabled: true,
            events,
          }),
        });
      }
      if (!wr.ok) {
        const txt = await wr.text();
        console.error("[connect] Falha ao configurar webhook:", txt);
      } else {
        console.log("[connect] Webhook configurado:", webhookUrl);
      }
    } catch (e) {
      console.error("[connect] Erro configurando webhook:", e);
    }

    return json({ ok: true, status: resolvedStatus, qr_code: qrCode, phone_number: resolvedPhoneNumber });
  } catch (e) {
    return json({ error: 'Erro interno do servidor' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
