import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function GovernanceRetention() {
  const { activeAccountId, role } = useActiveAccount();
  const [account, setAccount] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!activeAccountId) return;
    const [acc, dr] = await Promise.all([
      supabase.from("accounts").select("*").eq("id", activeAccountId).single(),
      supabase.from("data_deletion_requests").select("*").eq("account_id", activeAccountId).order("created_at", { ascending: false }),
    ]);
    setAccount(acc.data);
    setRequests(dr.data ?? []);
  };
  useEffect(() => { load(); }, [activeAccountId]);

  const requestDeletion = async () => {
    if (confirm !== "EXCLUIR") return toast.error("Digite EXCLUIR para confirmar");
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("account-deletion-request", { body: { account_id: activeAccountId, reason } });
      if (error) throw error;
      toast.success("Pedido criado. Conta entrou em retenção.");
      setOpen(false); setReason(""); setConfirm("");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  const reactivate = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("account-reactivate", { body: { account_id: activeAccountId } });
      if (error) throw error;
      toast.success("Conta reativada");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  const isOwner = role === "owner";
  const inRetention = account?.deletion_status && account.deletion_status !== "none";

  return (
    <div className="space-y-4">
      {inRetention && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">Conta em retenção</p>
                <p className="text-sm text-muted-foreground">
                  Exclusão prevista em <strong>{account.retention_until ? new Date(account.retention_until).toLocaleDateString("pt-BR") : "—"}</strong>.
                  {account.deletion_reason && <> Motivo: {account.deletion_reason}.</>}
                </p>
              </div>
            </div>
            {isOwner && (
              <Button variant="outline" onClick={reactivate} disabled={submitting}>
                <RotateCcw className="w-4 h-4 mr-2" /> Reativar
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cancelar conta e iniciar retenção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Ao cancelar, a conta entra em retenção por 30 dias (ou conforme política). Você pode reativar a qualquer momento durante a janela. Após o prazo, todos os dados são apagados de forma irreversível.
          </p>
          {isOwner && !inRetention && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive"><Trash2 className="w-4 h-4 mr-2" /> Solicitar exclusão</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Confirmar exclusão da conta</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Motivo (opcional)</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>
                  <div>
                    <Label>Digite <strong>EXCLUIR</strong> para confirmar</Label>
                    <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                  </div>
                  <Button variant="destructive" onClick={requestDeletion} disabled={submitting || confirm !== "EXCLUIR"} className="w-full">
                    Solicitar exclusão
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de pedidos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {requests.length === 0 ? <p className="p-6 text-sm text-muted-foreground text-center">Nenhum pedido.</p> : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/40"><tr className="text-left text-xs text-muted-foreground uppercase">
                <th className="p-3">Tipo</th><th className="p-3">Status</th><th className="p-3">Agendado</th><th className="p-3">Criado</th>
              </tr></thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-border/20">
                    <td className="p-3">{r.request_type}</td>
                    <td className="p-3"><Badge variant={r.status === "completed" ? "default" : r.status === "cancelled" ? "secondary" : "destructive"}>{r.status}</Badge></td>
                    <td className="p-3">{r.scheduled_for ? new Date(r.scheduled_for).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-3">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
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
