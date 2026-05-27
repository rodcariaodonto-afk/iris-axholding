import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface CloudinaryStatus {
  connected: boolean;
  cloud_name: string | null;
  upload_tag: string | null;
  last_sync_at: string | null;
  last_sync_count: number;
  uploaded_count: number;
  total_with_image: number;
}

export function useCloudinaryIntegration() {
  const { user } = useAuth();
  const [status, setStatus] = useState<CloudinaryStatus>({
    connected: false,
    cloud_name: null,
    upload_tag: null,
    last_sync_at: null,
    last_sync_count: 0,
    uploaded_count: 0,
    total_with_image: 0,
  });
  const [loading, setLoading] = useState(true);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const authBaseUrl = `https://${projectId}.supabase.co/functions/v1/cloudinary-auth`;
  const uploadUrl = `https://${projectId}.supabase.co/functions/v1/bling-cloudinary-upload`;

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

      const res = await fetch(`${authBaseUrl}?action=status`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        setLoading(false);
        return;
      }

      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('[Cloudinary] Status check failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user, authBaseUrl]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const saveCredentials = async (
    cloudName: string,
    apiKey: string,
    apiSecret: string,
    uploadTag?: string,
  ): Promise<boolean> => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated');

      toast.info('Validando credenciais com Cloudinary...');

      const res = await fetch(`${authBaseUrl}?action=save_credentials`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
          upload_tag: uploadTag || 'loja_filhos_com_estilo',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      toast.success('Cloudinary conectado e validado!');
      await checkStatus();
      return true;
    } catch (err: any) {
      console.error('[Cloudinary] Save credentials failed:', err);
      toast.error('Erro: ' + (err.message || 'desconhecido'));
      return false;
    }
  };

  const disconnect = async () => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`${authBaseUrl}?action=disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Disconnect failed');

      toast.success('Cloudinary desconectado');
      await checkStatus();
    } catch (err: any) {
      console.error('[Cloudinary] Disconnect failed:', err);
      toast.error('Erro ao desconectar: ' + (err.message || 'desconhecido'));
    }
  };

  const uploadPendingImages = async (forceReupload = false): Promise<{ success: boolean; uploaded?: number; failed?: number }> => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated');

      toast.info('Iniciando upload de imagens para Cloudinary, isso pode levar vários minutos...');

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force_reupload: forceReupload }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      if (data.uploaded > 0) {
        toast.success(`${data.uploaded} imagens enviadas para Cloudinary!`);
      } else {
        toast.info(data.message || 'Nenhuma imagem nova para enviar');
      }

      if (data.failed > 0) {
        toast.warning(`${data.failed} uploads falharam. Verifique os logs.`);
      }

      await checkStatus();
      return { success: true, uploaded: data.uploaded, failed: data.failed };
    } catch (err: any) {
      console.error('[Cloudinary] Upload failed:', err);
      toast.error('Erro no upload: ' + (err.message || 'desconhecido'));
      return { success: false };
    }
  };

  return {
    status,
    loading,
    saveCredentials,
    disconnect,
    uploadPendingImages,
    refresh: checkStatus,
  };
}
