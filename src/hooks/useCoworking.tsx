import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import { requireActiveAccountId } from '@/lib/activeAccount';

export interface BookableResource {
  id: string;
  account_id: string;
  name: string;
  type: string;
  capacity: number | null;
  description: string | null;
  is_active: boolean;
  is_publicly_bookable: boolean;
  allocation_priority: number;
  metadata: Record<string, unknown>;
}

/** Lê settings.coworking_module_available da conta ativa (Super Admin liga). */
export function useCoworkingModuleAvailable() {
  const { activeAccountId } = useActiveAccount();
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeAccountId) { setAvailable(false); setLoading(false); return; }
    const { data } = await supabase.from('accounts').select('settings').eq('id', activeAccountId).single();
    const settings = (data?.settings ?? {}) as Record<string, unknown>;
    setAvailable(!!settings.coworking_module_available);
    setLoading(false);
  }, [activeAccountId]);

  useEffect(() => { load(); }, [load]);
  return { available, loading, refresh: load };
}

/** Lê settings.coworking_enabled (Owner/Admin liga). */
export function useCoworkingEnabled() {
  const { activeAccountId } = useActiveAccount();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeAccountId) { setEnabled(false); setLoading(false); return; }
    const { data } = await supabase.from('accounts').select('settings').eq('id', activeAccountId).single();
    const settings = (data?.settings ?? {}) as Record<string, unknown>;
    setEnabled(!!settings.coworking_module_available && !!settings.coworking_enabled);
    setLoading(false);
  }, [activeAccountId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: react to account settings updates
  useEffect(() => {
    if (!activeAccountId) return;
    const channel = supabase
      .channel(`account-${activeAccountId}-coworking`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'accounts', filter: `id=eq.${activeAccountId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeAccountId, load]);

  return { enabled, loading, refresh: load };
}

/** Atualiza coworking_enabled e faz bootstrap das 4 salas na primeira ativação. */
export function useToggleCoworking() {
  const { activeAccountId } = useActiveAccount();
  const [saving, setSaving] = useState(false);

  const toggle = useCallback(async (value: boolean) => {
    if (!activeAccountId) return;
    setSaving(true);
    try {
      const { data: acc } = await supabase.from('accounts').select('settings').eq('id', activeAccountId).single();
      const settings = { ...((acc?.settings as Record<string, unknown>) || {}), coworking_enabled: value };
      const { error } = await supabase.from('accounts').update({ settings }).eq('id', activeAccountId);
      if (error) throw error;
      if (value) {
        await supabase.rpc('bootstrap_coworking_defaults', { _account_id: activeAccountId });
      }
    } finally { setSaving(false); }
  }, [activeAccountId]);

  return { toggle, saving };
}

/** Libera e ativa o módulo Coworking de uma vez (Owner/Admin). Cria as salas padrão. */
export function useEnableCoworking() {
  const { activeAccountId } = useActiveAccount();
  const [enabling, setEnabling] = useState(false);

  const enable = useCallback(async () => {
    if (!activeAccountId) return;
    setEnabling(true);
    try {
      const { data: acc } = await supabase.from('accounts').select('settings').eq('id', activeAccountId).single();
      const settings = {
        ...((acc?.settings as Record<string, unknown>) || {}),
        coworking_module_available: true,
        coworking_enabled: true,
      };
      const { error } = await supabase.from('accounts').update({ settings }).eq('id', activeAccountId);
      if (error) throw error;
      await supabase.rpc('bootstrap_coworking_defaults', { _account_id: activeAccountId });
    } finally { setEnabling(false); }
  }, [activeAccountId]);

  return { enable, enabling };
}

/** Lista salas da conta ativa com Realtime. */
export function useBookableResources(opts?: { onlyActive?: boolean; onlyPublic?: boolean }) {
  const { activeAccountId } = useActiveAccount();
  const [resources, setResources] = useState<BookableResource[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeAccountId) { setResources([]); setLoading(false); return; }
    let q = supabase.from('bookable_resources').select('*').eq('account_id', activeAccountId).order('allocation_priority').order('name');
    if (opts?.onlyActive) q = q.eq('is_active', true);
    if (opts?.onlyPublic) q = q.eq('is_publicly_bookable', true);
    const { data } = await q;
    setResources((data || []) as BookableResource[]);
    setLoading(false);
  }, [activeAccountId, opts?.onlyActive, opts?.onlyPublic]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!activeAccountId) return;
    const channel = supabase
      .channel(`bookable-resources-${activeAccountId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookable_resources', filter: `account_id=eq.${activeAccountId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeAccountId, load]);

  return { resources, loading, refresh: load };
}

export function useBootstrapDefaults() {
  return useCallback(async () => {
    const accountId = requireActiveAccountId();
    const { data, error } = await supabase.rpc('bootstrap_coworking_defaults', { _account_id: accountId });
    if (error) throw error;
    return data;
  }, []);
}

/** Invoca edge create-coworking-booking. */
export function useCreateCoworkingBooking() {
  return useCallback(async (payload: {
    resource_id: string;
    contact_id?: string | null;
    title: string;
    date: string;
    time: string;
    duration?: number;
    type?: string;
    modality?: string;
    internal_notes?: string;
    requires_payment?: boolean;
    amount?: number;
  }) => {
    const account_id = requireActiveAccountId();
    const { data, error } = await supabase.functions.invoke('create-coworking-booking', {
      body: { account_id, ...payload },
    });
    if (error) throw error;
    if ((data as any)?.code === 'CONFLICT') throw new Error((data as any).error || 'Sala já reservada');
    if ((data as any)?.error) throw new Error((data as any).error);
    return data;
  }, []);
}

export function useValidateManualPix() {
  return useCallback(async (payment_id: string) => {
    const { data, error } = await supabase.functions.invoke('validate-manual-pix', { body: { payment_id } });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data;
  }, []);
}
