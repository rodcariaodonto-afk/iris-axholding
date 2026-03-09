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

    // Get settings with triple fallback
    let settings = null;
    const { data: s1 } = await supabase.from('nina_settings').select('*').eq('user_id', user.id).maybeSingle();
    settings = s1;
    if (!settings) {
      const { data: s2 } = await supabase.from('nina_settings').select('*').is('user_id', null).maybeSingle();
      settings = s2;
    }
    if (!settings) {
      const { data: s3 } = await supabase.from('nina_settings').select('*').limit(1).maybeSingle();
      settings = s3;
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

      // Check WhatsApp based on provider
      const provider = settings.whatsapp_provider || 'evolution';

      if (provider === 'evolution') {
        if (settings.evolution_api_url && settings.evolution_api_key && settings.evolution_instance_name) {
          // Test Evolution API connection
          try {
            const baseUrl = settings.evolution_api_url.replace(/\/$/, '');
            const response = await fetch(`${baseUrl}/instance/connectionState/${settings.evolution_instance_name}`, {
              headers: { 'apikey': settings.evolution_api_key },
            });
            
            if (response.ok) {
              const data = await response.json();
              const state = data.instance?.state || data.state || 'unknown';
              if (state === 'open' || state === 'connected') {
                results.push({ component: 'whatsapp', status: 'ok', message: `Evolution API conectada (${settings.evolution_instance_name})` });
              } else {
                results.push({ component: 'whatsapp', status: 'warning', message: `Evolution API: instância ${state}`, details: 'Verifique se o QR Code foi escaneado' });
              }
            } else {
              results.push({ component: 'whatsapp', status: 'error', message: 'Erro ao conectar com Evolution API', details: 'Verifique URL e API Key' });
            }
          } catch (e) {
            results.push({ component: 'whatsapp', status: 'warning', message: 'Não foi possível validar Evolution API', details: 'Erro de conexão' });
          }
        } else {
          results.push({ component: 'whatsapp', status: 'error', message: 'Evolution API não configurada', details: 'Configure URL, API Key e nome da instância' });
        }
      } else {
        // Cloud API validation (legacy)
        if (settings.whatsapp_access_token && settings.whatsapp_phone_number_id) {
          try {
            const waResponse = await fetch(`https://graph.facebook.com/v18.0/${settings.whatsapp_phone_number_id}`, {
              headers: { Authorization: `Bearer ${settings.whatsapp_access_token}` },
            });
            if (waResponse.ok) {
              const waData = await waResponse.json();
              results.push({ component: 'whatsapp', status: 'ok', message: `WhatsApp conectado: ${waData.display_phone_number || 'Ativo'}` });
            } else {
              results.push({ component: 'whatsapp', status: 'error', message: 'Token do WhatsApp inválido ou expirado' });
            }
          } catch (e) {
            results.push({ component: 'whatsapp', status: 'warning', message: 'Não foi possível validar WhatsApp' });
          }
        } else {
          results.push({ component: 'whatsapp', status: 'error', message: 'WhatsApp Cloud API não configurada' });
        }
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

    // Pipeline
    const { count: stagesCount } = await supabase.from('pipeline_stages').select('*', { count: 'exact', head: true }).eq('is_active', true);
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
