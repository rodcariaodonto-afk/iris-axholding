import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Info, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function GovernanceCompliance() {
  const { activeAccountId } = useActiveAccount();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!activeAccountId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("compliance-report", { body: { account_id: activeAccountId } });
      if (error) throw error;
      setReport(data);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `compliance-${activeAccountId}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const icon = (s: string) => s === "ok" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : s === "warn" ? <AlertCircle className="w-4 h-4 text-amber-500" /> : <Info className="w-4 h-4 text-muted-foreground" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Avalia o estado de conformidade da conta. O relatório pode ser exportado em JSON.</p>
        <div className="flex gap-2">
          {report && <Button variant="outline" onClick={exportJson}><Download className="w-4 h-4 mr-2" />Exportar JSON</Button>}
          <Button onClick={generate} disabled={loading}>{loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Gerar relatório</Button>
        </div>
      </div>

      {!report ? (
        <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">Clique em "Gerar relatório" para avaliar a conformidade da conta.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-emerald-500">{report.summary.ok}</p><p className="text-xs text-muted-foreground">OK</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-amber-500">{report.summary.warn}</p><p className="text-xs text-muted-foreground">Avisos</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-muted-foreground">{report.summary.info}</p><p className="text-xs text-muted-foreground">Info</p></CardContent></Card>
          </div>
          <Card><CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {report.checks.map((c: any) => (
                <div key={c.id} className="p-3 flex items-center gap-3">
                  {icon(c.status)}
                  <span className="flex-1 text-sm">{c.label}</span>
                  {c.value !== undefined && <Badge variant="outline">{c.value}</Badge>}
                </div>
              ))}
            </div>
          </CardContent></Card>
        </div>
      )}
    </div>
  );
}
