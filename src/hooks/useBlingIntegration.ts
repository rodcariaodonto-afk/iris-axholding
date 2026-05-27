import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface BlingStatus {
  has_credentials: boolean;
  connected: boolean;
  expires_at: string | null;
  updated_at: string | null;
}

export function useBlingIntegration() {
  const { user } = useAuth();
  const [status, setStatus] = useState<BlingStatus>({
    has_credentials: false,
    connected: false,
    expires_at: null,
    updated_at: null,
  });
  const [loading, setLoading] = useState(true);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1/bling-auth`;

  const checkStatus = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${functionsBaseUrl}?action=status`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        setLoading(false);
        return;
      }

      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('[Bling] Status check failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user, functionsBaseUrl]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const saveCredentials = async (clientId: string, clientSecret: string): Promise<boolean> => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`${functionsBaseUrl}?action=save_credentials`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      toast.success('Credenciais Bling salvas!');
      await checkStatus();
      return true;
    } catch (err: any) {
      console.error('[Bling] Save credentials failed:', err);
      toast.error('Erro ao salvar credenciais: ' + (err.message || 'desconhecido'));
      return false;
    }
  };

  const connect = async () => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated');

      const redirectUri = `${window.location.origin}/settings`;
      const qs = new URLSearchParams({ action: 'authorize', redirect_uri: redirectUri }).toString();
      const res = await fetch(`${functionsBaseUrl}?${qs}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authorize failed');

      window.location.href = data.url;
    } catch (err: any) {
      console.error('[Bling] Connect failed:', err);
      toast.error('Erro ao iniciar conexão Bling: ' + (err.message || 'desconhecido'));
    }
  };

  const handleOAuthCallback = async (code: string, state: string): Promise<boolean> => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated');

      const redirectUri = `${window.location.origin}/settings`;
      const res = await fetch(`${functionsBaseUrl}?action=callback`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, state, redirect_uri: redirectUri }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Callback failed');

      toast.success('Bling conectado com sucesso!');
      await checkStatus();
      return true;
    } catch (err: any) {
      console.error('[Bling] OAuth callback error:', err);
      toast.error('Erro ao finalizar conexão Bling: ' + (err.message || 'desconhecido'));
      return false;
    }
  };

  const disconnect = async () => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`${functionsBaseUrl}?action=disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Disconnect failed');

      toast.success('Bling desconectado');
      await checkStatus();
    } catch (err: any) {
      console.error('[Bling] Disconnect failed:', err);
      toast.error('Erro ao desconectar Bling: ' + (err.message || 'desconhecido'));
    }
  };

  const triggerSync = async (): Promise<{ success: boolean; synced?: number; error?: string }> => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated');

      toast.info('Sincronização iniciada, isso pode levar alguns minutos...');

      const syncUrl = `https://${projectId}.supabase.co/functions/v1/bling-catalog-sync`;
      const res = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');

      toast.success(`Sincronização concluída! ${data.synced || 0} produtos importados.`);
      return { success: true, synced: data.synced };
    } catch (err: any) {
      console.error('[Bling] Sync failed:', err);
      toast.error('Erro ao sincronizar: ' + (err.message || 'desconhecido'));
      return { success: false, error: err.message };
    }
  };

  return {
    status,
    loading,
    saveCredentials,
    connect,
    handleOAuthCallback,
    disconnect,
    triggerSync,
    refresh: checkStatus,
  };
}
