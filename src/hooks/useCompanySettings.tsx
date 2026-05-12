import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CompanySettings {
  companyName: string;
  sdrName: string;
  companyLogoUrl: string | null;
  loading: boolean;
  isAdmin: boolean;
  refetch: () => Promise<void>;
}

const CompanySettingsContext = createContext<CompanySettings | undefined>(undefined);

export const CompanySettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [companyName, setCompanyName] = useState('');
  const [sdrName, setSdrName] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useAuth();

  const fetchSettings = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Check if user is admin via account membership (Phase 2+)
      const { data: memberRow } = await supabase
        .from('account_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('role', ['owner', 'admin'])
        .limit(1)
        .maybeSingle();

      setIsAdmin(!!memberRow);
      
      // Fetch global nina_settings (no user_id filter)
      const { data, error } = await supabase
        .from('nina_settings')
        .select('company_name, sdr_name, company_logo_url')
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('[useCompanySettings] Query error:', error);
        throw error;
      }

      if (data) {
        setCompanyName(data.company_name || 'Sua Empresa');
        setSdrName(data.sdr_name || 'Agente');
        setCompanyLogoUrl((data as any).company_logo_url || null);
      } else {
        // No settings exist - use defaults (admin will need to configure via wizard)
        setCompanyName('Sua Empresa');
        setSdrName('Agente');
      }
    } catch (error) {
      console.error('[useCompanySettings] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user]);

  const value: CompanySettings = {
    companyName,
    sdrName,
    companyLogoUrl,
    loading,
    isAdmin,
    refetch: fetchSettings,
  };

  return (
    <CompanySettingsContext.Provider value={value}>
      {children}
    </CompanySettingsContext.Provider>
  );
};

export const useCompanySettings = () => {
  const context = useContext(CompanySettingsContext);
  if (context === undefined) {
    throw new Error('useCompanySettings must be used within a CompanySettingsProvider');
  }
  return context;
};
