import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAccount } from '@/hooks/useActiveAccount';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  isRequired: boolean;
}

export interface OnboardingStatus {
  loading: boolean;
  isComplete: boolean;
  currentStep: number;
  steps: OnboardingStep[];
  completionPercentage: number;
  hasSeenWizard: boolean;
  isAdmin: boolean;
  refetch: () => Promise<void>;
  markWizardSeen: () => void;
  resetWizard: () => void;
}

const WIZARD_SEEN_KEY = 'onboarding_wizard_seen';

const getWizardSeenKey = (accountId: string | null) => `${WIZARD_SEEN_KEY}:${accountId || 'none'}`;

const getWizardSeen = (accountId: string | null) => {
  try {
    return localStorage.getItem(getWizardSeenKey(accountId)) === 'true';
  } catch {
    return false;
  }
};

export function useOnboardingStatus(): OnboardingStatus {
  const { user } = useAuth();
  const { activeAccountId, loading: accountLoading } = useActiveAccount();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 'identity',
      title: 'Identidade',
      description: 'Configure o nome da empresa e do agente',
      isComplete: false,
      isRequired: true,
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp',
      description: 'Configure a Evolution API',
      isComplete: false,
      isRequired: true,
    },
    {
      id: 'agent',
      title: 'Agente',
      description: 'Configure o prompt e comportamento do agente',
      isComplete: false,
      isRequired: true,
    },
    {
      id: 'elevenlabs',
      title: 'ElevenLabs',
      description: 'Configure respostas em áudio (opcional)',
      isComplete: false,
      isRequired: false,
    },
    {
      id: 'business_hours',
      title: 'Horário',
      description: 'Configure o horário de atendimento',
      isComplete: false,
      isRequired: false,
    },
    {
      id: 'verification',
      title: 'Verificação',
      description: 'Verifique se o sistema está configurado',
      isComplete: false,
      isRequired: false,
    },
    {
      id: 'finish',
      title: 'Finalização',
      description: 'Revise e teste sua configuração',
      isComplete: false,
      isRequired: false,
    },
  ]);
  const [hasSeenWizard, setHasSeenWizard] = useState(() => getWizardSeen(null));

  const fetchStatus = useCallback(async () => {
    if (accountLoading) return;

    if (!user || !activeAccountId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const accountWizardSeen = getWizardSeen(activeAccountId);
      setHasSeenWizard(accountWizardSeen);

      // Check if user is admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const userIsAdmin = roleData?.role === 'admin';
      setIsAdmin(userIsAdmin);

      // Fetch nina_settings scoped to the active account.
      // Super admins can see multiple tenants, so this explicit filter is mandatory.
      const { data: settings } = await supabase
        .from('nina_settings')
        .select('*')
        .eq('account_id', activeAccountId)
        .limit(1)
        .maybeSingle();

      if (settings) {
        console.log('[Onboarding] WhatsApp check:', {
          evolution_api_url: !!settings.evolution_api_url,
          evolution_api_key: !!settings.evolution_api_key,
          evolution_instance_name: !!settings.evolution_instance_name,
          whatsapp_access_token: !!settings.whatsapp_access_token,
        });
        setSteps(prev => prev.map(step => {
          switch (step.id) {
            case 'identity':
              return {
                ...step,
                isComplete: !!(settings.company_name && settings.sdr_name),
              };
            case 'whatsapp': {
              const hasEvolution = !!(settings.evolution_api_url && settings.evolution_api_key && settings.evolution_instance_name);
              const hasMeta = !!(settings.whatsapp_access_token && settings.whatsapp_phone_number_id);
              const whatsappComplete = hasEvolution || hasMeta;
              console.log('[Onboarding] WhatsApp isComplete:', whatsappComplete, { hasEvolution, hasMeta });
              return {
                ...step,
                isComplete: whatsappComplete,
              };
            }
            case 'agent':
              return {
                ...step,
                isComplete: !!(settings.company_name && settings.sdr_name),
              };
            case 'elevenlabs':
              return {
                ...step,
                isComplete: !!settings.elevenlabs_api_key,
              };
            case 'business_hours':
              const isDefaultConfig = 
                settings.timezone === 'America/Sao_Paulo' &&
                settings.business_hours_start === '09:00:00' &&
                settings.business_hours_end === '18:00:00' &&
                JSON.stringify(settings.business_days) === '[1,2,3,4,5]';
              return {
                ...step,
                isComplete: !isDefaultConfig || accountWizardSeen,
              };
            case 'verification': {
              const hasIdentity = !!(settings.company_name && settings.sdr_name);
              const hasWhatsapp = !!(
                (settings.evolution_api_url && settings.evolution_api_key && settings.evolution_instance_name) ||
                (settings.whatsapp_access_token && settings.whatsapp_phone_number_id)
              );
              return {
                ...step,
                isComplete: hasIdentity && hasWhatsapp,
              };
            }
            case 'finish':
              return {
                ...step,
                isComplete: accountWizardSeen,
              };
            default:
              return step;
          }
        }));
      } else {
        setSteps(prev => prev.map(step => ({ ...step, isComplete: false })));
      }
    } catch (error) {
      console.error('Error fetching onboarding status:', error);
    } finally {
      setLoading(false);
    }
  }, [accountLoading, activeAccountId, user]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const markWizardSeen = useCallback(() => {
    localStorage.setItem(getWizardSeenKey(activeAccountId), 'true');
    setHasSeenWizard(true);
    setSteps(prev => prev.map(step => 
      step.id === 'finish' ? { ...step, isComplete: true } : step
    ));
  }, [activeAccountId]);

  const resetWizard = useCallback(() => {
    localStorage.removeItem(getWizardSeenKey(activeAccountId));
    setHasSeenWizard(false);
    setSteps(prev => prev.map(step => 
      step.id === 'finish' ? { ...step, isComplete: false } : step
    ));
  }, [activeAccountId]);

  const requiredSteps = steps.filter(s => s.isRequired);
  const completedRequired = requiredSteps.filter(s => s.isComplete).length;
  const allStepsComplete = steps.every(s => s.isComplete);
  const currentStepIndex = steps.findIndex(s => !s.isComplete);
  const completionPercentage = Math.round((steps.filter(s => s.isComplete).length / steps.length) * 100);

  return {
    loading,
    isComplete: allStepsComplete,
    currentStep: currentStepIndex === -1 ? steps.length - 1 : currentStepIndex,
    steps,
    completionPercentage,
    hasSeenWizard,
    isAdmin,
    refetch: fetchStatus,
    markWizardSeen,
    resetWizard,
  };
}
