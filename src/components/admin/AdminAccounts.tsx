import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2, Users as UsersIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface AccountRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  is_internal: boolean;
  created_at: string;
  member_count?: number;
}

const STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  suspended: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function AdminAccounts() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: accs } = await supabase.from("accounts").select("*").order("created_at", { ascending: false });
      const withCounts = await Promise.all((accs || []).map(async (a: any) => {
        const { count } = await supabase.from("account_members").select("id", { count: "exact", head: true }).eq("account_id", a.id).eq("status", "active");
        return { ...a, member_count: count || 0 };
      }));
      setAccounts(withCounts as AccountRow[]);
      setLoading(false);
    })();
  }, []);

  const filtered = accounts.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.slug.includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Contas ({accounts.length})</h2>
          <p className="text-sm text-muted-foreground">Todas as contas no sistema.</p>
        </div>
        <Input placeholder="Buscar por nome ou slug..." className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-xl bg-card border border-border/40 divide-y divide-border/40">
        {filtered.map((a) => (
          <div key={a.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="w-5 h-5 text-primary" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2">
                {a.name}
                {a.is_internal && <Badge variant="outline" className="text-[10px]">Interna</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">/{a.slug} · criada em {format(new Date(a.created_at), "dd/MM/yyyy")}</div>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><UsersIcon className="w-3.5 h-3.5" />{a.member_count}</div>
            <Badge variant="outline" className="capitalize">{a.plan}</Badge>
            <Badge variant="outline" className={STATUS_COLOR[a.status] || ""}>{a.status}</Badge>
          </div>
        ))}
        {filtered.length === 0 && <div className="p-12 text-center text-muted-foreground">Nenhuma conta encontrada.</div>}
      </div>
    </div>
  );
}
