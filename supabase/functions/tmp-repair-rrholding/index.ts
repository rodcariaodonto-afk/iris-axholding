import { createClient } from "npm:@supabase/supabase-js@2";

const ACCOUNT_ID = "de65f931-3a02-4184-8489-0b9545759f21";
const SESSION_ID = "9b586d1c-5498-4516-93a9-73683876fb04";
const INSTANCE_NAME = "rrholding";

Deno.serve(async (req) => {
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return response({ error: "Backend unavailable" }, 500);

    const admin = createClient(url, serviceKey);
    const { data: settings, error: settingsError } = await admin
      .from("whatsapp_account_settings")
      .select("evolution_api_url, evolution_api_key")
      .eq("account_id", ACCOUNT_ID)
      .single();

    if (settingsError || !settings?.evolution_api_url || !settings.evolution_api_key) {
      return response({ error: "Evolution settings unavailable" }, 400);
    }

    const baseUrl = settings.evolution_api_url.replace(/\/+$/, "");
    const encodedInstance = encodeURIComponent(INSTANCE_NAME);
    const headers = { apikey: settings.evolution_api_key };

    const stateResult = await fetch(`${baseUrl}/instance/connectionState/${encodedInstance}`, { headers });
    if (!stateResult.ok) {
      const details = (await stateResult.text()).slice(0, 200);
      await admin.from("whatsapp_sessions").update({
        status: "disconnected",
        error_message: `Evolution state error: ${details}`,
      }).eq("id", SESSION_ID).eq("account_id", ACCOUNT_ID);
      return response({ ok: false, connected: false, state_http_status: stateResult.status }, 200);
    }

    const stateData = await stateResult.json();
    const evolutionState = String(stateData?.instance?.state ?? stateData?.state ?? "").toLowerCase();
    const connected = ["open", "connected"].includes(evolutionState);

    const webhookUrl = `${url}/functions/v1/whatsapp-webhook`;
    const events = ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE", "QRCODE_UPDATED", "SEND_MESSAGE"];
    let webhookResult = await fetch(`${baseUrl}/webhook/set/${encodedInstance}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: true, events } }),
    });

    if (!webhookResult.ok) {
      webhookResult = await fetch(`${baseUrl}/webhook/set/${encodedInstance}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl, webhook_by_events: false, webhook_base64: true, enabled: true, events }),
      });
    }

    let phoneNumber = "5511983620641";
    if (connected) {
      const profileResult = await fetch(`${baseUrl}/instance/fetchInstances?instanceName=${encodedInstance}`, { headers });
      if (profileResult.ok) {
        const profileData = await profileResult.json();
        const instance = Array.isArray(profileData) ? profileData[0] : profileData;
        phoneNumber = instance?.ownerJid?.split("@")[0] ?? instance?.number ?? phoneNumber;
      }
    }

    await admin.from("whatsapp_sessions").update({
      status: connected ? "connected" : "disconnected",
      phone_number: phoneNumber,
      last_connected_at: connected ? new Date().toISOString() : null,
      error_message: webhookResult.ok ? null : "Falha ao configurar webhook",
    }).eq("id", SESSION_ID).eq("account_id", ACCOUNT_ID);

    return response({
      ok: connected && webhookResult.ok,
      connected,
      evolution_state: evolutionState,
      webhook_configured: webhookResult.ok,
      phone_number: phoneNumber,
    });
  } catch (error) {
    console.error("[tmp-repair-rrholding]", error);
    return response({ error: "Repair failed" }, 500);
  }
});

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}