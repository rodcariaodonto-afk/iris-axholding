import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function GovernanceConsents() {
  const { activeAccountId } = useActiveAccount();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!activeAccountId) return;
    (async () => {
      setLoading(true);
      let q = supabase.from("contacts").select("id, name, phone_number, email, consent_status, legal_basis, data_origin, data_classification, consent_given_at, consent_revoked_at")
        .eq("account_id", activeAccountId).limit(500);
      if (filter !== "all") q = q.eq("consent_status", filter);
      const { data } = await q;
      setContacts(data ?? []); setLoading(false);
    })();
  }, [activeAccountId, filter]);

  const filtered = contacts.filter(c => !search || (c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone_number?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase())));
  const counts = {
    granted: contacts.filter(c => c.consent_status === "granted").length,
    revoked: contacts.filter(c => c.consent_status === "revoked").length,
    unknown: contacts.filter(c => c.consent_status === "unknown").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-6"><p className="text-2xl font-bold text-emerald-500">{counts.granted}</p><p className="text-xs text-muted-foreground">Consentimento concedido</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-2xl font-bold text-destructive">{counts.revoked}</p><p className="text-xs text-muted-foreground">Revogado</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-2xl font-bold text-amber-500">{counts.unknown}</p><p className="text-xs text-muted-foreground">Desconhecido</p></CardContent></Card>
      </div>

      <div className="flex gap-3">
        <Input placeholder="Buscar contato…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="granted">Consentido</SelectItem>
            <SelectItem value="revoked">Revogado</SelectItem>
            <SelectItem value="unknown">Desconhecido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card><CardContent className="p-0">
        {loading ? <p className="p-6 text-sm text-muted-foreground">Carregando…</p> :
          filtered.length === 0 ? <p className="p-6 text-sm text-muted-foreground text-center">Nenhum contato.</p> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border/40"><tr className="text-left text-xs text-muted-foreground uppercase">
              <th className="p-3">Contato</th><th className="p-3">Status</th><th className="p-3">Base legal</th><th className="p-3">Origem</th><th className="p-3">Classificação</th>
            </tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-border/20">
                  <td className="p-3">{c.name || c.phone_number}<p className="text-xs text-muted-foreground">{c.email}</p></td>
                  <td className="p-3"><Badge variant={c.consent_status === "granted" ? "default" : c.consent_status === "revoked" ? "destructive" : "secondary"}>{c.consent_status}</Badge></td>
                  <td className="p-3 text-xs">{c.legal_basis ?? "—"}</td>
                  <td className="p-3 text-xs">{c.data_origin ?? "—"}</td>
                  <td className="p-3"><Badge variant="outline" className="text-xs">{c.data_classification}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent></Card>
    </div>
  );
}
