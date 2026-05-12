import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function GovernanceExports() {
  const { activeAccountId } = useActiveAccount();
  const [exports, setExports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const load = async () => {
    if (!activeAccountId) return;
    setLoading(true);
    const { data } = await supabase.from("data_exports").select("*").eq("account_id", activeAccountId).order("created_at", { ascending: false });
    setExports(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeAccountId]);

  const request = async () => {
    if (!activeAccountId) return;
    setRequesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("account-export", { body: { account_id: activeAccountId } });
      if (error) throw error;
      toast.success("Exportação concluída");
      if (data?.url) window.open(data.url, "_blank");
      await load();
    } catch (e: any) {
      toast.error("Falha ao exportar", { description: e.message });
    } finally {
      setRequesting(false);
    }
  };

  const download = async (path: string) => {
    const { data } = await supabase.storage.from("account-exports").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Exportações em JSON com isolamento por conta. Áudios e mídias incluem apenas metadados/URLs.</p>
        <Button onClick={request} disabled={requesting}>
          {requesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Solicitar exportação
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
          ) : exports.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Nenhuma exportação realizada ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/40">
                <tr className="text-left text-xs text-muted-foreground uppercase">
                  <th className="p-3">Criado em</th><th className="p-3">Status</th><th className="p-3">Tamanho</th><th className="p-3">Expira</th><th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {exports.map((e) => (
                  <tr key={e.id} className="border-b border-border/20">
                    <td className="p-3">{new Date(e.created_at).toLocaleString("pt-BR")}</td>
                    <td className="p-3"><Badge variant={e.status === "completed" ? "default" : e.status === "failed" ? "destructive" : "secondary"}>{e.status}</Badge></td>
                    <td className="p-3">{e.file_size ? `${(e.file_size / 1024).toFixed(1)} KB` : "—"}</td>
                    <td className="p-3">{e.expires_at ? new Date(e.expires_at).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-3 text-right">
                      {e.status === "completed" && e.file_path && (
                        <Button size="sm" variant="outline" onClick={() => download(e.file_path)}>Baixar</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
