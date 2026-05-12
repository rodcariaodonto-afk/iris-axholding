import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function AdminUsers() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("account_members")
        .select("user_id, role, status, joined_at, account:accounts(name, slug)")
        .eq("status", "active")
        .order("joined_at", { ascending: false })
        .limit(500);
      const userIds = Array.from(new Set((data || []).map((r: any) => r.user_id)));
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const profMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
      setRows((data || []).map((r: any) => ({ ...r, full_name: profMap.get(r.user_id) || "—" })));
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter(r => !search || (r.full_name || "").toLowerCase().includes(search.toLowerCase()) || (r.account?.name || "").toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Usuários ({rows.length})</h2>
          <p className="text-sm text-muted-foreground">Membros ativos em todas as contas.</p>
        </div>
        <Input placeholder="Buscar..." className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-xl bg-card border border-border/40 divide-y divide-border/40">
        {filtered.map((r, i) => (
          <div key={`${r.user_id}-${i}`} className="p-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><User className="w-4 h-4" /></div>
            <div className="flex-1">
              <div className="font-medium text-sm">{r.full_name}</div>
              <div className="text-xs text-muted-foreground">{r.account?.name} · /{r.account?.slug}</div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full border border-border/40 capitalize">{r.role}</span>
          </div>
        ))}
        {filtered.length === 0 && <div className="p-12 text-center text-muted-foreground">Nenhum usuário.</div>}
      </div>
    </div>
  );
}
