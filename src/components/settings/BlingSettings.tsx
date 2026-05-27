import React, { useEffect, useState } from 'react';
import { Package, Loader2, CheckCircle2, AlertCircle, KeyRound, ExternalLink, RefreshCw, Link2, Unlink, Image as ImageIcon, Upload } from 'lucide-react';
import { Button } from '../Button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useBlingIntegration } from '@/hooks/useBlingIntegration';
import { useCloudinaryIntegration } from '@/hooks/useCloudinaryIntegration';
import { toast } from 'sonner';

const BlingSettings: React.FC = () => {
  const { status, loading, saveCredentials, connect, handleOAuthCallback, disconnect, triggerSync } = useBlingIntegration();
  const cloudinary = useCloudinaryIntegration();
  const [cloudName, setCloudName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [uploadTag, setUploadTag] = useState('loja_filhos_com_estilo');
  const [savingCloud, setSavingCloud] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [processingCallback, setProcessingCallback] = useState(false);

  // Handle OAuth callback from Bling redirect (?code=...&state=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code && state && !processingCallback) {
      setProcessingCallback(true);
      handleOAuthCallback(code, state).then((success) => {
        // Clean URL after processing
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        setProcessingCallback(false);
      });
    }
  }, [handleOAuthCallback, processingCallback]);

  const handleSaveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error('Preencha Client ID e Client Secret');
      return;
    }
    setSaving(true);
    await saveCredentials(clientId.trim(), clientSecret.trim());
    setClientId('');
    setClientSecret('');
    setSaving(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    await triggerSync();
    setSyncing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Status */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
          status.connected
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : status.has_credentials
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-slate-700/30 border-slate-600/30'
        }`}>
          {status.connected ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-400" />
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">
            {status.connected
              ? 'Bling conectado'
              : status.has_credentials
              ? 'Credenciais salvas, falta autorizar'
              : 'Bling não configurado'}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {status.connected && status.updated_at
              ? `Última atualização: ${new Date(status.updated_at).toLocaleString('pt-BR')}`
              : status.has_credentials
              ? 'Clique em "Conectar com Bling" para autorizar'
              : 'Cadastre o Client ID e Client Secret abaixo'}
          </div>
        </div>
        {status.connected && (
          <Button onClick={disconnect} variant="outline" size="sm" className="gap-1.5">
            <Unlink className="w-3.5 h-3.5" />
            Desconectar
          </Button>
        )}
      </div>

      {/* Credenciais */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-pink-500/10 border border-pink-500/30 flex items-center justify-center">
            <Package className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Integração Bling ERP</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sincroniza o catálogo de produtos para que a DANI consulte preços e estoque.
            </p>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 text-xs text-slate-400 space-y-2">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <KeyRound className="w-3.5 h-3.5" />
            Como obter as credenciais
          </div>
          <ol className="space-y-1 list-decimal list-inside text-slate-400">
            <li>
              Acesse{' '}
              <a href="https://developer.bling.com.br/aplicativos" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline inline-flex items-center gap-1">
                developer.bling.com.br/aplicativos <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>Crie um aplicativo (ou abra o existente)</li>
            <li>
              No campo <em>Redirect URI</em>, cole:{' '}
              <code className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-200 break-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/settings` : '...'}
              </code>
            </li>
            <li>Copie o <strong>Client ID</strong> e o <strong>Client Secret</strong> e cole abaixo</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bling-client-id">Client ID *</Label>
            <Input
              id="bling-client-id"
              type="text"
              placeholder="Ex: a1b2c3d4..."
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bling-client-secret">Client Secret *</Label>
            <Input
              id="bling-client-secret"
              type="password"
              placeholder="••••••••"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleSaveCredentials} variant="primary" disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar credenciais
          </Button>
          {status.has_credentials && (
            <Button onClick={connect} variant="outline" className="gap-2">
              <Link2 className="w-4 h-4" />
              {status.connected ? 'Reconectar com Bling' : 'Conectar com Bling'}
            </Button>
          )}
        </div>
      </div>

      {/* Sincronização */}
      {status.connected && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Sincronizar catálogo agora</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Baixa todos os produtos do Bling para o banco. A sincronização automática roda a cada 5 horas.
              </p>
            </div>
          </div>

          <Button onClick={handleSync} disabled={syncing} className="gap-2">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
          </Button>

          {/* Realtime stock info banner */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xs space-y-1">
              <div className="text-emerald-300 font-medium">Estoque em tempo real ativado</div>
              <div className="text-slate-400">
                A DANI consulta o Bling em tempo real ao buscar produtos. Se o Bling falhar ou demorar mais de 3 segundos, ela usa o estoque do cache (atualizado a cada sincronização) automaticamente.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============== CLOUDINARY SECTION ============== */}
      <div className="pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Imagens dos produtos</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>
      </div>

      {/* Cloudinary Status */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
          cloudinary.status.connected
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-slate-700/30 border-slate-600/30'
        }`}>
          {cloudinary.status.connected ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-400" />
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">
            {cloudinary.status.connected ? 'Cloudinary conectado' : 'Cloudinary não configurado'}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {cloudinary.status.connected
              ? `${cloudinary.status.uploaded_count} de ${cloudinary.status.total_with_image} imagens já enviadas`
              : 'Configure a hospedagem de imagens para a DANI enviar fotos no WhatsApp'}
          </div>
        </div>
        {cloudinary.status.connected && (
          <Button onClick={cloudinary.disconnect} variant="outline" size="sm" className="gap-1.5">
            <Unlink className="w-3.5 h-3.5" />
            Desconectar
          </Button>
        )}
      </div>

      {/* Cloudinary Credentials */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Cloudinary (hospedagem de imagens)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Hospeda as fotos dos produtos para a DANI enviar via WhatsApp.
            </p>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 text-xs text-slate-400 space-y-2">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <KeyRound className="w-3.5 h-3.5" />
            Como obter as credenciais
          </div>
          <ol className="space-y-1 list-decimal list-inside text-slate-400">
            <li>
              Acesse{' '}
              <a href="https://console.cloudinary.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">
                console.cloudinary.com <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>No painel principal, na seção <strong>Account Details</strong> copie: <strong>Cloud Name</strong>, <strong>API Key</strong> e <strong>API Secret</strong></li>
            <li>Cole abaixo e clique em "Salvar" (validamos automaticamente)</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cloud-name">Cloud Name *</Label>
            <Input
              id="cloud-name"
              type="text"
              placeholder="djhxuepu2"
              value={cloudName}
              onChange={(e) => setCloudName(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cloud-api-key">API Key *</Label>
            <Input
              id="cloud-api-key"
              type="text"
              placeholder="123456789012345"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cloud-api-secret">API Secret *</Label>
            <Input
              id="cloud-api-secret"
              type="password"
              placeholder="••••••••"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="upload-tag">Tag de upload (opcional)</Label>
          <Input
            id="upload-tag"
            type="text"
            placeholder="loja_filhos_com_estilo"
            value={uploadTag}
            onChange={(e) => setUploadTag(e.target.value)}
            className="max-w-sm"
          />
          <p className="text-xs text-slate-500">Tag aplicada nas imagens enviadas. Útil para organização e limpeza.</p>
        </div>

        <Button
          onClick={async () => {
            if (!cloudName.trim() || !apiKey.trim() || !apiSecret.trim()) {
              toast.error('Preencha todos os campos obrigatórios');
              return;
            }
            setSavingCloud(true);
            const ok = await cloudinary.saveCredentials(cloudName.trim(), apiKey.trim(), apiSecret.trim(), uploadTag.trim());
            if (ok) {
              setCloudName('');
              setApiKey('');
              setApiSecret('');
            }
            setSavingCloud(false);
          }}
          variant="primary"
          disabled={savingCloud}
          className="gap-2"
        >
          {savingCloud && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvar e validar
        </Button>
      </div>

      {/* Upload Images */}
      {cloudinary.status.connected && status.connected && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
              <Upload className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Enviar imagens para Cloudinary</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Baixa as fotos dos produtos do Bling e hospeda no Cloudinary com a URL padrão da DANI.
              </p>
            </div>
          </div>

          {/* Progress */}
          {cloudinary.status.total_with_image > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Progresso</span>
                <span>{cloudinary.status.uploaded_count} / {cloudinary.status.total_with_image}</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                  style={{
                    width: `${cloudinary.status.total_with_image > 0
                      ? (cloudinary.status.uploaded_count / cloudinary.status.total_with_image) * 100
                      : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {cloudinary.status.last_sync_at && (
            <p className="text-xs text-slate-500">
              Último envio: {new Date(cloudinary.status.last_sync_at).toLocaleString('pt-BR')} ({cloudinary.status.last_sync_count} imagens)
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={async () => {
                setUploadingImages(true);
                await cloudinary.uploadPendingImages(false);
                setUploadingImages(false);
              }}
              disabled={uploadingImages}
              className="gap-2"
            >
              {uploadingImages ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploadingImages ? 'Enviando...' : 'Enviar imagens pendentes'}
            </Button>
            <Button
              onClick={async () => {
                if (!confirm('Re-enviar TODAS as imagens (incluindo as já enviadas)? Isso pode levar muito tempo.')) return;
                setUploadingImages(true);
                await cloudinary.uploadPendingImages(true);
                setUploadingImages(false);
              }}
              disabled={uploadingImages}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Re-enviar todas
            </Button>
          </div>

          <p className="text-xs text-amber-400/80">
            ⚠️ A primeira vez pode levar 15-30 minutos dependendo do tamanho do catálogo. Você pode fechar essa página, o upload continua em background.
          </p>
        </div>
      )}

      {/* Processing OAuth callback indicator */}
      {processingCallback && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          <span className="text-sm text-blue-200">Finalizando conexão com Bling...</span>
        </div>
      )}
    </div>
  );
};

export default BlingSettings;
