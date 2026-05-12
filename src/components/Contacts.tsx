import React, { useEffect, useRef, useState } from 'react';
import { Search, Filter, MoreHorizontal, UserPlus, MessageSquare, Loader2, Mail, Phone, Users, Download, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { api } from '../services/api';
import { Contact } from '../types';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const normalizePhone = (raw: string): string => (raw || '').replace(/\D/g, '');

const Contacts: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const loadContacts = async () => {
    setLoading(true);
    try {
      const data = await api.fetchContacts();
      setContacts(data);
    } catch (error) {
      console.error('Erro ao carregar contatos', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadContacts(); }, []);

  const filteredContacts = contacts.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      (c.name?.toLowerCase() || '').includes(term) ||
      (c.phone || '').includes(term) ||
      (c.email?.toLowerCase() || '').includes(term)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'customer': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'lead': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'churned': return 'bg-slate-800 text-slate-400 border-slate-700';
      default: return 'bg-slate-800 text-slate-400';
    }
  };

  const handleStartConversation = (contact: Contact) => {
    navigate(`/chat?contact=${encodeURIComponent(contact.phone)}`);
  };

  const handleCreate = async () => {
    const phone = normalizePhone(form.phone);
    if (!phone) { toast.error('Telefone é obrigatório'); return; }
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('contacts').insert({
        name: form.name.trim(),
        call_name: form.name.trim(),
        phone_number: phone,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
      toast.success('Contato criado com sucesso');
      setShowCreate(false);
      setForm({ name: '', phone: '', email: '', notes: '' });
      await loadContacts();
    } catch (e: any) {
      toast.error('Erro ao criar contato: ' + (e.message || 'desconhecido'));
    } finally {
      setCreating(false);
    }
  };

  const handleExport = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('name, call_name, phone_number, email, notes, tags, created_at, last_activity')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!data || !data.length) { toast.info('Nenhum contato para exportar'); return; }
      const headers = ['nome', 'telefone', 'email', 'notas', 'tags', 'criado_em', 'ultima_atividade'];
      const rows = data.map(c => [
        c.name || c.call_name || '',
        c.phone_number || '',
        c.email || '',
        (c.notes || '').replace(/\n/g, ' '),
        (c.tags || []).join('|'),
        c.created_at,
        c.last_activity,
      ]);
      const csv = [headers, ...rows]
        .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contatos-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${data.length} contatos exportados`);
    } catch (e: any) {
      toast.error('Erro ao exportar: ' + (e.message || 'desconhecido'));
    }
  };

  const parseCsv = (text: string): Record<string, string>[] => {
    const lines = text.replace(/^\ufeff/, '').split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const parseLine = (line: string): string[] => {
      const out: string[] = [];
      let cur = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQ) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') { inQ = false; }
          else cur += ch;
        } else {
          if (ch === '"') inQ = true;
          else if (ch === ',' || ch === ';') { out.push(cur); cur = ''; }
          else cur += ch;
        }
      }
      out.push(cur);
      return out;
    };
    const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase());
    return lines.slice(1).map(l => {
      const cols = parseLine(l);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = (cols[i] || '').trim(); });
      return row;
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) { toast.error('CSV vazio'); return; }
      const { data: { user } } = await supabase.auth.getUser();
      const records = rows
        .map(r => {
          const phone = normalizePhone(r.telefone || r.phone || r.phone_number || r.celular || '');
          const name = (r.nome || r.name || r.call_name || '').trim();
          if (!phone) return null;
          return {
            name: name || phone,
            call_name: name || phone,
            phone_number: phone,
            email: (r.email || '').trim() || null,
            notes: (r.notas || r.notes || '').trim() || null,
            tags: r.tags ? r.tags.split('|').map(t => t.trim()).filter(Boolean) : [],
            user_id: user?.id ?? null,
          };
        })
        .filter(Boolean) as any[];
      if (!records.length) { toast.error('Nenhuma linha válida (precisa de telefone)'); return; }

      // Avoid duplicates by phone_number
      const phones = records.map(r => r.phone_number);
      const { data: existing } = await supabase
        .from('contacts')
        .select('phone_number')
        .in('phone_number', phones);
      const existingSet = new Set((existing || []).map(c => c.phone_number));
      const toInsert = records.filter(r => !existingSet.has(r.phone_number));

      if (!toInsert.length) {
        toast.info('Todos os contatos já existem');
      } else {
        const { error } = await supabase.from('contacts').insert(toInsert);
        if (error) throw error;
        toast.success(`${toInsert.length} contatos importados (${records.length - toInsert.length} já existiam)`);
      }
      await loadContacts();
    } catch (e: any) {
      toast.error('Erro ao importar: ' + (e.message || 'desconhecido'));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-950 text-slate-50">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Contatos</h2>
          <p className="text-sm text-slate-400 mt-1">Gerencie sua base de leads e clientes com inteligência.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImport}
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Importar CSV
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button className="shadow-lg shadow-cyan-500/20" onClick={() => setShowCreate(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Contato
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-8 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Buscar por nome, email ou telefone"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 placeholder:text-slate-600 transition-all"
          />
        </div>
        <Button 
          variant="outline" 
          className="w-full sm:w-auto bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed opacity-50"
          disabled
          title="Em breve: Filtros avançados"
        >
          <Filter className="w-4 h-4 mr-2" />
          Filtros Avançados
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm shadow-xl overflow-hidden min-h-[400px]">
        {loading ? (
           <div className="flex flex-col items-center justify-center h-80">
             <Loader2 className="h-10 w-10 animate-spin text-cyan-500 mb-3" />
             <span className="text-sm text-slate-400 animate-pulse">Carregando base de dados...</span>
           </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 text-slate-400">
            <Users className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhum contato encontrado</p>
            <p className="text-sm text-slate-500 mt-1">
              {searchTerm ? 'Tente buscar por outro termo' : 'Os contatos aparecerão aqui'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-medium text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Nome / Telefone</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Canais</th>
                  <th className="px-6 py-4">Última Interação</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-cyan-400 shadow-inner">
                          {(contact.name || contact.phone || '?').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors">
                              {contact.name || 'Sem nome'}
                            </div>
                            <div className="text-xs text-slate-500">{contact.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${getStatusColor(contact.status)}`}>
                        {contact.status === 'customer' ? 'Cliente Ativo' : contact.status === 'lead' ? 'Lead Qualificado' : 'Churned'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {contact.email && (
                          <div className="flex items-center gap-2 text-slate-400 text-xs">
                              <Mail className="w-3.5 h-3.5" />
                              {contact.email}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-slate-400 text-xs">
                            <Phone className="w-3.5 h-3.5" />
                            {contact.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-slate-400">{new Date(contact.lastContact).toLocaleDateString('pt-BR')}</span>
                       <div className="text-[10px] text-slate-600">via WhatsApp</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <Button 
                          size="sm" 
                          variant="primary" 
                          className="h-8 w-8 p-0 rounded-lg shadow-none" 
                          title="Iniciar Conversa"
                          onClick={() => handleStartConversation(contact)}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 rounded-lg text-slate-500 cursor-not-allowed opacity-50"
                          disabled
                          title="Em breve: Mais opções"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Contact Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Novo Contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="c-name">Nome *</Label>
              <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="João Silva" className="mt-1 bg-slate-950 border-slate-800" />
            </div>
            <div>
              <Label htmlFor="c-phone">Telefone (com DDI/DDD) *</Label>
              <Input id="c-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="5511999999999" className="mt-1 bg-slate-950 border-slate-800" />
              <p className="text-[11px] text-slate-500 mt-1">Apenas números. Ex: 5511987654321</p>
            </div>
            <div>
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" className="mt-1 bg-slate-950 border-slate-800" />
            </div>
            <div>
              <Label htmlFor="c-notes">Notas</Label>
              <Input id="c-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observações" className="mt-1 bg-slate-950 border-slate-800" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Criar Contato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Contacts;
