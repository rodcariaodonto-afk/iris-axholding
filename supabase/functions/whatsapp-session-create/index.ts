import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  account_id: string;
  provider: "evolution" | "meta_cloud";
  session_name: string;
  is_default?: boolean;
  // evolution
  evolution_instance_name?: string;
  // meta cloud
  whatsapp_phone_number_id?: string;
  whatsapp_business_account_id?: string;
  whatsapp_access_token?: string;
  whatsapp_verify_token?: string;
  owner_user_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
    if (cErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = (await req.json()) as Body;
    if (!body.account_id || !body.provider || !body.session_name) {
      return json({ error: "Missing fields" }, 400);
    }

    // Permissão owner/admin/manager
    const { data: roleOk } = await supabase.rpc("has_account_role", {
      _account_id: body.account_id,
      _roles: ["owner", "admin", "manager"],
    });
    if (!roleOk) return json({ error: "Forbidden" }, 403);

    // Limite por plano
    const { data: limit } = await supabase.rpc("check_account_limit", {
      _account_id: body.account_id,
      _resource: "whatsapp_numbers",
    });
    // check_account_limit usa count de mensagens/users/contacts; whatsapp_numbers cai em retorno default {allowed: true}.
    // Validamos manualmente contra max_sessions/plan max_whatsapp_numbers.
    const [{ count }, { data: accSettings }, { data: account }] = await Promise.all([
      supabase.from("whatsapp_sessions").select("id", { count: "exact", head: true }).eq("account_id", body.account_id),
      supabase.from("whatsapp_account_settings").select("max_sessions").eq("account_id", body.account_id).maybeSingle(),
      supabase.from("accounts").select("plan").eq("id", body.account_id).maybeSingle(),
    ]);
    let planMax = 1;
    if (account?.plan) {
      const { data: p } = await supabase.from("account_plans").select("max_whatsapp_numbers").eq("code", account.plan).maybeSingle();
      planMax = p?.max_whatsapp_numbers ?? 1;
    }
    const accountMax = accSettings?.max_sessions ?? 3;
    const effectiveMax = Math.min(planMax, accountMax);
    if ((count ?? 0) >= effectiveMax) {
      return json({ error: "limit_reached", current: count, limit: effectiveMax }, 409);
    }

    const providedInstanceName = body.evolution_instance_name?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") || null;
    const evolutionInstanceName = body.provider === "evolution"
      ? providedInstanceName || `iris-${body.account_id.slice(0, 8)}-${userId.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}`
      : null;

    if (evolutionInstanceName) {
      const { data: existingSession } = await supabase
        .from("whatsapp_sessions")
        .select("id, session_name")
        .eq("account_id", body.account_id)
        .ilike("evolution_instance_name", evolutionInstanceName)
        .maybeSingle();
      if (existingSession) {
        return json({ error: "instance_name_in_use", details: `A instância ${evolutionInstanceName} já está em uso por ${existingSession.session_name}` }, 409);
      }
    }

    // Insert
    const { data: session, error: insErr } = await supabase
      .from("whatsapp_sessions")
      .insert({
        account_id: body.account_id,
        provider: body.provider,
        session_name: body.session_name,
        status: "disconnected",
        is_default: body.is_default ?? (count === 0),
        evolution_instance_name: evolutionInstanceName,
        whatsapp_phone_number_id: body.whatsapp_phone_number_id ?? null,
        whatsapp_business_account_id: body.whatsapp_business_account_id ?? null,
        whatsapp_access_token: body.whatsapp_access_token ?? null,
        whatsapp_verify_token: body.whatsapp_verify_token ?? null,
        owner_user_id: body.owner_user_id ?? userId,
        created_by: userId,
      })
      .select()
      .single();
    if (insErr) return json({ error: insErr.message }, 400);

    // Se marcado como default, desmarca os outros
    if (session.is_default) {
      await supabase.from("whatsapp_sessions").update({ is_default: false })
        .eq("account_id", body.account_id).neq("id", session.id);
    }

    return json({ ok: true, session }, 200);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
