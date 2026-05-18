import React, { useRef, useState } from 'react';
import { Shield, Bot, Plug, Loader2, Save, RotateCcw, BookOpen, Lock, FolderOpen, User, Mail, MessageSquare, Building2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import AgentSettings, { AgentSettingsRef } from './settings/AgentSettings';
import ApiSettings, { ApiSettingsRef } from './settings/ApiSettings';
import SystemRoadmap from './SystemRoadmap';
import MediaLibrary from './settings/MediaLibrary';
import AccountSettings from './settings/AccountSettings';
import EmailSettings from './settings/EmailSettings';
import WhatsAppSessions from './settings/WhatsAppSessions';
import WhatsAppQueues from './settings/WhatsAppQueues';
import CoworkingSettings from './settings/CoworkingSettings';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { Button } from './Button';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { useCoworkingModuleAvailable } from '@/hooks/useCoworking';
import { useOutletContext } from 'react-router-dom';

interface OutletContext {
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
}

const Settings: React.FC = () => {
  const { companyName, isAdmin } = useCompanySettings();
  const agentRef = useRef<AgentSettingsRef>(null);
  const apiRef = useRef<ApiSettingsRef>(null);
  const [activeTab, setActiveTab] = useState('agent');
  const { resetWizard } = useOnboardingStatus();
  const { setShowOnboarding } = useOutletContext<OutletContext>();
  const { available: coworkingAvailable } = useCoworkingModuleAvailable();

  const handleReopenOnboarding = () => {
    resetWizard();
    setShowOnboarding(true);
  };

  const handleSave = async () => {
    if (activeTab === 'agent') {
      await agentRef.current?.save();
    } else if (activeTab === 'apis') {
      await apiRef.current?.save();
    }
  };

  const handleCancel = () => {
    if (activeTab === 'agent') {
      agentRef.current?.cancel();
    } else if (activeTab === 'apis') {
      apiRef.current?.cancel();
    }
  };

  const isSaving = activeTab === 'agent' 
    ? agentRef.current?.isSaving 
    : apiRef.current?.isSaving;
  
  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto h-full overflow-y-auto bg-slate-950 text-slate-50 custom-scrollbar">
      <div className="mb-6 sm:mb-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Configurações</h2>
          <p className="text-sm text-slate-400 mt-1">
            Central de controle da sua instância {companyName}.
            {!isAdmin && (
              <span className="ml-2 text-amber-400">(Somente leitura)</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReopenOnboarding}
              className="text-slate-400 hover:text-white gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Refazer Onboarding
            </Button>
          )}
          <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs rounded-full font-mono flex items-center">
            {isAdmin ? (
              <>
                <Shield className="w-3 h-3 mr-1" /> Admin
              </>
            ) : (
              <>
                <Lock className="w-3 h-3 mr-1" /> Somente Leitura
              </>
            )}
          </span>
        </div>
      </div>

      <Tabs defaultValue="agent" className="w-full" onValueChange={setActiveTab}>
        <div className="flex flex-col mb-6 sm:mb-8 gap-3">
          <div className="w-full overflow-x-auto overflow-y-hidden settings-tabs-scroll">
            <TabsList className="!flex w-max min-w-full justify-start !overflow-visible">
              <TabsTrigger value="agent" className="gap-2 shrink-0">
                <Bot className="w-4 h-4" />
                Agente
              </TabsTrigger>
              <TabsTrigger value="apis" className="gap-2 shrink-0">
                <Plug className="w-4 h-4" />
                APIs
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="gap-2 shrink-0">
                <MessageSquare className="w-4 h-4" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="queues" className="gap-2 shrink-0">
                <MessageSquare className="w-4 h-4" />
                Filas
              </TabsTrigger>
              <TabsTrigger value="docs" className="gap-2 shrink-0">
                <BookOpen className="w-4 h-4" />
                Documentação
              </TabsTrigger>
              <TabsTrigger value="media" className="gap-2 shrink-0">
                <FolderOpen className="w-4 h-4" />
                Arquivos
              </TabsTrigger>
              <TabsTrigger value="account" className="gap-2 shrink-0">
                <User className="w-4 h-4" />
                Conta
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-2 shrink-0">
                <Mail className="w-4 h-4" />
                Email
              </TabsTrigger>
              {coworkingAvailable && (
                <TabsTrigger value="coworking" className="gap-2 shrink-0">
                  <Building2 className="w-4 h-4" />
                  Coworking
                </TabsTrigger>
              )}
            </TabsList>
          </div>


          {activeTab !== 'docs' && activeTab !== 'media' && activeTab !== 'account' && activeTab !== 'email' && activeTab !== 'whatsapp' && activeTab !== 'queues' && activeTab !== 'coworking' && isAdmin && (
            <div className="flex gap-3">
              <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>Cancelar</Button>
              <Button variant="primary" onClick={handleSave} disabled={isSaving} className="gap-2">
                {isSaving ? (<><Loader2 className="w-4 h-4 animate-spin" />Salvando...</>) : (<><Save className="w-4 h-4" />Salvar Alterações</>)}
              </Button>
            </div>
          )}

          {activeTab !== 'docs' && activeTab !== 'media' && activeTab !== 'account' && activeTab !== 'email' && activeTab !== 'whatsapp' && activeTab !== 'queues' && activeTab !== 'coworking' && !isAdmin && (
            <div className="flex items-center gap-2 text-sm text-amber-400">
              <Lock className="w-4 h-4" />
              Apenas administradores podem editar
            </div>
          )}
        </div>

        <TabsContent value="agent">
          <AgentSettings ref={agentRef} />
        </TabsContent>

        <TabsContent value="apis">
          <ApiSettings ref={apiRef} />
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsAppSessions />
        </TabsContent>

        <TabsContent value="queues">
          <WhatsAppQueues />
        </TabsContent>

        <TabsContent value="docs">
          <SystemRoadmap />
        </TabsContent>

        <TabsContent value="media">
          <MediaLibrary />
        </TabsContent>

        <TabsContent value="account">
          <AccountSettings />
        </TabsContent>

        <TabsContent value="email">
          <EmailSettings />
        </TabsContent>

        {coworkingAvailable && (
          <TabsContent value="coworking">
            <CoworkingSettings />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Settings;
