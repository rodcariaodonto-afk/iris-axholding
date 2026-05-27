/**
 * Shared Bling token management — handles OAuth2 access token refresh.
 * Used by bling-catalog-sync and product-search Edge Functions.
 */

const BLING_TOKEN_URL = "https://api.bling.com.br/Api/v3/oauth/token";

export interface BlingCredentials {
  id: string;
  account_id: string;
  client_id: string;
  client_secret: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
}

/**
 * Gets a valid Bling access token, refreshing it if expired.
 * Returns null if credentials are missing or refresh fails.
 */
export async function getValidBlingToken(supabase: any, accountId: string): Promise<string | null> {
  const { data: creds } = await supabase
    .from("bling_credentials")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();

  if (!creds) {
    console.error("[bling-token] No credentials for account:", accountId);
    return null;
  }

  // Token still valid? (with 60s safety margin)
  if (creds.access_token && creds.expires_at && new Date(creds.expires_at) > new Date(Date.now() + 60000)) {
    return creds.access_token;
  }

  if (!creds.refresh_token) {
    console.error("[bling-token] No refresh_token, user must re-authorize");
    return null;
  }

  console.log("[bling-token] Refreshing Bling token for account:", accountId);

  try {
    const basicAuth = btoa(`${creds.client_id}:${creds.client_secret}`);
    const response = await fetch(BLING_TOKEN_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "1.0",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: creds.refresh_token,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[bling-token] Refresh failed:", response.status, errText);
      return null;
    }

    const tokenData = await response.json();
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 21600) * 1000).toISOString();

    await supabase
      .from("bling_credentials")
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || creds.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", creds.id);

    return tokenData.access_token;
  } catch (err) {
    console.error("[bling-token] Refresh exception:", err);
    return null;
  }
}

/**
 * Fetches real-time stock balance for a list of product IDs from Bling.
 * Returns a map of bling_id → { saldoFisico, saldoVirtual }.
 * Has a configurable timeout — caller should treat empty/partial map as "use cache".
 */
export async function fetchBlingStockBatch(
  accessToken: string,
  blingIds: number[],
  timeoutMs: number = 3000,
): Promise<Record<number, { saldoFisico: number; saldoVirtual: number }>> {
  if (blingIds.length === 0) return {};

  // Bling endpoint accepts up to ~100 IDs per call via query string
  const params = blingIds.map((id) => `idsProdutos[]=${id}`).join("&");
  const url = `https://api.bling.com.br/Api/v3/estoques/saldos?${params}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn("[bling-token] Stock fetch failed:", res.status);
      return {};
    }

    const data = await res.json();
    const items = data.data || [];

    const stockMap: Record<number, { saldoFisico: number; saldoVirtual: number }> = {};
    for (const item of items) {
      const id = item.produto?.id;
      if (id) {
        stockMap[id] = {
          saldoFisico: Number(item.saldoFisico ?? 0),
          saldoVirtual: Number(item.saldoVirtual ?? 0),
        };
      }
    }

    return stockMap;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      console.warn(`[bling-token] Stock fetch timed out after ${timeoutMs}ms`);
    } else {
      console.warn("[bling-token] Stock fetch error:", err.message);
    }
    return {};
  }
}
