import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowRightLeft, User as UserIcon, Users } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  currentAssignedUserId?: string | null;
  onTransferred?: () => void;
}

interface MemberOption {
  user_id: string;
  full_name: string | null;
  role: string;
  has_session: boolean;
}

interface QueueOption {
  id: string;
  name: string;
  member_count: number;
}

export default function TransferConversationDialog({
  open,
  onOpenChange,
  conversationId,
  currentAssignedUserId,
  onTransferred,
}: Props) {
  const { activeAccountId } = useActiveAccount();
  const [tab, setTab] = useState<"user" | "queue">("user");
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [queues, setQueues] = useState<QueueOption[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && activeAccountId) loadOptions();
  }, [open, activeAccountId]);

  async function loadOptions() {
    if (!activeAccountId) return;
    setLoading(true);
    const [{ data: ams }, { data: sessions }, { data: qs }] = await Promise.all([
      supabase
        .from("account_members")
        .select("user_id, role, profiles:user_id(full_name)")
        .eq("account_id", activeAccountId)
        .eq("status", "active"),
      supabase
        .from("whatsapp_sessions")
        .select("owner_user_id")
        .eq("account_id", activeAccountId),
      supabase
        .from("whatsapp_queues")
        .select("id, name, whatsapp_queue_members(count)")
        .eq("account_id", activeAccountId)
        .eq("is_active", true)
        .order("name"),
    ]);
    const sessionOwners = new Set((sessions ?? []).map((s: any) => s.owner_user_id).filter(Boolean));
    setMembers(
      (ams ?? []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        full_name: m.profiles?.full_name ?? null,
        has_session: sessionOwners.has(m.user_id),
      })),
    );
    setQueues(
      (qs ?? []).map((q: any) => ({
        id: q.id,
        name: q.name,
        member_count: q.whatsapp_queue_members?.[0]?.count ?? 0,
      })),
    );
    setLoading(false);
  }

  async function submit() {
    if (tab === "user" && !selectedUser) return toast.error("Selecione um usuário");
    if (tab === "queue" && !selectedQueue) return toast.error("Selecione uma fila");
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-transfer-conversation", {
      body: {
        conversation_id: conversationId,
        to_user_id: tab === "user" ? selectedUser : null,
        to_queue_id: tab === "queue" ? selectedQueue : null,
        reason: reason.trim() || null,
      },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Erro ao transferir");
      return;
    }
    toast.success("Conversa transferida");
    onOpenChange(false);
    setReason("");
    setSelectedUser(null);
    setSelectedQueue(null);
    onTransferred?.();
  }

  const filtered = members.filter(
    (m) =>
      m.user_id !== currentAssignedUserId &&
      (m.full_name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Transferir conversa
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "user" | "queue")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="user">
              <UserIcon className="w-4 h-4 mr-2" /> Usuário
            </TabsTrigger>
            <TabsTrigger value="queue">
              <Users className="w-4 h-4 mr-2" /> Fila
            </TabsTrigger>
          </TabsList>

          <TabsContent value="user" className="space-y-3">
            <Input
              placeholder="Buscar usuário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {loading && (
                <div className="py-6 text-center">
                  <Loader2 className="w-5 h-5 animate-spin inline" />
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum usuário disponível
                </p>
              )}
              {filtered.map((m) => (
                <button
                  key={m.user_id}
                  onClick={() => setSelectedUser(m.user_id)}
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center justify-between transition-colors ${
                    selectedUser === m.user_id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                >
                  <div>
                    <div className="font-medium">{m.full_name ?? m.user_id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.role}
                      {m.has_session && " · WhatsApp conectado"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="queue" className="space-y-3">
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {loading && (
                <div className="py-6 text-center">
                  <Loader2 className="w-5 h-5 animate-spin inline" />
                </div>
              )}
              {!loading && queues.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma fila criada. Crie filas em Configurações → Filas.
                </p>
              )}
              {queues.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setSelectedQueue(q.id)}
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center justify-between transition-colors ${
                    selectedQueue === q.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                >
                  <span className="font-medium">{q.name}</span>
                  <span className="text-xs text-muted-foreground">{q.member_count} membros</span>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <label className="text-sm font-medium">Motivo (opcional)</label>
          <Textarea
            placeholder="Ex.: Cliente pronto para fechamento"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={
              submitting || (tab === "user" ? !selectedUser : !selectedQueue)
            }
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
