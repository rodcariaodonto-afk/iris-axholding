import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminAudit() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("audit_logs")
        .select("*, account:accounts(name, slug)")
        .order("created_at", { ascending: false })
        .limit(300);
      setLogs(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Auditoria global</h2>
        <p className="text-sm text-muted-foreground">Últimos 300 eventos em todas as contas.</p>
      </div>

      <div className="rounded-xl bg-card border border-border/40 divide-y divide-border/40">
        {logs.map((log) => (
          <div key={log.id} className="p-3 flex items-start gap-3 text-sm">
            <Activity className="w-3.5 h-3.5 text-primary mt-1 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">{log.action}</div>
              <div className="text-xs text-muted-foreground">{log.account?.name || log.account_id} · {log.resource_type}</div>
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(log.created_at), { locale: ptBR, addSuffix: true })}</div>
          </div>
        ))}
        {logs.length === 0 && <div className="p-12 text-center text-muted-foreground">Sem eventos.</div>}
      </div>
    </div>
  );
}
