import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationResult {
  component: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: ValidationResult[] = [];

    // Resolve the active account (multi-tenant). Prefer the x-account-id header,
    // fall back to the user's active membership.
    let accountId: string | null = req.headers.get('x-account-id');
    if (!accountId) {
      const { data: member } = await supabase
        .from('account_members')
        .select('account_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      accountId = member?.account_id ?? null;
    }

    // Get settings scoped to the active account
    let settings = null;
    if (accountId) {
      const { data: s1 } = await supabase
        .from('nina_settings')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      settings = s1;
    }
    // Legacy fallback: row tied directly to the user
    if (!settings) {
      const { data: s2 } = await supabase.from('nina_settings').select('*').eq('user_id', user.id).maybeSingle();
      settings = s2;
    }

    if (!settings) {
      results.push({ component: 'nina_settings', status: 'error', message: 'Configurações não encontradas', details: 'Execute a inicialização do sistema' });
    } else {
      // Check identity
      if (settings.company_name && settings.sdr_name) {
        results.push({ component: 'identity', status: 'ok', message: `${settings.sdr_name} - ${settings.company_name}` });
      } else {
        results.push({ component: 'identity', status: 'warning', message: 'Identidade não configurada', details: 'Configure nome da empresa e SDR' });
      }

      // Check WhatsApp based on whatsapp_sessions (multi-instance) for the active account
      let sessions: any[] = [];
      if (accountId) {
        const { data: sess } = await supabase
          .from('whatsapp_sessions')
          .select('id, session_name, status, provider, phone_number, evolution_instance_name')
          .eq('account_id', accountId);
        sessions = sess || [];
      }

      const connectedSessions = sessions.filter((s) => s.status === 'connected');
      if (connectedSessions.length > 0) {
        const names = connectedSessions.map((s) => s.session_name).join(', ');
        results.push({
          component: 'whatsapp',
          status: 'ok',
          message: connectedSessions.length === 1
            ? `WhatsApp conectado (${names})`
            : `${connectedSessions.length} sessões conectadas (${names})`,
        });
      } else if (sessions.length > 0) {
        results.push({
          component: 'whatsapp',
          status: 'warning',
          message: 'Sessões configuradas, mas nenhuma conectada',
          details: 'Escaneie o QR Code para conectar',
        });
      } else {
        results.push({
          component: 'whatsapp',
          status: 'error',
          message: 'Nenhuma sessão de WhatsApp configurada',
          details: 'Crie uma sessão em Configurações > WhatsApp',
        });
      }

      // Agent Prompt
      if (settings.system_prompt_override && settings.system_prompt_override.length > 100) {
        results.push({ component: 'agent_prompt', status: 'ok', message: 'Prompt do agente configurado' });
      } else {
        results.push({ component: 'agent_prompt', status: 'warning', message: 'Prompt do agente não personalizado' });
      }

      // ElevenLabs
      if (settings.elevenlabs_api_key) {
        try {
          const elResponse = await fetch('https://api.elevenlabs.io/v1/user', {
            headers: { 'xi-api-key': settings.elevenlabs_api_key },
          });
          results.push({ component: 'elevenlabs', status: elResponse.ok ? 'ok' : 'error', message: elResponse.ok ? 'ElevenLabs conectado' : 'API Key inválida' });
        } catch (e) {
          results.push({ component: 'elevenlabs', status: 'warning', message: 'Não foi possível validar ElevenLabs' });
        }
      } else {
        results.push({ component: 'elevenlabs', status: 'warning', message: 'ElevenLabs não configurado (opcional)' });
      }

      // Business Hours
      if (settings.business_hours_start && settings.business_hours_end) {
        results.push({ component: 'business_hours', status: 'ok', message: `Horário: ${settings.business_hours_start} - ${settings.business_hours_end}` });
      } else {
        results.push({ component: 'business_hours', status: 'warning', message: 'Horário comercial não configurado' });
      }
    }

    // Lovable AI Key
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    results.push({
      component: 'lovable_ai',
      status: lovableApiKey && lovableApiKey.length > 10 ? 'ok' : 'error',
      message: lovableApiKey && lovableApiKey.length > 10 ? 'Lovable AI configurada' : 'LOVABLE_API_KEY não configurada',
    });

    // Pipeline (scoped to the active account)
    let stagesQuery = supabase.from('pipeline_stages').select('*', { count: 'exact', head: true }).eq('is_active', true);
    if (accountId) stagesQuery = stagesQuery.eq('account_id', accountId);
    const { count: stagesCount } = await stagesQuery;
    results.push({
      component: 'pipeline',
      status: stagesCount && stagesCount > 0 ? 'ok' : 'warning',
      message: stagesCount && stagesCount > 0 ? `${stagesCount} estágios no pipeline` : 'Pipeline não configurado',
    });

    // Profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    results.push({
      component: 'profile',
      status: profile ? 'ok' : 'warning',
      message: profile ? (profile.full_name || 'Perfil criado') : 'Perfil não encontrado',
    });

    const hasErrors = results.some(r => r.status === 'error');
    const hasWarnings = results.some(r => r.status === 'warning');
    const overallStatus = hasErrors ? 'error' : hasWarnings ? 'warning' : 'ok';
    const okCount = results.filter(r => r.status === 'ok').length;

    return new Response(JSON.stringify({
      results, overallStatus,
      summary: { ok: okCount, total: results.length, percentage: Math.round((okCount / results.length) * 100) },
      message: overallStatus === 'ok' ? '✅ Tudo configurado!' : overallStatus === 'warning' ? '⚠️ Funcional, itens opcionais pendentes' : '❌ Configurações obrigatórias pendentes',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in validate-setup:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
