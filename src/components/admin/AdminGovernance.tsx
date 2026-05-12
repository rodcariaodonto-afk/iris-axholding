import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AdminGovernance() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);

  const load = async () => {
    const [a, d] = await Promise.all([
      supabase.from("accounts").select("id, name, status, deletion_status, retention_until, cancelled_at").order("created_at", { ascending: false }),
      supabase.from("data_deletion_requests").select("*, accounts(name)").in("status", ["pending", "scheduled"]).order("created_at", { ascending: false }),
    ]);
    setAccounts(a.data ?? []); setPending(d.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const act = async (id: string, action: "approve" | "cancel") => {
    const { error } = await supabase.functions.invoke("account-deletion-approve", { body: { request_id: id, action } });
    if (error) return toast.error(error.message);
    toast.success(action === "approve" ? "Aprovado" : "Cancelado"); await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-3">Pedidos de exclusão pendentes</h2>
        <Card><CardContent className="p-0">
          {pending.length === 0 ? <p className="p-6 text-sm text-muted-foreground text-center">Nenhum pedido pendente.</p> : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/40"><tr className="text-left text-xs text-muted-foreground uppercase">
                <th className="p-3">Conta</th><th className="p-3">Status</th><th className="p-3">Agendado</th><th className="p-3">Motivo</th><th className="p-3"></th>
              </tr></thead>
              <tbody>
                {pending.map(r => (
                  <tr key={r.id} className="border-b border-border/20">
                    <td className="p-3">{r.accounts?.name}</td>
                    <td className="p-3"><Badge variant="destructive">{r.status}</Badge></td>
                    <td className="p-3">{r.scheduled_for ? new Date(r.scheduled_for).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-3 text-xs">{r.reason ?? "—"}</td>
                    <td className="p-3 text-right space-x-2">
                      {r.status === "pending" && <Button size="sm" onClick={() => act(r.id, "approve")}>Aprovar</Button>}
                      <Button size="sm" variant="outline" onClick={() => act(r.id, "cancel")}>Cancelar</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent></Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Visão global de contas</h2>
        <Card><CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border/40"><tr className="text-left text-xs text-muted-foreground uppercase">
              <th className="p-3">Conta</th><th className="p-3">Status</th><th className="p-3">Exclusão</th><th className="p-3">Retenção até</th>
            </tr></thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.id} className="border-b border-border/20">
                  <td className="p-3">{a.name}</td>
                  <td className="p-3"><Badge variant={a.status === "active" ? "default" : "destructive"}>{a.status}</Badge></td>
                  <td className="p-3"><Badge variant="outline">{a.deletion_status}</Badge></td>
                  <td className="p-3">{a.retention_until ? new Date(a.retention_until).toLocaleDateString("pt-BR") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      </div>
    </div>
  );
}
