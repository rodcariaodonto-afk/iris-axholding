import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle, Download, Trash2, UserSearch, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export default function GovernanceOverview() {
  const { activeAccountId } = useActiveAccount();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeAccountId) return;
    (async () => {
      setLoading(true);
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const [exp, dsar, del, crit, pol, acc] = await Promise.all([
        supabase.from("data_exports").select("id, created_at, status").eq("account_id", activeAccountId).order("created_at", { ascending: false }).limit(1),
        supabase.from("data_subject_requests").select("id", { count: "exact", head: true }).eq("account_id", activeAccountId).in("status", ["open", "in_progress"]),
        supabase.from("data_deletion_requests").select("id", { count: "exact", head: true }).eq("account_id", activeAccountId).in("status", ["pending", "scheduled"]),
        supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("account_id", activeAccountId).eq("severity", "critical").gte("created_at", since30),
        supabase.from("account_policies").select("retention_days_after_cancel, dpo_email").eq("account_id", activeAccountId).maybeSingle(),
        supabase.from("accounts").select("status, retention_until, deletion_status").eq("id", activeAccountId).single(),
      ]);
      setStats({
        lastExport: exp.data?.[0],
        openDsar: dsar.count ?? 0,
        pendingDeletions: del.count ?? 0,
        critical30d: crit.count ?? 0,
        policy: pol.data,
        account: acc.data,
      });
      setLoading(false);
    })();
  }, [activeAccountId]);

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;

  const cards = [
    { icon: Download, label: "Última exportação", value: stats.lastExport ? new Date(stats.lastExport.created_at).toLocaleDateString("pt-BR") : "Nenhuma", to: "/account/governance/exports" },
    { icon: UserSearch, label: "Pedidos de titulares abertos", value: stats.openDsar, to: "/account/governance/dsar", warn: stats.openDsar > 0 },
    { icon: Trash2, label: "Pedidos de exclusão pendentes", value: stats.pendingDeletions, to: "/account/governance/retention", warn: stats.pendingDeletions > 0 },
    { icon: AlertTriangle, label: "Eventos críticos (30d)", value: stats.critical30d, to: "/account/governance/audit", warn: stats.critical30d > 0 },
    { icon: ShieldCheck, label: "Política de retenção", value: stats.policy ? `${stats.policy.retention_days_after_cancel}d` : "Padrão (30d)", to: "/account/governance/policies" },
    { icon: Activity, label: "Status da conta", value: stats.account?.status ?? "—", to: "/account/governance/retention", warn: stats.account?.status !== "active" },
  ];

  return (
    <div className="space-y-6">
      {stats.account?.deletion_status === "scheduled" && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">Exclusão agendada</p>
              <p className="text-sm text-muted-foreground">Esta conta será excluída em {stats.account.retention_until ? new Date(stats.account.retention_until).toLocaleDateString("pt-BR") : "—"}.</p>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link to={c.to} key={c.label}>
            <Card className={`hover:border-primary/40 transition-colors ${c.warn ? "border-amber-500/40 bg-amber-500/5" : ""}`}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm text-muted-foreground font-normal">{c.label}</CardTitle>
                <c.icon className={`w-4 h-4 ${c.warn ? "text-amber-500" : "text-muted-foreground"}`} />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{c.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
