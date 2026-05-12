import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "./useActiveAccount";

export interface PlanInfo {
  code: string;
  name: string;
  max_users: number;
  max_contacts: number;
  max_messages_month: number;
  max_whatsapp_numbers: number;
  ai_responses_month: number;
  price_monthly: number;
  features: Record<string, unknown>;
}

export interface UsageInfo {
  users: number;
  contacts: number;
  messages_month: number;
}

export function useAccountUsage() {
  const { activeAccountId } = useActiveAccount();
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [usage, setUsage] = useState<UsageInfo>({ users: 0, contacts: 0, messages_month: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeAccountId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: acc } = await supabase.from("accounts").select("plan").eq("id", activeAccountId).single();
      if (acc?.plan) {
        const { data: planRow } = await supabase.from("account_plans" as any).select("*").eq("code", acc.plan).maybeSingle();
        if (!cancelled && planRow) setPlan(planRow as PlanInfo);
      }
      const monthStart = new Date();
      monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const [{ count: users }, { count: contacts }, { count: messages }] = await Promise.all([
        supabase.from("account_members").select("id", { count: "exact", head: true }).eq("account_id", activeAccountId).eq("status", "active"),
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("account_id", activeAccountId),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("account_id", activeAccountId).gte("created_at", monthStart.toISOString()),
      ]);
      if (!cancelled) {
        setUsage({ users: users || 0, contacts: contacts || 0, messages_month: messages || 0 });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeAccountId]);

  return { plan, usage, loading };
}
