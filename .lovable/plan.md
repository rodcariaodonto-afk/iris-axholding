

## Plano: Diagnosticar e restaurar Iris

### Problema identificado
As Edge Functions não estão gerando logs, indicando que não estão sendo chamadas. As mensagens do WhatsApp não estão entrando no pipeline desde ~21 de março.

### Causa provável
1. **Edge Functions não deployadas** — Após edições recentes, as funções podem precisar de redeploy
2. **Webhook da Evolution API desconfigurado** — A URL do webhook pode estar apontando para um endpoint incorreto

### Ações

#### 1. Redeployar todas as Edge Functions críticas
Forçar o deploy das funções do pipeline:
- `whatsapp-webhook` (recebe mensagens)
- `message-grouper` (agrupa mensagens)
- `nina-orchestrator` (processa com IA)
- `whatsapp-sender` (envia respostas)
- `trigger-nina-orchestrator` e `trigger-whatsapp-sender` (triggers de cron)

#### 2. Verificar URL do webhook
A URL do webhook que deve estar configurada na Evolution API é:
```
https://ggrgqvnmuptwinxsobkz.supabase.co/functions/v1/whatsapp-webhook
```
Confirmar que esta URL está configurada na instância `Iris-AXholding` da Evolution API em `https://mythicallamprey-evolution.cloudfy.live/`.

#### 3. Testar o pipeline
Após o redeploy, usar a função `simulate-webhook` para enviar uma mensagem de teste e verificar se o fluxo completo funciona (webhook → grouper → orchestrator → sender).

### Resultado esperado
Iris voltará a receber mensagens do WhatsApp e respondê-las automaticamente.

