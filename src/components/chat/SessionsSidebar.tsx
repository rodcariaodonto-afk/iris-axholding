import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { Smartphone, CheckCircle2, AlertCircle, Loader2, Inbox } from "lucide-react";

interface Session {
  id: string;
  session_name: string;
  provider: "evolution" | "meta_cloud";
  status: string;
  phone_number: string | null;
  is_default: boolean;
  owner_user_id: string | null;
}

interface Props {
  selected: string; // "all" | session_id
  onSelect: (id: string) => void;
  conversationCounts: Record<string, number>; // by session_id, plus "all"
}

export default function SessionsSidebar({ selected, onSelect, conversationCounts }: Props) {
  const { activeAccountId } = useActiveAccount();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeAccountId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await (supabase as any)
        .from("whatsapp_sessions")
        .select("id, session_name, provider, status, phone_number, is_default, owner_user_id")
        .eq("account_id", activeAccountId)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setSessions((data as Session[]) || []);
        setLoading(false);
      }
    };
    load();
    const ch = supabase
      .channel(`chat-sessions-${activeAccountId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_sessions", filter: `account_id=eq.${activeAccountId}` },
        () => load(),
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeAccountId]);

  const totalAll = conversationCounts["all"] ?? 0;

  return (
    <div className="w-56 shrink-0 border-r border-slate-800 bg-slate-900/40 flex flex-col">
      <div className="p-4 border-b border-slate-800/50">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sessões WhatsApp</h3>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        <button
          onClick={() => onSelect("all")}
          className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 transition ${
            selected === "all" ? "bg-cyan-500/10 border border-cyan-500/30" : "hover:bg-slate-800/60 border border-transparent"
          }`}
        >
          <Inbox className={`w-4 h-4 shrink-0 ${selected === "all" ? "text-cyan-400" : "text-slate-400"}`} />
          <span className={`flex-1 text-sm font-medium ${selected === "all" ? "text-white" : "text-slate-300"}`}>Todas</span>
          <span className="text-[10px] text-slate-500 font-mono">{totalAll}</span>
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-[11px] text-slate-500 px-3 py-4 text-center">
            Nenhuma sessão conectada. Configure em Configurações → WhatsApp.
          </p>
        ) : (
          sessions.map((s) => {
            const isActive = selected === s.id;
            const isConnected = s.status === "connected";
            const count = conversationCounts[s.id] ?? 0;
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg flex items-start gap-2.5 transition ${
                  isActive ? "bg-cyan-500/10 border border-cyan-500/30" : "hover:bg-slate-800/60 border border-transparent"
                }`}
              >
                <div className="relative shrink-0 mt-0.5">
                  <Smartphone className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
                  {isConnected ? (
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 absolute -bottom-0.5 -right-0.5 bg-slate-900 rounded-full" />
                  ) : (
                    <AlertCircle className="w-2.5 h-2.5 text-amber-400 absolute -bottom-0.5 -right-0.5 bg-slate-900 rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-sm font-medium truncate ${isActive ? "text-white" : "text-slate-300"}`}>
                      {s.session_name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">{count}</span>
                  </div>
                  {s.phone_number && (
                    <div className="text-[10px] text-slate-500 truncate font-mono">{s.phone_number}</div>
                  )}
                  <div className="text-[9px] uppercase tracking-wider text-slate-600 mt-0.5">
                    {s.provider === "meta_cloud" ? "Meta" : "Evolution"}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
