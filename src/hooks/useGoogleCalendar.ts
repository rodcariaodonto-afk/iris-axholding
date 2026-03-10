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
      const { data, error } = await supabase.functions.invoke('google-calendar-auth');
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Error connecting to Google Calendar:', error);
      toast.error('Erro ao conectar com Google Agenda');
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

  return {
    isConnected,
    loading,
    connect,
    disconnect,
    syncAppointment,
    refreshConnection: checkConnection,
  };
}
