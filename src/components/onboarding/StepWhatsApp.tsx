import React, { useState } from 'react';
import { MessageSquare, Key, Globe, Server, ExternalLink, Copy, Check, ChevronDown, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/Button';

interface StepWhatsAppProps {
  evolutionApiUrl: string;
  evolutionApiKey: string;
  evolutionInstanceName: string;
  onEvolutionApiUrlChange: (value: string) => void;
  onEvolutionApiKeyChange: (value: string) => void;
  onEvolutionInstanceNameChange: (value: string) => void;
  webhookUrl: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 }
  },
};

export const StepWhatsApp: React.FC<StepWhatsAppProps> = ({
  evolutionApiUrl,
  evolutionApiKey,
  evolutionInstanceName,
  onEvolutionApiUrlChange,
  onEvolutionApiKeyChange,
  onEvolutionInstanceNameChange,
  webhookUrl,
}) => {
  const [showWebhook, setShowWebhook] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <motion.div 
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants} className="text-center mb-8">
        <motion.div 
          className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 flex items-center justify-center"
          whileHover={{ scale: 1.05, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <MessageSquare className="w-8 h-8 text-emerald-400" />
        </motion.div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Evolution API</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Conecte sua instância da Evolution API para enviar e receber mensagens pelo WhatsApp.
        </p>
      </motion.div>

      <div className="space-y-6 max-w-md mx-auto">
        <motion.div variants={itemVariants} className="space-y-2">
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
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-2">
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
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-2">
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
        </motion.div>

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

                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-xs text-primary font-medium mb-2">Como configurar na Evolution API:</p>
                    <ol className="text-xs text-primary/80 space-y-1 list-decimal list-inside">
                      <li>Acesse o painel da sua Evolution API</li>
                      <li>Vá em Instâncias → sua instância → Webhook</li>
                      <li>Cole a URL acima como webhook</li>
                      <li>Ative os eventos: <strong>MESSAGES_UPSERT</strong>, <strong>MESSAGES_UPDATE</strong>, <strong>CONNECTION_UPDATE</strong></li>
                    </ol>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Tutorial Link */}
      <motion.div variants={itemVariants} className="text-center pt-4">
        <motion.a
          href="https://doc.evolution-api.com/v2/pt/get-started/introduction"
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.02 }}
          className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Documentação da Evolution API
        </motion.a>
      </motion.div>
    </motion.div>
  );
};
