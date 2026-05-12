import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function GovernanceAudit() {
  const { activeAccountId } = useActiveAccount();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!activeAccountId) return;
    (async () => {
      setLoading(true);
      let q = supabase.from("audit_logs").select("*").eq("account_id", activeAccountId).order("created_at", { ascending: false }).limit(200);
      if (severity !== "all") q = q.eq("severity", severity as "info" | "warn" | "critical");
      const { data } = await q;
      setLogs(data ?? []);
      setLoading(false);
    })();
  }, [activeAccountId, severity]);

  const filtered = logs.filter((l) => !search || JSON.stringify(l).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Input placeholder="Buscar evento, ator, recurso…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas severidades</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Aviso</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="p-6 text-sm text-muted-foreground">Carregando…</p> :
            filtered.length === 0 ? <p className="p-6 text-sm text-muted-foreground text-center">Nenhum evento registrado.</p> : (
            <div className="divide-y divide-border/30">
              {filtered.map((l) => (
                <div key={l.id} className="p-4 hover:bg-secondary/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={l.severity === "critical" ? "destructive" : l.severity === "warn" ? "secondary" : "outline"}>{l.severity}</Badge>
                        <span className="font-mono text-sm">{l.event_type ?? l.action}</span>
                        {l.entity_type && <span className="text-xs text-muted-foreground">{l.entity_type}/{l.entity_id?.slice(0, 8)}</span>}
                      </div>
                      {l.metadata && Object.keys(l.metadata).length > 0 && (
                        <pre className="text-xs text-muted-foreground mt-1 overflow-x-auto">{JSON.stringify(l.metadata, null, 2)}</pre>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
