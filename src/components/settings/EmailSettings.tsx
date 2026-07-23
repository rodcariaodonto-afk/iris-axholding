import React, { useEffect, useState } from 'react';
import { Mail, Loader2, CheckCircle2, AlertCircle, Send, KeyRound, ExternalLink } from 'lucide-react';
import { Button } from '../Button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useActiveAccount } from '@/hooks/useActiveAccount';

const EmailSettings: React.FC = () => {
  const { activeAccountId } = useActiveAccount();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => { load(); }, [activeAccountId]);

  const load = async () => {
    if (!activeAccountId) {
      setLoading(false);
      setSettingsId(null);
      setFromEmail('');
      setFromName('');
      setVerifiedAt(null);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from('nina_settings')
      .select('id, invite_from_email, invite_from_name, invite_email_verified_at')
      .eq('account_id', activeAccountId)
      .limit(1)
      .maybeSingle();
    if (data) {
      setSettingsId(data.id);
      setFromEmail(data.invite_from_email || '');
      setFromName(data.invite_from_name || '');
      setVerifiedAt(data.invite_email_verified_at);
    } else {
      setSettingsId(null);
      setFromEmail('');
      setFromName('');
      setVerifiedAt(null);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!settingsId) return;
    if (!fromEmail.includes('@')) {
      toast.error('Informe um email de remetente válido');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('nina_settings')
      .update({
        invite_from_email: fromEmail.trim(),
        invite_from_name: fromName.trim() || null,
        invite_email_verified_at: null, // exige nova validação
      })
      .eq('id', settingsId)
      .eq('account_id', activeAccountId);
    setSaving(false);
    if (error) return toast.error('Erro ao salvar: ' + error.message);
    setVerifiedAt(null);
    toast.success('Configuração salva. Faça um envio de teste para validar.');
  };

  const handleTest = async () => {
    if (!testEmail.includes('@')) {
      toast.error('Informe um email para receber o teste');
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-invite-email', {
        body: { mode: 'test', to: testEmail.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Email de teste enviado com sucesso!');
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Falha no envio. Verifique a chave da API e o domínio.');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Status */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
          verifiedAt
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}>
          {verifiedAt
            ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            : <AlertCircle className="w-5 h-5 text-amber-400" />}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">
            {verifiedAt ? 'Provedor de email validado' : 'Provedor de email não validado'}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {verifiedAt
              ? `Último teste: ${new Date(verifiedAt).toLocaleString('pt-BR')}`
              : 'Configure o remetente e envie um teste para validar.'}
          </div>
        </div>
      </div>

      {/* Provedor */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Mail className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Provedor de envio (Resend)</h3>
            <p className="text-xs text-slate-500 mt-0.5">Usado para enviar convites e credenciais aos membros da equipe.</p>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 text-xs text-slate-400 space-y-2">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <KeyRound className="w-3.5 h-3.5" />
            Configuração da chave da API
          </div>
          <p>
            A chave <span className="font-mono text-slate-300">RESEND_API_KEY</span> deve ser cadastrada nos secrets do projeto.
            Crie sua chave em{' '}
            <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline inline-flex items-center gap-1">
              resend.com/api-keys <ExternalLink className="w-3 h-3" />
            </a>{' '}
            e verifique seu domínio em{' '}
            <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline inline-flex items-center gap-1">
              resend.com/domains <ExternalLink className="w-3 h-3" />
            </a>.
          </p>
          <p className="text-slate-500">Peça ao assistente: <span className="italic">"adicione o secret RESEND_API_KEY"</span> caso ainda não tenha cadastrado.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="from-email">Email do remetente *</Label>
            <Input
              id="from-email"
              type="email"
              placeholder="convites@seudominio.com"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
            />
            <p className="text-xs text-slate-500">Deve ser de um domínio verificado no Resend.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="from-name">Nome do remetente</Label>
            <Input
              id="from-name"
              type="text"
              placeholder="Equipe IRIS"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={handleSave} variant="primary" disabled={saving} className="gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvar configuração
        </Button>
      </div>

      {/* Teste */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
            <Send className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Validar com email de teste</h3>
            <p className="text-xs text-slate-500 mt-0.5">Envia uma mensagem real para confirmar que o provedor está funcionando.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            type="email"
            placeholder="seu-email@empresa.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleTest} disabled={testing || !fromEmail} className="gap-2 bg-white text-black hover:bg-slate-200">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar teste
          </Button>
        </div>
        {!fromEmail && (
          <p className="text-xs text-amber-400">Salve um email de remetente antes de enviar o teste.</p>
        )}
      </div>
    </div>
  );
};

export default EmailSettings;
