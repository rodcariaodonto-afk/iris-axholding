import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const TYPES = ["access", "rectification", "portability", "erasure", "anonymization", "consent_revocation", "opposition"];

export default function GovernanceDSAR() {
  const { activeAccountId } = useActiveAccount();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ requester_name: "", requester_email: "", request_type: "access", description: "" });

  const load = async () => {
    if (!activeAccountId) return;
    const { data } = await supabase.from("data_subject_requests").select("*").eq("account_id", activeAccountId).order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, [activeAccountId]);

  const create = async () => {
    if (!activeAccountId) return;
    const { error } = await supabase.from("data_subject_requests").insert({ account_id: activeAccountId, ...form, status: "open" });
    if (error) return toast.error(error.message);
    toast.success("Pedido criado"); setOpen(false); setForm({ requester_name: "", requester_email: "", request_type: "access", description: "" });
    await load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("data_subject_requests").update({
      status, resolved_at: ["resolved", "rejected"].includes(status) ? new Date().toISOString() : null,
    }).eq("id", id);
    await load();
  };

  const cols = [
    { key: "open", label: "Abertos" },
    { key: "in_progress", label: "Em andamento" },
    { key: "resolved", label: "Resolvidos" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Pedidos LGPD/GDPR dos titulares dos dados. Prazo padrão: 15 dias.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Novo pedido</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar pedido do titular</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={form.requester_name} onChange={(e) => setForm({ ...form, requester_name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.requester_email} onChange={(e) => setForm({ ...form, requester_email: e.target.value })} /></div>
              <div><Label>Tipo</Label>
                <Select value={form.request_type} onValueChange={(v) => setForm({ ...form, request_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <Button className="w-full" onClick={create} disabled={!form.requester_name || !form.requester_email}>Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {cols.map((c) => (
          <Card key={c.key}>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">{c.label} <Badge variant="secondary" className="ml-2">{items.filter(i => i.status === c.key).length}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {items.filter(i => i.status === c.key).map(i => (
                <div key={i.id} className="border border-border/40 rounded-md p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{i.requester_name}</span>
                    <Badge variant="outline" className="text-xs">{i.request_type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{i.requester_email}</p>
                  {i.description && <p className="text-xs">{i.description}</p>}
                  <p className="text-xs text-muted-foreground">Prazo: {new Date(i.due_at).toLocaleDateString("pt-BR")}</p>
                  <div className="flex gap-1 pt-2">
                    {c.key === "open" && <Button size="sm" variant="outline" onClick={() => updateStatus(i.id, "in_progress")}>Atender</Button>}
                    {c.key === "in_progress" && <Button size="sm" variant="outline" onClick={() => updateStatus(i.id, "resolved")}>Resolver</Button>}
                    {c.key !== "resolved" && <Button size="sm" variant="ghost" onClick={() => updateStatus(i.id, "rejected")}>Rejeitar</Button>}
                  </div>
                </div>
              ))}
              {items.filter(i => i.status === c.key).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Vazio</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
