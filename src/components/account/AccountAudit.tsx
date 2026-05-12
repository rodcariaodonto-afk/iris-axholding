import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { Loader2, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LogRow {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: any;
  actor_user_id: string | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  "member.added": "Membro adicionado",
  "member.updated": "Membro atualizado",
  "member.removed": "Membro removido",
  "account.updated": "Conta atualizada",
  "account.exported": "Dados exportados",
  "account.cancelled": "Conta cancelada",
};

export default function AccountAudit() {
  const { activeAccountId } = useActiveAccount();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeAccountId) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any).from("audit_logs").select("*").eq("account_id", activeAccountId).order("created_at", { ascending: false }).limit(200);
      setLogs((data as LogRow[]) || []);
      setLoading(false);
    })();
  }, [activeAccountId]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Logs de auditoria</h2>
        <p className="text-sm text-muted-foreground">Histórico de ações importantes na conta.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : logs.length === 0 ? (
        <div className="p-12 rounded-xl bg-card border border-border/40 text-center text-muted-foreground">
          <Activity className="w-8 h-8 mx-auto mb-3 opacity-50" />
          Nenhum evento registrado ainda.
        </div>
      ) : (
        <div className="rounded-xl bg-card border border-border/40 divide-y divide-border/40">
          {logs.map((log) => (
            <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{ACTION_LABEL[log.action] || log.action}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{log.resource_type} {log.resource_id && `· ${log.resource_id.substring(0, 8)}`}</div>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <pre className="text-[10px] text-muted-foreground mt-1.5 font-mono bg-muted/30 p-2 rounded max-w-full overflow-x-auto">{JSON.stringify(log.metadata, null, 2)}</pre>
                )}
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(log.created_at), { locale: ptBR, addSuffix: true })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
