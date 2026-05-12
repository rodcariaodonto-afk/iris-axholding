import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  conversation_id: string;
  to_user_id?: string | null;
  to_queue_id?: string | null;
  reason?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
    if (cErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const callerId = claims.claims.sub as string;

    const body = (await req.json()) as Body;
    if (!body.conversation_id) return json({ error: "conversation_id required" }, 400);
    if (!body.to_user_id && !body.to_queue_id) {
      return json({ error: "to_user_id or to_queue_id required" }, 400);
    }

    // Conversation + account check
    const { data: conv, error: convErr } = await admin
      .from("conversations")
      .select("id, account_id, contact_id, assigned_user_id")
      .eq("id", body.conversation_id)
      .maybeSingle();
    if (convErr || !conv) return json({ error: "Conversation not found" }, 404);

    // Caller must be a member of the account
    const { data: isMember } = await userClient.rpc("is_account_member", { _account_id: conv.account_id });
    if (!isMember) return json({ error: "Forbidden" }, 403);

    // Caller may transfer if owner of conversation OR has manager+ role
    const { data: isManager } = await userClient.rpc("has_account_role", {
      _account_id: conv.account_id,
      _roles: ["owner", "admin", "manager"],
    });
    const isOwner = conv.assigned_user_id === callerId;
    if (!isOwner && !isManager) return json({ error: "Forbidden" }, 403);

    // Resolve target user
    let targetUserId: string | null = body.to_user_id ?? null;

    if (!targetUserId && body.to_queue_id) {
      const { data: queue } = await admin
        .from("whatsapp_queues")
        .select("id, account_id")
        .eq("id", body.to_queue_id)
        .maybeSingle();
      if (!queue || queue.account_id !== conv.account_id) {
        return json({ error: "Queue not found" }, 404);
      }
      const { data: members } = await admin
        .from("whatsapp_queue_members")
        .select("user_id")
        .eq("queue_id", body.to_queue_id);
      if (members && members.length > 0) {
        // Round-robin: pick the member with fewest currently assigned active conversations
        const counts = await Promise.all(members.map(async (m) => {
          const { count } = await admin
            .from("conversations")
            .select("id", { count: "exact", head: true })
            .eq("account_id", conv.account_id)
            .eq("assigned_user_id", m.user_id)
            .eq("is_active", true);
          return { user_id: m.user_id, count: count ?? 0 };
        }));
        counts.sort((a, b) => a.count - b.count);
        targetUserId = counts[0].user_id;
      } else {
        return json({ error: "Queue has no members" }, 400);
      }
    }

    if (targetUserId) {
      // Validate target is a member of the account
      const { data: targetMember } = await admin
        .from("account_members")
        .select("user_id")
        .eq("account_id", conv.account_id)
        .eq("user_id", targetUserId)
        .eq("status", "active")
        .maybeSingle();
      if (!targetMember) return json({ error: "Target user is not a member" }, 400);
    }

    // Update conversation
    const { error: updErr } = await admin
      .from("conversations")
      .update({
        assigned_user_id: targetUserId,
        status: "human",
        updated_at: new Date().toISOString(),
      })
      .eq("id", conv.id);
    if (updErr) return json({ error: updErr.message }, 500);

    // Log transfer
    await admin.from("whatsapp_transfer_logs").insert({
      account_id: conv.account_id,
      conversation_id: conv.id,
      contact_id: conv.contact_id,
      from_user_id: conv.assigned_user_id,
      to_user_id: targetUserId,
      to_queue_id: body.to_queue_id ?? null,
      reason: body.reason ?? null,
      transferred_by: callerId,
    });

    // Audit log
    await admin.rpc("log_audit_v2", {
      _account_id: conv.account_id,
      _event_type: "conversation.transferred",
      _severity: "info",
      _entity_type: "conversation",
      _entity_id: conv.id,
      _action: "conversation.transferred",
      _old: { assigned_user_id: conv.assigned_user_id },
      _new: { assigned_user_id: targetUserId, to_queue_id: body.to_queue_id ?? null },
      _metadata: { reason: body.reason ?? null },
    });

    return json({ ok: true, assigned_user_id: targetUserId });
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
