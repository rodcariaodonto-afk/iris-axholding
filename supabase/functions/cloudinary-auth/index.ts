import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getUserAccountId(supabase: any, userId: string): Promise<string | null> {
  const { data: membership } = await supabase
    .from("account_members")
    .select("account_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (membership?.account_id) return membership.account_id;

  const { data: settings } = await supabase
    .from("nina_settings")
    .select("account_id")
    .eq("user_id", userId)
    .maybeSingle();

  return settings?.account_id || null;
}

async function pingCloudinary(cloudName: string, apiKey: string, apiSecret: string): Promise<boolean> {
  // Cloudinary "ping" admin endpoint
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/ping`;
  const basicAuth = btoa(`${apiKey}:${apiSecret}`);

  try {
    const res = await fetch(url, {
      headers: { "Authorization": `Basic ${basicAuth}` },
    });
    return res.ok;
  } catch (err) {
    console.error("[cloudinary-auth] Ping failed:", err);
    return false;
  }
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

    // ============= SAVE CREDENTIALS (with verification) =============
    if (action === "save_credentials") {
      const body = await req.json();
      const { cloud_name, api_key, api_secret, upload_tag } = body;

      if (!cloud_name || !api_key || !api_secret) {
        return new Response(JSON.stringify({ error: "cloud_name, api_key and api_secret are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate credentials by pinging Cloudinary
      const valid = await pingCloudinary(cloud_name.trim(), api_key.trim(), api_secret.trim());
      if (!valid) {
        return new Response(JSON.stringify({ error: "Credenciais inválidas - verifique cloud_name, api_key e api_secret" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await supabaseAdmin
        .from("cloudinary_credentials")
        .select("id")
        .eq("account_id", accountId)
        .maybeSingle();

      const payload = {
        cloud_name: cloud_name.trim(),
        api_key: api_key.trim(),
        api_secret: api_secret.trim(),
        upload_tag: upload_tag?.trim() || "loja_filhos_com_estilo",
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabaseAdmin
          .from("cloudinary_credentials")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin
          .from("cloudinary_credentials")
          .insert({ account_id: accountId, ...payload });
        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true, verified: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= STATUS =============
    if (action === "status") {
      const { data: creds } = await supabaseAdmin
        .from("cloudinary_credentials")
        .select("cloud_name, upload_tag, last_sync_at, last_sync_count, updated_at")
        .eq("account_id", accountId)
        .maybeSingle();

      // Count uploaded products
      let uploadedCount = 0;
      let totalWithImage = 0;
      if (creds) {
        const { count: uploaded } = await supabaseAdmin
          .from("produtos_catalogo")
          .select("*", { count: "exact", head: true })
          .not("cloudinary_uploaded_at", "is", null);
        uploadedCount = uploaded || 0;

        const { count: total } = await supabaseAdmin
          .from("produtos_catalogo")
          .select("*", { count: "exact", head: true })
          .not("imagem_bling", "is", null);
        totalWithImage = total || 0;
      }

      return new Response(JSON.stringify({
        connected: !!creds,
        cloud_name: creds?.cloud_name || null,
        upload_tag: creds?.upload_tag || null,
        last_sync_at: creds?.last_sync_at || null,
        last_sync_count: creds?.last_sync_count || 0,
        uploaded_count: uploadedCount,
        total_with_image: totalWithImage,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= DISCONNECT =============
    if (action === "disconnect") {
      const { error } = await supabaseAdmin
        .from("cloudinary_credentials")
        .delete()
        .eq("account_id", accountId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("cloudinary-auth error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
