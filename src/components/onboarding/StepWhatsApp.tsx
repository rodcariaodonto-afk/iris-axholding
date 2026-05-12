import React, { useState } from 'react';
import { MessageSquare, Key, Globe, Server, ExternalLink, Copy, Check, ChevronDown, Phone, Hash, Shield, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/Button';

export type WhatsAppProvider = 'evolution' | 'meta_cloud';

interface StepWhatsAppProps {
  provider: WhatsAppProvider;
  onProviderChange: (p: WhatsAppProvider) => void;

  // Evolution
  evolutionApiUrl: string;
  evolutionApiKey: string;
  evolutionInstanceName: string;
  onEvolutionApiUrlChange: (value: string) => void;
  onEvolutionApiKeyChange: (value: string) => void;
  onEvolutionInstanceNameChange: (value: string) => void;

  // Meta Cloud
  whatsappAccessToken: string;
  whatsappPhoneNumberId: string;
  whatsappBusinessAccountId: string;
  whatsappVerifyToken: string;
  onWhatsappAccessTokenChange: (value: string) => void;
  onWhatsappPhoneNumberIdChange: (value: string) => void;
  onWhatsappBusinessAccountIdChange: (value: string) => void;
  onWhatsappVerifyTokenChange: (value: string) => void;

  webhookUrl: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1, y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 }
  },
};

