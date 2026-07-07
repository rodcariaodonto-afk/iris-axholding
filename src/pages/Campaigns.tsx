import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ChevronRight, Download, FileText, Loader2,
  Megaphone, PauseCircle, PlayCircle, Plus, Upload, Users, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { supabase } from '@/integrations/supabase/client';
import {
  useOutboundCampaignsModuleAvailable,
  useCampaigns,
  useCreateCampaign,
  useUpdateCampaignStatus,
  useUploadCampaignContacts,
  Campaign,
  CampaignContact,
  CreateCampaignInput,
  CampaignContactRow,
} from '@/hooks/useOutboundCampaigns';

const db = supabase as any;

// ─── Access guard ─────────────────────────────────────────────────────────────

function ModuleUnavailable({ moduleName }: { moduleName: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-12">
      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
        <Megaphone className="w-7 h-7 text-slate-500" />
      </div>
      <h3 className="text-xl font-semibold text-slate-300">{moduleName}</h3>
      <p className="text-sm text-slate-500 max-w-xs">
        Este módulo não está habilitado para a sua conta. Entre em contato com o administrador para liberar o acesso.
      </p>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<Campaign['status'], string> = {
  draft:     'bg-slate-800 text-slate-400 border-slate-700',
  active:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  paused:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  completed: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const STATUS_LABELS: Record<Campaign['status'], string> = {
  draft: 'Rascunho', active: 'Ativa', paused: 'Pausada',
  completed: 'Concluída', cancelled: 'Cancelada',
};

const CONTACT_STATUS_STYLES: Record<CampaignContact['status'], string> = {
  pending:   'bg-slate-800 text-slate-400',
  sent:      'bg-blue-500/10 text-blue-400',
  replied:   'bg-violet-500/10 text-violet-400',
  opted_out: 'bg-red-500/10 text-red-400',
  failed:    'bg-red-500/10 text-red-500',
  converted: 'bg-emerald-500/10 text-emerald-400',
};

const CONTACT_STATUS_LABELS: Record<CampaignContact['status'], string> = {
  pending: 'Pendente', sent: 'Enviado', replied: 'Respondeu',
  opted_out: 'Opt-out', failed: 'Falhou', converted: 'Convertido',
};

function StatusBadge({ status }: { status: Campaign['status'] }) {
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Campaign detail panel ────────────────────────────────────────────────────

interface CampaignDetailProps {
  campaign: Campaign;
  onBack: () => void;
}

function CampaignDetail({ campaign, onBack }: CampaignDetailProps) {
  const [contacts, setContacts] = useState<CampaignContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.from('campaign_contacts')
      .select('*')
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: true })
      .then(({ data }: { data: CampaignContact[] | null }) => {
        setContacts(data || []);
        setLoading(false);
      });
  }, [campaign.id]);

  const counts = {
    pending:   contacts.filter(c => c.status === 'pending').length,
    sent:      contacts.filter(c => c.status === 'sent').length,
    replied:   contacts.filter(c => c.status === 'replied').length,
    opted_out: contacts.filter(c => c.status === 'opted_out').length,
    converted: contacts.filter(c => c.status === 'converted').length,
    failed:    contacts.filter(c => c.status === 'failed').length,
  };

  const exportCSV = () => {
    const header = 'nome,telefone,status,enviado_em,respondeu_em,convertido_em,erro';
    const rows = contacts.map(c =>
      [c.name ?? '', c.phone_number, CONTACT_STATUS_LABELS[c.status],
       c.sent_at ?? '', c.replied_at ?? '', c.converted_at ?? '', c.error_message ?? '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${campaign.name.replace(/\s+/g, '_')}_contatos.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-white truncate">{campaign.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={campaign.status} />
            <span className="text-xs text-slate-500">
              {campaign.daily_limit} por dia · {campaign.delay_seconds}s de delay
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {([
          { label: 'Pendentes',  value: counts.pending,   color: 'text-slate-400' },
          { label: 'Enviados',   value: counts.sent,      color: 'text-blue-400' },
          { label: 'Responderam',value: counts.replied,   color: 'text-violet-400' },
          { label: 'Opt-out',    value: counts.opted_out, color: 'text-red-400' },
          { label: 'Convertidos',value: counts.converted, color: 'text-emerald-400' },
          { label: 'Falhas',     value: counts.failed,    color: 'text-red-500' },
        ] as const).map(({ label, value, color }) => (
          <div key={label} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Contacts table */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-12">Nenhum contato importado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">Nome</th>
                <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">Telefone</th>
                <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">Status</th>
                <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">Enviado em</th>
                <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">Respondeu em</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(c => (
                <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-2 px-3 text-slate-300">{c.name ?? '—'}</td>
                  <td className="py-2 px-3 text-slate-400 font-mono text-xs">{c.phone_number}</td>
                  <td className="py-2 px-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${CONTACT_STATUS_STYLES[c.status]}`}>
                      {CONTACT_STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-500 text-xs">
                    {c.sent_at ? new Date(c.sent_at).toLocaleString('pt-BR') : '—'}
                  </td>
                  <td className="py-2 px-3 text-slate-500 text-xs">
                    {c.replied_at ? new Date(c.replied_at).toLocaleString('pt-BR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── New campaign modal ───────────────────────────────────────────────────────

interface NewCampaignModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function NewCampaignModal({ onClose, onCreated }: NewCampaignModalProps) {
  const { createCampaign, loading: creating } = useCreateCampaign();
  const { uploadContacts, parseCSV, loading: uploading } = useUploadCampaignContacts();

  const [form, setForm] = useState<CreateCampaignInput>({
    name: '',
    opening_message: '',
    daily_limit: 50,
    delay_seconds: 45,
    session_id: null,
    pdf_url: null,
    pdf_filename: null,
    template_name: '',
    template_language: 'pt_BR',
  });


  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvPreview, setCsvPreview] = useState<CampaignContactRow[]>([]);
  const [allRows, setAllRows] = useState<CampaignContactRow[]>([]);

  const pdfRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof CreateCampaignInput, value: unknown) =>
    setForm(f => ({ ...f, [key]: value }));

  // PDF file selection
  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('pdf')) { toast.error('Selecione um arquivo PDF'); return; }
    setPdfFile(file);
  };

  // CSV file selection + preview (local upload)
  const handleCsvChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isCsv = /\.csv$/i.test(file.name) || file.type.includes('csv');
    if (!isCsv) {
      toast.error('Selecione um arquivo CSV');
      e.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const preview = parseCSV(text, true);
      const all = parseCSV(text, false);

      if (all.length === 0) {
        setCsvText('');
        setCsvPreview([]);
        setAllRows([]);
        toast.error('CSV inválido — use as colunas phone/telefone e, opcionalmente, name/nome');
        return;
      }

      setCsvText(text);
      setCsvPreview(preview);
      setAllRows(all);
      toast.success(`${all.length} contatos detectados em "${file.name}"`);
    } catch (err) {
      console.error('[Campaigns] CSV read error:', err);
      setCsvText('');
      setCsvPreview([]);
      setAllRows([]);
      toast.error('Erro ao ler o arquivo CSV');
    } finally {
      // Allow selecting the same file again
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Informe o nome da campanha'); return; }
    if (!form.opening_message.trim()) { toast.error('Informe a mensagem de abertura'); return; }
    if (allRows.length === 0) { toast.error('Importe ao menos um contato via CSV'); return; }

    // Validate limits (spec §8.1)
    if ((form.daily_limit ?? 50) > 80) { toast.error('Limite diário máximo: 80 mensagens'); return; }
    if ((form.delay_seconds ?? 45) < 30) { toast.error('Delay mínimo entre envios: 30 segundos'); return; }

    let pdfUrl: string | null = null;
    let pdfFilename: string | null = null;

    // Upload PDF if selected
    if (pdfFile) {
      setUploadingPdf(true);
      try {
        const ext = pdfFile.name.split('.').pop() ?? 'pdf';
        const path = `campaigns/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('media-files')
          .upload(path, pdfFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('media-files').getPublicUrl(path);
        pdfUrl = urlData.publicUrl;
        pdfFilename = pdfFile.name;
      } catch (err) {
        console.error('[Campaigns] PDF upload error:', err);
        toast.error('Erro ao enviar o PDF');
        setUploadingPdf(false);
        return;
      }
      setUploadingPdf(false);
    }

    const campaign = await createCampaign({ ...form, pdf_url: pdfUrl, pdf_filename: pdfFilename });
    if (!campaign) return;

    await uploadContacts(campaign.id, allRows);
    onCreated();
    onClose();
  };

  const busy = creating || uploading || uploadingPdf;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-white">Nova Campanha</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Nome */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome da campanha *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Ex: Prospecção Clínicas Q3"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </div>

          {/* Mensagem de abertura */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Mensagem de abertura *</label>
            <textarea
              value={form.opening_message}
              onChange={e => set('opening_message', e.target.value)}
              rows={4}
              placeholder="Olá! Meu nome é Íris, da [empresa]. Tenho uma oportunidade que pode ser interessante para você..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 resize-none"
            />
          </div>

          {/* Limites */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Limite diário <span className="text-slate-600">(máx 80)</span>
              </label>
              <input
                type="number"
                min={1}
                max={80}
                value={form.daily_limit}
                onChange={e => set('daily_limit', Math.min(80, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Delay entre envios (s) <span className="text-slate-600">(mín 30)</span>
              </label>
              <input
                type="number"
                min={30}
                value={form.delay_seconds}
                onChange={e => set('delay_seconds', Math.max(30, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
            </div>
          </div>

          {/* PDF upload */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Material em PDF <span className="text-slate-600">(opcional)</span>
            </label>
            <div
              onClick={() => pdfRef.current?.click()}
              className="flex items-center gap-3 border border-dashed border-slate-700 rounded-lg px-4 py-3 cursor-pointer hover:border-slate-600 hover:bg-slate-800/30 transition-all"
            >
              <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className="text-sm text-slate-500 truncate">
                {pdfFile ? pdfFile.name : 'Clique para selecionar um PDF'}
              </span>
              {pdfFile && (
                <button
                  onClick={e => { e.stopPropagation(); setPdfFile(null); if (pdfRef.current) pdfRef.current.value = ''; }}
                  className="ml-auto text-slate-600 hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <input ref={pdfRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfChange} />
          </div>

          {/* CSV upload */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Lista de contatos (CSV) *{' '}
              <span className="text-slate-600 font-normal">— colunas: phone (obrigatório), name (opcional)</span>
            </label>
            <label
              htmlFor="campaign-csv-input"
              className="relative flex items-center gap-3 border border-dashed border-slate-700 rounded-lg px-4 py-3 cursor-pointer hover:border-slate-600 hover:bg-slate-800/30 transition-all"
            >
              <Upload className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className="text-sm text-slate-500 truncate">
                {allRows.length > 0
                  ? `${allRows.length} contatos carregados`
                  : 'Clique para selecionar o arquivo CSV no computador'}
              </span>
              <input
                id="campaign-csv-input"
                ref={csvRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </label>
            <p className="mt-1.5 text-[11px] text-slate-600">
              Formatos aceitos: CSV com coluna phone ou telefone; nome/name é opcional.
              Também aceita arquivos separados por vírgula ou ponto e vírgula.
            </p>


            {/* CSV preview */}
            {csvPreview.length > 0 && (
              <div className="mt-3 border border-slate-800 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-slate-800/50 text-[11px] text-slate-500 font-medium">
                  Prévia — primeiros {csvPreview.length} contatos
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-3 py-1.5 text-slate-500">Telefone</th>
                      <th className="text-left px-3 py-1.5 text-slate-500">Nome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((row, i) => (
                      <tr key={i} className="border-b border-slate-800/50">
                        <td className="px-3 py-1.5 font-mono text-slate-400">{row.phone_number}</td>
                        <td className="px-3 py-1.5 text-slate-500">{row.name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {allRows.length > 5 && (
                  <p className="px-3 py-2 text-[11px] text-slate-600">
                    …e mais {allRows.length - 5} contatos
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processando…</>
              : <><Plus className="w-4 h-4 mr-2" />Criar e importar contatos</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign list item ───────────────────────────────────────────────────────

interface CampaignCardProps {
  campaign: Campaign;
  onSelect: (c: Campaign) => void;
  onStatusChange: (id: string, s: Campaign['status']) => Promise<boolean>;
}

function CampaignCard({ campaign: c, onSelect, onStatusChange }: CampaignCardProps) {
  const [counts, setCounts] = useState({ total: 0, sent: 0, replied: 0 });

  useEffect(() => {
    db.from('campaign_contacts')
      .select('status')
      .eq('campaign_id', c.id)
      .then(({ data }: { data: { status: string }[] | null }) => {
        const rows = data || [];
        setCounts({
          total: rows.length,
          sent: rows.filter(r => r.status === 'sent' || r.status === 'replied' || r.status === 'converted').length,
          replied: rows.filter(r => r.status === 'replied' || r.status === 'converted').length,
        });
      });
  }, [c.id]);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold text-white truncate">{c.name}</h4>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{c.opening_message}</p>
        </div>
        <StatusBadge status={c.status} />
      </div>

      {/* Contact stats */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{counts.total} contatos</span>
        <span className="text-blue-400">{counts.sent} enviados</span>
        <span className="text-violet-400">{counts.replied} responderam</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {c.status === 'draft' || c.status === 'paused' ? (
          <Button size="sm" onClick={() => onStatusChange(c.id, 'active')}>
            <PlayCircle className="w-3.5 h-3.5 mr-1.5" />Ativar
          </Button>
        ) : c.status === 'active' ? (
          <Button size="sm" variant="outline" onClick={() => onStatusChange(c.id, 'paused')}>
            <PauseCircle className="w-3.5 h-3.5 mr-1.5" />Pausar
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => onSelect(c)}>
          Ver detalhes <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const Campaigns: React.FC = () => {
  const { available, loading: checkingModule } = useOutboundCampaignsModuleAvailable();
  const { campaigns, loading: loadingCampaigns, refetch } = useCampaigns();
  const { updateStatus } = useUpdateCampaignStatus();
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<Campaign | null>(null);

  const handleStatusChange = useCallback(async (id: string, status: Campaign['status']) => {
    const ok = await updateStatus(id, status);
    if (ok) refetch();
    return ok;
  }, [updateStatus, refetch]);

  if (checkingModule) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!available) return <ModuleUnavailable moduleName="Campanhas Outbound" />;

  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-950 text-slate-50">
      {selected ? (
        <CampaignDetail campaign={selected} onBack={() => setSelected(null)} />
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between mb-8 gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white">Campanhas Outbound</h2>
              <p className="text-sm text-slate-400 mt-1">
                Prospecção ativa via WhatsApp — disparos automáticos com IA.
              </p>
            </div>
            <Button onClick={() => setShowModal(true)} className="shadow-lg shadow-cyan-500/20 flex-shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              Nova Campanha
            </Button>
          </div>

          {/* Campaign list */}
          {loadingCampaigns ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center">
                <Megaphone className="w-6 h-6 text-slate-500" />
              </div>
              <p className="text-slate-400 font-medium">Nenhuma campanha criada ainda.</p>
              <p className="text-sm text-slate-600">Clique em "Nova Campanha" para começar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {campaigns.map(c => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  onSelect={setSelected}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </>
      )}

      {showModal && (
        <NewCampaignModal
          onClose={() => setShowModal(false)}
          onCreated={refetch}
        />
      )}
    </div>
  );
};

export default Campaigns;
