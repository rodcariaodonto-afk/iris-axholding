import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export function useGoogleCalendar() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkConnection = useCallback(async () => {
    if (!user) {
      setIsConnected(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('google_calendar_connections' as any)
        .select('id, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      setIsConnected(!!data && !error);
    } catch {
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connect = async () => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated');
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const redirectUri = `${window.location.origin}/scheduling`;
      const qs = new URLSearchParams({ action: 'authorize', redirect_uri: redirectUri }).toString();
      const url = `https://${projectId}.supabase.co/functions/v1/google-calendar-auth?${qs}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authorize failed');
      window.location.href = data.url;
    } catch (error: any) {
      console.error('Error connecting to Google Calendar:', error);
      toast.error('Erro ao conectar com Google Agenda: ' + (error.message || 'desconhecido'));
    }
  };

  const handleOAuthCallback = async (code: string, state: string): Promise<boolean> => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated');
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/google-calendar-auth?action=callback`;
      const redirectUri = `${window.location.origin}/scheduling`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, state, redirect_uri: redirectUri }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Callback failed');
      setIsConnected(true);
      toast.success('Google Agenda conectado!');
      return true;
    } catch (error: any) {
      console.error('OAuth callback error:', error);
      toast.error('Erro ao finalizar conexão: ' + (error.message || 'desconhecido'));
      return false;
    }
  };

  const disconnect = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('google_calendar_connections' as any)
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      setIsConnected(false);
      toast.success('Google Agenda desconectado');
    } catch (error: any) {
      console.error('Error disconnecting:', error);
      toast.error('Erro ao desconectar Google Agenda');
    }
  };

  const syncAppointment = async (action: 'create' | 'update' | 'delete', appointment: any) => {
    if (!isConnected) return null;

    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
        body: { action, appointment },
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error(`Error syncing appointment (${action}):`, error);
      // Don't show error toast for sync failures - it's a background operation
      return null;
    }
  };

  const importFromGoogle = async () => {
    if (!isConnected) return { imported: 0, updated: 0 };
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'import', appointment: {} },
      });
      if (error) throw error;
      return data?.data || { imported: 0, updated: 0 };
    } catch (err) {
      console.error('Error importing from Google:', err);
      return { imported: 0, updated: 0, failed: true };
    }
  };

  const syncAllAppointments = async (appointments: any[]) => {
    if (!isConnected) return { synced: 0, failed: 0, imported: 0, updated: 0 };

    // 1) Push: send local appointments without google_event_id to Google
    const unsyncedAppointments = appointments.filter(a => !a.google_event_id);
    let synced = 0;
    let failed = 0;

    for (const app of unsyncedAppointments) {
      try {
        const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
          body: {
            action: 'create',
            appointment: {
              id: app.id,
              title: app.title,
              description: app.description,
              date: app.date,
              time: app.time,
              duration: app.duration,
              type: app.type,
            },
          },
        });
        if (error) throw error;
        synced++;
      } catch {
        failed++;
      }
    }

    // 2) Pull: import events from Google into appointments
    const importResult = await importFromGoogle();

    return {
      synced,
      failed,
      imported: importResult.imported || 0,
      updated: importResult.updated || 0,
      alreadySynced: unsyncedAppointments.length === 0 && (importResult.imported || 0) === 0,
    };
  };

  return {
    isConnected,
    loading,
    connect,
    disconnect,
    syncAppointment,
    syncAllAppointments,
    handleOAuthCallback,
    refreshConnection: checkConnection,
  };
}
