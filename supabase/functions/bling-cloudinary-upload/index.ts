import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH_SIZE = 20;          // Products per batch
const RATE_LIMIT_MS = 250;       // Delay between uploads (avoid Cloudinary rate limits)

// SHA-1 signature for Cloudinary signed uploads
async function sha1(input: string): Promise<string> {
  const buffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function generateSignature(params: Record<string, string>, apiSecret: string): Promise<string> {
  // Per Cloudinary docs: alphabetically sort params (excluding file, cloud_name, api_key, resource_type, signature)
  const excluded = new Set(["file", "cloud_name", "api_key", "resource_type", "signature"]);
  const sortedKeys = Object.keys(params).filter((k) => !excluded.has(k)).sort();
  const paramString = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
  return await sha1(paramString + apiSecret);
}

interface UploadResult {
  bling_id: number;
  success: boolean;
  url?: string;
  error?: string;
}

async function uploadToCloudinary(
  imageUrl: string,
  blingId: number,
  cloudName: string,
  apiKey: string,
  apiSecret: string,
  uploadTag: string,
): Promise<UploadResult> {
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const publicId = `bling_${blingId}`;

    const signedParams: Record<string, string> = {
      public_id: publicId,
      timestamp,
      overwrite: "true",
      tags: uploadTag,
    };

    const signature = await generateSignature(signedParams, apiSecret);

    const formData = new FormData();
    formData.append("file", imageUrl);
    formData.append("api_key", apiKey);
    formData.append("signature", signature);
    Object.entries(signedParams).forEach(([k, v]) => formData.append(k, v));

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      console.error(`[CloudUpload] Failed for bling_${blingId}:`, data?.error?.message || data);
      return { bling_id: blingId, success: false, error: data?.error?.message || "Upload failed" };
    }

    return { bling_id: blingId, success: true, url: data.secure_url };
  } catch (err: any) {
    console.error(`[CloudUpload] Exception for bling_${blingId}:`, err.message);
    return { bling_id: blingId, success: false, error: err.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    let accountId: string | null = null;
    let forceReupload = false;
    let limit: number | null = null;

    try {
      const body = await req.json();
      accountId = body.account_id || null;
      forceReupload = body.force_reupload || false;
      limit = body.limit || null;
    } catch {
      // No body
    }

    if (!accountId) {
      const { data: defaultCreds } = await supabase
        .from("cloudinary_credentials")
        .select("account_id")
        .limit(1)
        .maybeSingle();
      accountId = defaultCreds?.account_id || null;
    }

    if (!accountId) {
      return new Response(JSON.stringify({ error: "No account_id provided and no Cloudinary credentials found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Cloudinary credentials
    const { data: creds } = await supabase
      .from("cloudinary_credentials")
      .select("*")
      .eq("account_id", accountId)
      .maybeSingle();

    if (!creds) {
      return new Response(JSON.stringify({ error: "Cloudinary credentials not configured for this account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get products that need image upload
    let query = supabase
      .from("produtos_catalogo")
      .select("id, bling_id, imagem_bling")
      .not("imagem_bling", "is", null);

    if (!forceReupload) {
      query = query.is("cloudinary_uploaded_at", null);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data: products, error: prodErr } = await query;

    if (prodErr) {
      console.error("[CloudUpload] Error fetching products:", prodErr);
      throw prodErr;
    }

    if (!products || products.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        uploaded: 0,
        skipped: 0,
        message: "Nenhum produto pendente para upload",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[CloudUpload] Starting upload of ${products.length} images for account ${accountId}`);

    const results: UploadResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Process in batches to avoid overwhelming Cloudinary
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      console.log(`[CloudUpload] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(products.length / BATCH_SIZE)} (${batch.length} items)`);

      const batchResults = await Promise.all(
        batch.map(async (p, idx) => {
          // Stagger requests within batch
          if (idx > 0) {
            await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS * idx));
          }
          return uploadToCloudinary(
            p.imagem_bling,
            p.bling_id,
            creds.cloud_name,
            creds.api_key,
            creds.api_secret,
            creds.upload_tag || "loja_filhos_com_estilo",
          );
        }),
      );

      results.push(...batchResults);

      // Update DB for successful uploads
      const successfulIds = batchResults.filter((r) => r.success).map((r) => r.bling_id);
      if (successfulIds.length > 0) {
        const { error: updErr } = await supabase
          .from("produtos_catalogo")
          .update({ cloudinary_uploaded_at: new Date().toISOString() })
          .in("bling_id", successfulIds);
        if (updErr) {
          console.error("[CloudUpload] Failed to mark uploaded:", updErr.message);
        }
      }

      successCount += batchResults.filter((r) => r.success).length;
      failureCount += batchResults.filter((r) => !r.success).length;
    }

    // Update last_sync stats
    await supabase
      .from("cloudinary_credentials")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_count: successCount,
      })
      .eq("account_id", accountId);

    console.log(`[CloudUpload] Done. Success: ${successCount}, Failed: ${failureCount}`);

    return new Response(JSON.stringify({
      success: true,
      uploaded: successCount,
      failed: failureCount,
      total_processed: products.length,
      failures: results.filter((r) => !r.success).slice(0, 10), // First 10 failures for debugging
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[CloudUpload] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
