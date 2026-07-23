import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  account_id: string;
  session_id: string | null;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  opening_message: string;
  pdf_url: string | null;
  pdf_filename: string | null;
  daily_limit: number;
  delay_seconds: number;
  scheduled_start_at: string | null;
  template_name: string | null;
  template_language: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignContact {
  id: string;
  campaign_id: string;
  account_id: string;
  phone_number: string;
  name: string | null;
  status: 'pending' | 'sent' | 'replied' | 'opted_out' | 'failed' | 'converted';
  sent_at: string | null;
  replied_at: string | null;
  converted_at: string | null;
  error_message: string | null;
  contact_id: string | null;
  conversation_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignInput {
  name: string;
  session_id?: string | null;
  opening_message: string;
  pdf_url?: string | null;
  pdf_filename?: string | null;
  daily_limit?: number;
  delay_seconds?: number;
  scheduled_start_at?: string | null;
  template_name?: string | null;
  template_language?: string | null;
}

export interface CampaignContactRow {
  phone_number: string;
  name?: string;
}

// Untyped Supabase client for tables not yet in the generated schema
const db = supabase as any;

// ─── useOutboundCampaignsModuleAvailable ──────────────────────────────────────

export function useOutboundCampaignsModuleAvailable() {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { activeAccountId } = useActiveAccount();

  useEffect(() => {
    if (!user || !activeAccountId) {
      setAvailable(false);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      try {
        const { data } = await db
          .from('accounts')
          .select('settings')
          .eq('id', activeAccountId)
          .maybeSingle();

        setAvailable(!!data?.settings?.outbound_campaigns_enabled);
      } catch (err) {
        console.error('[useOutboundCampaigns] Error fetching module availability:', err);
        setAvailable(false);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [user, activeAccountId]);

  return { available, loading };
}

// ─── useCurrentAccountId ──────────────────────────────────────────────────────
// Internal helper — resolves the caller's account_id once.

function useCurrentAccountId() {
  const { activeAccountId } = useActiveAccount();
  return activeAccountId;
}

// ─── useCampaigns ─────────────────────────────────────────────────────────────

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { activeAccountId } = useActiveAccount();

  const fetchCampaigns = useCallback(async () => {
    if (!activeAccountId) {
      setCampaigns([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await db
        .from('outbound_campaigns')
        .select('*')
        .eq('account_id', activeAccountId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns((data as Campaign[]) || []);
    } catch (err) {
      console.error('[useCampaigns] Error fetching campaigns:', err);
      toast.error('Erro ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  }, [activeAccountId]);

  useEffect(() => {
    if (!user || !activeAccountId) return;

    fetchCampaigns();

    const channel = supabase
      .channel(`outbound-campaigns-realtime-${activeAccountId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'outbound_campaigns', filter: `account_id=eq.${activeAccountId}` },
        () => fetchCampaigns()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, activeAccountId, fetchCampaigns]);

  return { campaigns, loading, refetch: fetchCampaigns };
}

// ─── useCreateCampaign ────────────────────────────────────────────────────────

export function useCreateCampaign() {
  const [loading, setLoading] = useState(false);
  const accountId = useCurrentAccountId();

  const createCampaign = useCallback(async (input: CreateCampaignInput): Promise<Campaign | null> => {
    if (!accountId) {
      toast.error('Conta não identificada');
      return null;
    }

    // Enforce WhatsApp anti-ban limits (spec §8.1)
    const dailyLimit = Math.min(input.daily_limit ?? 50, 80);
    const delaySeconds = Math.max(input.delay_seconds ?? 45, 30);

    setLoading(true);
    try {
      const { data, error } = await db
        .from('outbound_campaigns')
        .insert({
          account_id: accountId,
          session_id: input.session_id ?? null,
          name: input.name,
          opening_message: input.opening_message,
          pdf_url: input.pdf_url ?? null,
          pdf_filename: input.pdf_filename ?? null,
          daily_limit: dailyLimit,
          delay_seconds: delaySeconds,
          scheduled_start_at: input.scheduled_start_at ?? null,
          template_name: input.template_name?.trim() || null,
          template_language: input.template_language?.trim() || 'pt_BR',
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Campanha criada com sucesso');
      return data as Campaign;
    } catch (err) {
      console.error('[useCreateCampaign] Error:', err);
      toast.error('Erro ao criar campanha');
      return null;
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  return { createCampaign, loading };
}

// ─── useUpdateCampaignStatus ──────────────────────────────────────────────────

export function useUpdateCampaignStatus() {
  const [loading, setLoading] = useState(false);
  const { activeAccountId } = useActiveAccount();

  const updateStatus = useCallback(async (
    campaignId: string,
    status: Campaign['status']
  ): Promise<boolean> => {
    if (!activeAccountId) {
      toast.error('Conta não identificada');
      return false;
    }

    setLoading(true);
    try {
      const patch: Record<string, unknown> = { status };
      if (status === 'completed') {
        patch.completed_at = new Date().toISOString();
      }

      const { error } = await db
        .from('outbound_campaigns')
        .update(patch)
        .eq('account_id', activeAccountId)
        .eq('id', campaignId);

      if (error) throw error;

      const labels: Record<Campaign['status'], string> = {
        draft: 'Campanha salva como rascunho',
        active: 'Campanha ativada',
        paused: 'Campanha pausada',
        completed: 'Campanha marcada como concluída',
        cancelled: 'Campanha cancelada',
      };
      toast.success(labels[status]);
      return true;
    } catch (err) {
      console.error('[useUpdateCampaignStatus] Error:', err);
      toast.error('Erro ao atualizar status da campanha');
      return false;
    } finally {
      setLoading(false);
    }
  }, [activeAccountId]);

  return { updateStatus, loading };
}

// ─── useUploadCampaignContacts ────────────────────────────────────────────────

export function useUploadCampaignContacts() {
  const [loading, setLoading] = useState(false);
  const accountId = useCurrentAccountId();

  /**
   * Robust CSV parser tuned for common Brazilian spreadsheet exports.
   * Supports:
   *  - comma or semicolon separators
   *  - Windows (CRLF) or Unix (LF) line breaks
   *  - UTF-8 BOM at the start of the file
   *  - quoted fields with escaped double quotes
   *  - headers with or without accents
   * Phone column accepts: phone / telefone / numero / celular / whatsapp / phone_number
   * Name column (optional) accepts: name / nome / call_name
   * Pass preview=true to return only the first 5 rows (for UI preview).
   */
  const parseCSV = useCallback((csvText: string, preview = false): CampaignContactRow[] => {
    // Remove UTF-8 BOM if present
    const clean = csvText.replace(/^\uFEFF/, '');

    // Split into lines (CRLF or LF) and drop empty lines
    const lines = clean.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    // Parse a single line respecting quotes; separator is comma or semicolon
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let field = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (inQuotes) {
          if (char === '"') {
            if (line[i + 1] === '"') {
              // Escaped double quote
              field += '"';
              i++;
            } else {
              inQuotes = false;
            }
          } else {
            field += char;
          }
        } else if (char === '"') {
          inQuotes = true;
        } else if (char === ',' || char === ';') {
          result.push(field);
          field = '';
        } else {
          field += char;
        }
      }
      result.push(field);
      return result.map(f => f.trim());
    };

    const normalize = (h: string) =>
      h
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/['"]/g, '');

    const headers = parseLine(lines[0]).map(normalize);

    const phoneAliases = ['phone', 'telefone', 'numero', 'celular', 'whatsapp', 'phone_number'];
    const nameAliases = ['name', 'nome', 'call_name'];

    const phoneIdx = headers.findIndex(h => phoneAliases.includes(h));
    const nameIdx = headers.findIndex(h => nameAliases.includes(h));

    if (phoneIdx === -1) return [];

    const dataLines = preview ? lines.slice(1, 6) : lines.slice(1);

    return dataLines
      .map(line => {
        const cols = parseLine(line);
        return {
          phone_number: (cols[phoneIdx] || '').replace(/['"]/g, '').trim(),
          name: nameIdx !== -1 ? (cols[nameIdx] || undefined) : undefined,
        };
      })
      .filter(row => row.phone_number.length > 0);
  }, []);

  const uploadContacts = useCallback(async (
    campaignId: string,
    rows: CampaignContactRow[]
  ): Promise<number> => {
    if (!accountId) {
      toast.error('Conta não identificada');
      return 0;
    }

    if (rows.length === 0) {
      toast.error('Nenhum contato válido para importar');
      return 0;
    }

    setLoading(true);
    try {
      const records = rows.map(row => ({
        campaign_id: campaignId,
        account_id: accountId,
        phone_number: row.phone_number,
        name: row.name ?? null,
        status: 'pending',
      }));

      // Insert in batches of 500 to avoid payload size limits
      const BATCH = 500;
      let inserted = 0;
      for (let i = 0; i < records.length; i += BATCH) {
        const { error } = await db
          .from('campaign_contacts')
          .insert(records.slice(i, i + BATCH));
        if (error) throw error;
        inserted += Math.min(BATCH, records.length - i);
      }

      toast.success(`${inserted} contatos importados com sucesso`);
      return inserted;
    } catch (err) {
      console.error('[useUploadCampaignContacts] Error:', err);
      toast.error('Erro ao importar contatos');
      return 0;
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  return { uploadContacts, parseCSV, loading };
}
