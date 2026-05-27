import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BLING_AUTHORIZE_URL = "https://www.bling.com.br/Api/v3/oauth/authorize";
const BLING_TOKEN_URL = "https://api.bling.com.br/Api/v3/oauth/token";

async function getUserAccountId(supabase: any, userId: string): Promise<string | null> {
  // Try account membership first
  const { data: membership } = await supabase
    .from("account_members")
    .select("account_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (membership?.account_id) return membership.account_id;

  // Fallback: nina_settings
  const { data: settings } = await supabase
    .from("nina_settings")
    .select("account_id")
    .eq("user_id", userId)
    .maybeSingle();

  return settings?.account_id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const accountId = await getUserAccountId(supabase, user.id);
    if (!accountId) {
      return new Response(JSON.stringify({ error: "No account found for user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= SAVE CREDENTIALS =============
    if (action === "save_credentials") {
      const body = await req.json();
      const { client_id, client_secret } = body;

      if (!client_id || !client_secret) {
        return new Response(JSON.stringify({ error: "client_id and client_secret are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upsert credentials (preserve tokens if they exist)
      const { data: existing } = await supabaseAdmin
        .from("bling_credentials")
        .select("id")
        .eq("account_id", accountId)
        .maybeSingle();

      if (existing) {
        const { error: updErr } = await supabaseAdmin
          .from("bling_credentials")
          .update({
            client_id: client_id.trim(),
            client_secret: client_secret.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabaseAdmin
          .from("bling_credentials")
          .insert({
            account_id: accountId,
            client_id: client_id.trim(),
            client_secret: client_secret.trim(),
          });
        if (insErr) throw insErr;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= AUTHORIZE (start OAuth flow) =============
    if (action === "authorize") {
      const redirectUri = url.searchParams.get("redirect_uri") ||
        `${url.origin.replace(/\.supabase\.co.*/, ".lovable.app")}/settings`;

      const { data: creds } = await supabaseAdmin
        .from("bling_credentials")
        .select("client_id")
        .eq("account_id", accountId)
        .maybeSingle();

      if (!creds?.client_id) {
        return new Response(JSON.stringify({ error: "Save credentials first" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const state = btoa(JSON.stringify({
        user_id: user.id,
        account_id: accountId,
        redirect_uri: redirectUri,
        nonce: crypto.randomUUID(),
      }));

      const authUrl = `${BLING_AUTHORIZE_URL}?` +
        `response_type=code` +
        `&client_id=${encodeURIComponent(creds.client_id)}` +
        `&state=${encodeURIComponent(state)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}`;

      return new Response(JSON.stringify({ url: authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= CALLBACK (exchange code for tokens) =============
    if (action === "callback") {
      const body = await req.json();
      const { code, state, redirect_uri } = body;

      if (!code || !state) {
        return new Response(JSON.stringify({ error: "Missing code or state" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const stateData = JSON.parse(atob(state));
      const callbackUri = redirect_uri || stateData.redirect_uri;
      const stateAccountId = stateData.account_id || accountId;

      const { data: creds } = await supabaseAdmin
        .from("bling_credentials")
        .select("id, client_id, client_secret")
        .eq("account_id", stateAccountId)
        .maybeSingle();

      if (!creds) {
        return new Response(JSON.stringify({ error: "Credentials not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const basicAuth = btoa(`${creds.client_id}:${creds.client_secret}`);

      const tokenRes = await fetch(BLING_TOKEN_URL, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "1.0",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: callbackUri,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        console.error("Bling token exchange failed:", tokenData);
        return new Response(JSON.stringify({ error: "Token exchange failed", details: tokenData }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 21600) * 1000).toISOString();

      const { error: updErr } = await supabaseAdmin
        .from("bling_credentials")
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", creds.id);

      if (updErr) {
        console.error("Failed to save Bling tokens:", updErr);
        return new Response(JSON.stringify({ error: "Failed to save tokens", details: updErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= STATUS =============
    if (action === "status") {
      const { data: creds } = await supabaseAdmin
        .from("bling_credentials")
        .select("client_id, refresh_token, expires_at, updated_at")
        .eq("account_id", accountId)
        .maybeSingle();

      return new Response(JSON.stringify({
        has_credentials: !!creds?.client_id,
        connected: !!creds?.refresh_token,
        expires_at: creds?.expires_at || null,
        updated_at: creds?.updated_at || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= DISCONNECT =============
    if (action === "disconnect") {
      const { error: delErr } = await supabaseAdmin
        .from("bling_credentials")
        .update({
          access_token: null,
          refresh_token: null,
          expires_at: null,
        })
        .eq("account_id", accountId);

      if (delErr) throw delErr;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("bling-auth error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
