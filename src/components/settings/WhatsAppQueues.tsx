import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Users, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface Queue {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
}

interface Member {
  id: string;
  user_id: string;
  full_name: string | null;
}

interface AccountMember {
  user_id: string;
  role: string;
  full_name: string | null;
}

export default function WhatsAppQueues() {
  const { activeAccountId } = useActiveAccount();
  const [loading, setLoading] = useState(true);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [selected, setSelected] = useState<Queue | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [accountMembers, setAccountMembers] = useState<AccountMember[]>([]);
  const [newQueueName, setNewQueueName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (activeAccountId) loadAll();
  }, [activeAccountId]);

  useEffect(() => {
    if (selected) loadMembers(selected.id);
    else setMembers([]);
  }, [selected]);

  async function loadAll() {
    if (!activeAccountId) return;
    setLoading(true);
    const [{ data: qs }, { data: ams }] = await Promise.all([
      supabase.from("whatsapp_queues").select("*").eq("account_id", activeAccountId).order("name"),
      supabase
        .from("account_members")
        .select("user_id, role, profiles:user_id(full_name)")
        .eq("account_id", activeAccountId)
        .eq("status", "active"),
    ]);
    setQueues((qs as Queue[]) ?? []);
    setAccountMembers(
      (ams ?? []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        full_name: m.profiles?.full_name ?? null,
      })),
    );
    if (qs && qs.length > 0 && !selected) setSelected(qs[0] as Queue);
    setLoading(false);
  }

  async function loadMembers(queueId: string) {
    const { data } = await supabase
      .from("whatsapp_queue_members")
      .select("id, user_id, profiles:user_id(full_name)")
      .eq("queue_id", queueId);
    setMembers(
      (data ?? []).map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        full_name: m.profiles?.full_name ?? null,
      })),
    );
  }

  async function createQueue() {
    if (!activeAccountId || !newQueueName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("whatsapp_queues")
      .insert({ account_id: activeAccountId, name: newQueueName.trim() })
      .select()
      .single();
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewQueueName("");
    setQueues((q) => [...q, data as Queue]);
    setSelected(data as Queue);
    toast.success("Fila criada");
  }

  async function removeQueue(q: Queue) {
    if (!confirm(`Excluir a fila "${q.name}"?`)) return;
    const { error } = await supabase.from("whatsapp_queues").delete().eq("id", q.id);
    if (error) return toast.error(error.message);
    setQueues((qs) => qs.filter((x) => x.id !== q.id));
    if (selected?.id === q.id) setSelected(null);
  }

  async function addMember(userId: string) {
    if (!selected || !activeAccountId) return;
    const { error } = await supabase.from("whatsapp_queue_members").insert({
      queue_id: selected.id,
      user_id: userId,
      account_id: activeAccountId,
    });
    if (error) return toast.error(error.message);
    loadMembers(selected.id);
  }

  async function removeMember(memberId: string) {
    const { error } = await supabase.from("whatsapp_queue_members").delete().eq("id", memberId);
    if (error) return toast.error(error.message);
    if (selected) loadMembers(selected.id);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const availableMembers = accountMembers.filter(
    (am) => !members.some((m) => m.user_id === am.user_id),
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Lista de filas */}
      <Card className="p-4 space-y-3 md:col-span-1">
        <div className="flex gap-2">
          <Input
            placeholder="Nova fila (ex.: SDR, Closer)"
            value={newQueueName}
            onChange={(e) => setNewQueueName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createQueue()}
          />
          <Button onClick={createQueue} disabled={creating || !newQueueName.trim()} size="icon">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
        <div className="space-y-1">
          {queues.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma fila criada
            </p>
          )}
          {queues.map((q) => (
            <button
              key={q.id}
              onClick={() => setSelected(q)}
              className={`w-full text-left px-3 py-2 rounded-md flex items-center justify-between group transition-colors ${
                selected?.id === q.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
              }`}
            >
              <span className="font-medium">{q.name}</span>
              <Trash2
                className="w-4 h-4 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  removeQueue(q);
                }}
              />
            </button>
          ))}
        </div>
      </Card>

      {/* Detalhes da fila */}
      <Card className="p-4 md:col-span-2">
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Membros da fila "{selected.name}"</h3>
            </div>

            <div className="space-y-2">
              {members.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum membro nesta fila.</p>
              )}
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-md"
                >
                  <span>{m.full_name ?? m.user_id.slice(0, 8)}</span>
                  <Button size="icon" variant="ghost" onClick={() => removeMember(m.id)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {availableMembers.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Adicionar membro</p>
                <div className="flex flex-wrap gap-2">
                  {availableMembers.map((am) => (
                    <Button
                      key={am.user_id}
                      size="sm"
                      variant="outline"
                      onClick={() => addMember(am.user_id)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {am.full_name ?? am.user_id.slice(0, 8)}{" "}
                      <span className="ml-1 text-xs text-muted-foreground">({am.role})</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-12">
            Selecione ou crie uma fila para gerenciar os membros.
          </p>
        )}
      </Card>
    </div>
  );
}