export const StepWhatsApp: React.FC<StepWhatsAppProps> = ({
  provider,
  onProviderChange,
  evolutionApiUrl,
  evolutionApiKey,
  evolutionInstanceName,
  onEvolutionApiUrlChange,
  onEvolutionApiKeyChange,
  onEvolutionInstanceNameChange,
  whatsappAccessToken,
  whatsappPhoneNumberId,
  whatsappBusinessAccountId,
  whatsappVerifyToken,
  onWhatsappAccessTokenChange,
  onWhatsappPhoneNumberIdChange,
  onWhatsappBusinessAccountIdChange,
  onWhatsappVerifyTokenChange,
  webhookUrl,
}) => {
  const [showWebhook, setShowWebhook] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const isMeta = provider === 'meta_cloud';

  return (
    <motion.div
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants} className="text-center mb-2">
        <motion.div
          className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 flex items-center justify-center"
          whileHover={{ scale: 1.05, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <MessageSquare className="w-8 h-8 text-emerald-400" />
        </motion.div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Conexão com WhatsApp</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Escolha qual provedor utilizar para receber e enviar mensagens.
        </p>
      </motion.div>

      {/* Provider Toggle */}
      <motion.div variants={itemVariants} className="max-w-md mx-auto">
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/40 border border-border">
          <button
            type="button"
            onClick={() => onProviderChange('evolution')}
            className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              !isMeta
                ? 'bg-background text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Evolution API
          </button>
          <button
            type="button"
            onClick={() => onProviderChange('meta_cloud')}
            className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isMeta
                ? 'bg-background text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Meta Cloud API (oficial)
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {isMeta
            ? 'API oficial Meta — exige conta Business verificada e número aprovado.'
            : 'Self-hosted — rápido de configurar, sem janela de 24h.'}
        </p>
      </motion.div>

      <div className="space-y-6 max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {!isMeta ? (
            <motion.div
              key="evolution"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <Label htmlFor="evolutionApiUrl" className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  URL do Servidor
                </Label>
                <Input
                  id="evolutionApiUrl"
                  value={evolutionApiUrl}
                  onChange={(e) => onEvolutionApiUrlChange(e.target.value)}
                  placeholder="https://sua-evolution.com"
                  className="font-mono text-sm focus:ring-emerald-500"
                />
                <p className="text-xs text-muted-foreground">
                  URL onde sua Evolution API está hospedada
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="evolutionApiKey" className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-muted-foreground" />
                  API Key (Global)
                </Label>
                <Input
                  id="evolutionApiKey"
                  type="password"
                  value={evolutionApiKey}
                  onChange={(e) => onEvolutionApiKeyChange(e.target.value)}
                  placeholder="Sua API Key da Evolution"
                  className="font-mono text-sm focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="evolutionInstanceName" className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-muted-foreground" />
                  Nome da Instância
                </Label>
                <Input
                  id="evolutionInstanceName"
                  value={evolutionInstanceName}
                  onChange={(e) => onEvolutionInstanceNameChange(e.target.value)}
                  placeholder="minha-instancia"
                  className="font-mono text-sm focus:ring-emerald-500"
                />
                <p className="text-xs text-muted-foreground">
                  Nome da instância criada na Evolution API
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="meta"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <Label htmlFor="whatsappPhoneNumberId" className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  Phone Number ID
                </Label>
                <Input
                  id="whatsappPhoneNumberId"
                  value={whatsappPhoneNumberId}
                  onChange={(e) => onWhatsappPhoneNumberIdChange(e.target.value)}
                  placeholder="123456789012345"
                  className="font-mono text-sm focus:ring-emerald-500"
                />
                <p className="text-xs text-muted-foreground">
                  Encontrado em <strong>WhatsApp → API Setup</strong> no Meta for Developers
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsappAccessToken" className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-muted-foreground" />
                  Access Token (Permanente)
                </Label>
                <Input
                  id="whatsappAccessToken"
                  type="password"
                  value={whatsappAccessToken}
                  onChange={(e) => onWhatsappAccessTokenChange(e.target.value)}
                  placeholder="EAAxxxxxxxxxxxxxxxxxxx"
                  className="font-mono text-sm focus:ring-emerald-500"
                />
                <p className="text-xs text-muted-foreground">
                  Token de System User com permissões <code>whatsapp_business_messaging</code> e <code>whatsapp_business_management</code>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsappBusinessAccountId" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  Business Account ID (WABA)
                </Label>
                <Input
                  id="whatsappBusinessAccountId"
                  value={whatsappBusinessAccountId}
                  onChange={(e) => onWhatsappBusinessAccountIdChange(e.target.value)}
                  placeholder="987654321098765"
                  className="font-mono text-sm focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsappVerifyToken" className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  Verify Token (você define)
                </Label>
                <Input
                  id="whatsappVerifyToken"
                  value={whatsappVerifyToken}
                  onChange={(e) => onWhatsappVerifyTokenChange(e.target.value)}
                  placeholder="meu-token-secreto-123"
                  className="font-mono text-sm focus:ring-emerald-500"
                />
                <p className="text-xs text-muted-foreground">
                  Use o mesmo valor ao configurar o webhook no Meta for Developers
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Webhook Configuration */}
        <motion.div variants={itemVariants} className="pt-4 border-t border-border">
          <motion.button
            onClick={() => setShowWebhook(!showWebhook)}
            whileHover={{ x: 4 }}
            className="flex items-center justify-between w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Configuração de Webhook
            </span>
            <motion.div animate={{ rotate: showWebhook ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </motion.button>

          <AnimatePresence>
            {showWebhook && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Webhook URL</Label>
                    <div className="flex gap-2">
                      <Input
                        value={webhookUrl}
                        readOnly
                        className="bg-background border-border font-mono text-xs flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(webhookUrl, 'url')}
                        className="px-3"
                      >
                        {copied === 'url' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {!isMeta ? (
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs text-primary font-medium mb-2">Como configurar na Evolution API:</p>
                      <ol className="text-xs text-primary/80 space-y-1 list-decimal list-inside">
                        <li>Acesse o painel da sua Evolution API</li>
                        <li>Vá em Instâncias → sua instância → Webhook</li>
                        <li>Cole a URL acima como webhook</li>
                        <li>Ative os eventos: <strong>MESSAGES_UPSERT</strong>, <strong>MESSAGES_UPDATE</strong>, <strong>CONNECTION_UPDATE</strong></li>
                      </ol>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs text-primary font-medium mb-2">Como configurar no Meta for Developers:</p>
                      <ol className="text-xs text-primary/80 space-y-1 list-decimal list-inside">
                        <li>Acesse <strong>developers.facebook.com</strong> → seu app</li>
                        <li>Vá em <strong>WhatsApp → Configuration → Webhook</strong></li>
                        <li>Cole a URL acima em <strong>Callback URL</strong></li>
                        <li>Cole o <strong>Verify Token</strong> definido acima</li>
                        <li>Inscreva-se nos eventos: <strong>messages</strong>, <strong>message_status</strong></li>
                      </ol>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <motion.div variants={itemVariants} className="text-center pt-2">
        <motion.a
          href={isMeta
            ? 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started'
            : 'https://doc.evolution-api.com/v2/pt/get-started/introduction'}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.02 }}
          className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          {isMeta ? 'Documentação Meta Cloud API' : 'Documentação Evolution API'}
        </motion.a>
      </motion.div>
    </motion.div>
  );
};
