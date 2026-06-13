# SPEC — Módulo: Campanhas Outbound (Prospecção Ativa)
> Repositório: `iris-axholding`  
> Para uso com Claude Code via terminal

---

## 1. Objetivo

Adicionar à Íris um módulo de **campanhas de prospecção ativa (outbound)**, onde a IA inicia o contato com uma lista de leads frios via WhatsApp, enviando mensagem de texto + PDF automaticamente, e após a resposta do lead, assume a conversa normalmente até o agendamento e transferência para o consultor.

O módulo é **opcional por cliente** — o Super Admin libera ou bloqueia via toggle, exatamente como já funciona o módulo Coworking.

---

## 2. Como o sistema de módulos funciona hoje (padrão a seguir)

### Referência: Módulo Coworking

**Controle pelo Super Admin:**
- Arquivo: `src/components/admin/AdminAccounts.tsx`
- Função: `toggleCoworkingModule(account, enabled)`
- Persistência: `accounts.settings → { coworking_module_available: true/false }`
- UI: `<Switch checked={!!a.settings?.coworking_module_available} onCheckedChange={(v) => toggleCoworkingModule(a, v)} />`

**Leitura no cliente:**
- Hook: `src/hooks/useCoworking.tsx` → `useCoworkingModuleAvailable()`
- Lê `accounts.settings.coworking_module_available`
- Se `false` → módulo oculto/bloqueado no menu do cliente

**O módulo Campanhas Outbound deve seguir EXATAMENTE esse padrão.**

---

## 3. O que já existe na stack e NÃO precisa ser alterado

| Componente | Arquivo | Por que não mexer |
|---|---|---|
| `whatsapp-sender` | `supabase/functions/whatsapp-sender/index.ts` | Já suporta Evolution API e `message_type: 'document'` nativamente |
| `nina-orchestrator` | `supabase/functions/nina-orchestrator/index.ts` | Já lê prompt de `nina_settings.system_prompt_override` |
| `send_queue` | tabela existente | Já tem `media_url`, `message_type`, `scheduled_at` — suporta disparo de PDF |
| `whatsapp-sender` provider logic | linha ~65 do sender | `provider === 'evolution' → sendMessageEvolution()` já implementado |

### Como o sender já envia documentos via Evolution API (para referência):
```typescript
case 'document':
  endpoint = `/message/sendMedia/${instance}`;
  body = { number: recipient, mediatype: 'document', media: queueItem.media_url, fileName: queueItem.content || 'document' };
  break;
```

---

## 4. O que precisa ser criado

### 4.1 — Migration SQL (nova)

**Arquivo a criar:** `supabase/migrations/[timestamp]_outbound_campaigns_module.sql`

```sql
-- ============================================================
-- MÓDULO: CAMPANHAS OUTBOUND
-- ============================================================

-- Tabela 1: Definição da campanha
CREATE TABLE IF NOT EXISTS public.outbound_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
  opening_message TEXT NOT NULL,
  pdf_url TEXT,
  pdf_filename TEXT,
  daily_limit INTEGER NOT NULL DEFAULT 50,
  delay_seconds INTEGER NOT NULL DEFAULT 45,
  scheduled_start_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_campaigns_account
  ON public.outbound_campaigns (account_id, status);

-- Tabela 2: Contatos da campanha
CREATE TABLE IF NOT EXISTS public.campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.outbound_campaigns(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'replied', 'opted_out', 'failed', 'converted')),
  sent_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  error_message TEXT,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign_status
  ON public.campaign_contacts (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_phone
  ON public.campaign_contacts (phone_number);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_account
  ON public.campaign_contacts (account_id);

-- RLS
ALTER TABLE public.outbound_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members read outbound_campaigns"
  ON public.outbound_campaigns FOR SELECT TO authenticated
  USING (is_account_member(account_id) OR is_super_admin());

CREATE POLICY "Account admins manage outbound_campaigns"
  ON public.outbound_campaigns FOR ALL TO authenticated
  USING (has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) OR is_super_admin())
  WITH CHECK (has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) OR is_super_admin());

CREATE POLICY "Account members read campaign_contacts"
  ON public.campaign_contacts FOR SELECT TO authenticated
  USING (is_account_member(account_id) OR is_super_admin());

CREATE POLICY "Account admins manage campaign_contacts"
  ON public.campaign_contacts FOR ALL TO authenticated
  USING (has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) OR is_super_admin())
  WITH CHECK (has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) OR is_super_admin());

-- Updated_at triggers (padrão do projeto)
CREATE OR REPLACE FUNCTION public.update_outbound_campaigns_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_outbound_campaigns_updated_at
  BEFORE UPDATE ON public.outbound_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_outbound_campaigns_updated_at();

CREATE OR REPLACE FUNCTION public.update_campaign_contacts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_campaign_contacts_updated_at
  BEFORE UPDATE ON public.campaign_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_campaign_contacts_updated_at();
```

---

### 4.2 — Nova Edge Function: `campaign-dispatcher`

**Arquivo a criar:** `supabase/functions/campaign-dispatcher/index.ts`

**Responsabilidade:** Processar a fila de contatos pendentes das campanhas ativas, respeitando `daily_limit` e `delay_seconds`, e inserir na `send_queue` existente.

**Lógica principal:**

```
1. Buscar campanhas com status = 'active' e conta com outbound_campaigns_enabled = true
2. Para cada campanha:
   a. Contar quantas mensagens já foram enviadas hoje (campaign_contacts WHERE status = 'sent' AND sent_at >= hoje)
   b. Se já atingiu daily_limit → pular
   c. Buscar próximo contato com status = 'pending'
   d. Criar/buscar contact na tabela contacts (pelo phone_number + account_id)
   e. Criar conversation para esse contact + session_id da campanha
   f. Marcar na conversation.metadata que é outbound: { outbound: true, campaign_id, campaign_name, pdf_filename }
   g. Inserir 2 registros na send_queue:
      - Mensagem texto: { message_type: 'text', content: campanha.opening_message }
      - PDF (se houver): { message_type: 'document', media_url: campanha.pdf_url, content: campanha.pdf_filename }
   h. Atualizar campaign_contacts SET status = 'sent', sent_at = now()
   i. Aguardar delay_seconds antes do próximo contato (usar scheduled_at na send_queue)
3. Se todos os contatos foram processados → UPDATE outbound_campaigns SET status = 'completed'
```

**Como acionar (duas opções — escolher uma):**

**Opção A — pg_cron (recomendado):**
```sql
-- Adicionar na migration ou via Supabase Dashboard > Database > Extensions > pg_cron
SELECT cron.schedule(
  'campaign-dispatcher-hourly',
  '0 9-18 * * 1-5',  -- Seg a Sex, das 9h às 18h (horário UTC-3, ajustar)
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/campaign-dispatcher',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb
  )$$
);
```

**Opção B — trigger-campaign-dispatcher (mesmo padrão do trigger-nina-orchestrator):**
Criar `supabase/functions/trigger-campaign-dispatcher/index.ts` com `verify_jwt: false`, que apenas chama o dispatcher via HTTP interno. Pode ser acionado manualmente ou via cron externo.

**Estrutura do arquivo:**
```typescript
// Seguir o mesmo padrão de supabase/functions/trigger-nina-orchestrator/index.ts
// verify_jwt: false
// Faz POST para /functions/v1/campaign-dispatcher com service role key
```

---

### 4.3 — Ajuste no `whatsapp-webhook`

**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts`

**Onde inserir:** Logo após criar/recuperar a `conversation` (linha ~308 do arquivo atual), antes de inserir a mensagem na fila.

**O que adicionar (~25 linhas):**

```typescript
// Verificar se esse número tem um disparo de campanha pendente ou recente
const { data: campaignContact } = await supabase
  .from('campaign_contacts')
  .select('id, campaign_id, status, campaign:outbound_campaigns(name, pdf_filename)')
  .eq('phone_number', phoneNumber)
  .eq('account_id', sessionAccountId)
  .in('status', ['sent', 'pending'])
  .order('sent_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (campaignContact && campaignContact.status === 'sent') {
  // Marcar como respondido
  await supabase
    .from('campaign_contacts')
    .update({
      status: 'replied',
      replied_at: new Date().toISOString(),
      conversation_id: conversation.id
    })
    .eq('id', campaignContact.id);

  // Injetar contexto outbound na conversa para o orchestrator usar
  await supabase
    .from('conversations')
    .update({
      metadata: {
        outbound: true,
        campaign_id: campaignContact.campaign_id,
        campaign_name: campaignContact.campaign?.name,
        pdf_filename: campaignContact.campaign?.pdf_filename,
      }
    })
    .eq('id', conversation.id);
}
```

---

### 4.4 — Ajuste no `nina-orchestrator`

**Arquivo:** `supabase/functions/nina-orchestrator/index.ts`

**Onde inserir:** Na função `buildEnhancedPrompt()` (linha ~1653), adicionar bloco de contexto outbound.

```typescript
// Adicionar após o bloco de MEMÓRIA DO CLIENTE existente:
if (conversation?.metadata?.outbound) {
  contextInfo += `\n\nCONTEXTO DE ORIGEM:`;
  contextInfo += `\n- Este lead veio de uma campanha de prospecção ativa.`;
  if (conversation.metadata.campaign_name) {
    contextInfo += `\n- Campanha: ${conversation.metadata.campaign_name}`;
  }
  if (conversation.metadata.pdf_filename) {
    contextInfo += `\n- Material enviado: ${conversation.metadata.pdf_filename}`;
  }
  contextInfo += `\n- IMPORTANTE: Você iniciou o contato. Use o protocolo de abertura outbound.`;
}
```

> **Nota:** Para que o orchestrator receba o metadata da conversa, ele já busca `conversation` do banco. Verificar se o SELECT existente inclui `metadata` — se não incluir, adicionar ao SELECT.

---

### 4.5 — Frontend: Hook do módulo

**Arquivo a criar:** `src/hooks/useOutboundCampaigns.tsx`

Seguir exatamente o padrão de `src/hooks/useCoworking.tsx`:

```typescript
// Exportar:
// useOutboundCampaignsModuleAvailable() → lê accounts.settings.outbound_campaigns_enabled
// useCampaigns() → lista campanhas da conta com Realtime
// useCreateCampaign() → cria campanha
// useUpdateCampaignStatus() → ativa / pausa / cancela
// useUploadCampaignContacts() → processa CSV e insere em campaign_contacts
```

---

### 4.6 — Frontend: Toggle no Super Admin

**Arquivo:** `src/components/admin/AdminAccounts.tsx`

**O que adicionar** (seguir padrão do toggleCoworkingModule):

```typescript
const toggleOutboundModule = async (account: AccountRow, enabled: boolean) => {
  const prev = accounts;
  setAccounts(prev.map(a => a.id === account.id
    ? { ...a, settings: { ...(a.settings || {}), outbound_campaigns_enabled: enabled } }
    : a
  ));
  const newSettings = { ...(account.settings || {}), outbound_campaigns_enabled: enabled };
  const { error } = await supabase.from("accounts").update({ settings: newSettings }).eq("id", account.id);
  if (error) {
    setAccounts(prev);
    toast.error("Falha ao atualizar módulo Campanhas");
  } else {
    toast.success(enabled ? "Módulo Campanhas liberado" : "Módulo Campanhas desabilitado");
  }
};
```

**Na listagem de contas** (ao lado do Switch do Coworking, mesmo padrão visual):
```tsx
{!a.is_internal && (
  <div className="flex items-center gap-2 px-2 border-l border-border/40" title="Liberar módulo Campanhas Outbound">
    <span className="text-[11px] text-muted-foreground">Campanhas</span>
    <Switch
      checked={!!a.settings?.outbound_campaigns_enabled}
      onCheckedChange={(v) => toggleOutboundModule(a, v)}
    />
  </div>
)}
```

---

### 4.7 — Frontend: Página do módulo (cliente)

**Arquivo a criar:** `src/pages/Campaigns.tsx` ou `src/components/campaigns/CampaignsDashboard.tsx`

**Rota a adicionar em `App.tsx`:** `/campaigns`

**Proteção de acesso (guard — verificar antes de renderizar):**
```typescript
const { available } = useOutboundCampaignsModuleAvailable();
if (!available) return <ModuleUnavailable moduleName="Campanhas Outbound" />;
```

**Seções da página:**

```
1. Header: "Campanhas Outbound" + botão "Nova Campanha"

2. Lista de campanhas:
   - Nome, status (badge colorido), contatos total/enviados/responderam
   - Botões: Ativar / Pausar / Ver detalhes

3. Modal "Nova Campanha":
   - Nome da campanha
   - Sessão WhatsApp (select — listar whatsapp_sessions da conta)
   - Mensagem de abertura (textarea)
   - Upload de PDF (opcional)
   - Limite diário (número, default: 50)
   - Delay entre envios em segundos (número, default: 45)
   - Upload CSV de contatos:
     - Formato esperado: coluna "phone" obrigatória, coluna "name" opcional
     - Preview dos primeiros 5 contatos antes de confirmar
     - Botão "Criar e importar contatos"

4. Detalhe da campanha:
   - Métricas: Pendentes / Enviados / Responderam / Opt-out / Convertidos
   - Tabela de contatos com status individual
   - Botão exportar CSV do resultado
```

---

### 4.8 — Prompt outbound (configuração no banco, não código)

**Não é código — é configuração.**

Quando criar o cliente no Super Admin, o `system_prompt_override` em `nina_settings` deve incluir um bloco `<outbound_protocol>` como este:

```
<outbound_protocol>
PROTOCOLO DE ABERTURA — PROSPECÇÃO ATIVA:

Quando o campo CONTEXTO DE ORIGEM indicar que este lead veio de campanha outbound:

1. RECONHEÇA que você iniciou o contato:
   "Oi, [nome]! Sou a Íris, da [empresa]. Te mandei uma mensagem porque acredito que o que fazemos pode ser relevante para você."

2. REFERENCIE o material enviado:
   "Enviei também um material sobre [tema do PDF] que pode te dar um panorama rápido."

3. FAÇA UMA pergunta aberta e consultiva:
   "Me conta: qual é o maior desafio que você enfrenta hoje com [área relevante]?"

4. GERENCIE opt-out com respeito imediato:
   Se o lead disser "não tenho interesse", "para de me mandar mensagem", "quem é você" de forma hostil:
   → Responda: "Tudo bem, [nome]! Não vou te incomodar mais. Qualquer dia que quiser conversar, é só chamar. 😊"
   → NÃO envie mais mensagens para esse lead.

5. Depois da abertura, siga o fluxo consultivo normal (descubra a dor → qualifique → agende).
</outbound_protocol>
```

---

## 5. Ordem de implementação recomendada

Execute nessa sequência para não quebrar nada:

```
Etapa 1 → Migration SQL (tabelas + RLS)
Etapa 2 → Edge Function campaign-dispatcher
Etapa 3 → Ajuste whatsapp-webhook (~25 linhas)
Etapa 4 → Ajuste nina-orchestrator (buildEnhancedPrompt + SELECT metadata)
Etapa 5 → Hook useOutboundCampaigns.tsx
Etapa 6 → Toggle no AdminAccounts.tsx
Etapa 7 → Página Campaigns.tsx + rota em App.tsx
Etapa 8 → Configurar prompt no banco para o cliente piloto
```

---

## 6. Arquivos que serão MODIFICADOS (não criados do zero)

| Arquivo | Tipo de mudança | Risco |
|---|---|---|
| `supabase/functions/whatsapp-webhook/index.ts` | Inserção de ~25 linhas após criação da conversa | Baixo |
| `supabase/functions/nina-orchestrator/index.ts` | Inserção de ~10 linhas em `buildEnhancedPrompt()` + verificar SELECT | Baixo |
| `src/components/admin/AdminAccounts.tsx` | Adicionar função + Switch (padrão idêntico ao Coworking) | Baixo |
| `src/App.tsx` | Adicionar rota `/campaigns` | Mínimo |

---

## 7. Arquivos que serão CRIADOS do zero

| Arquivo | Descrição |
|---|---|
| `supabase/migrations/[ts]_outbound_campaigns_module.sql` | Tabelas + RLS + triggers |
| `supabase/functions/campaign-dispatcher/index.ts` | Dispatcher principal |
| `supabase/functions/trigger-campaign-dispatcher/index.ts` | Trigger auxiliar (padrão do projeto) |
| `src/hooks/useOutboundCampaigns.tsx` | Hooks do módulo |
| `src/pages/Campaigns.tsx` | Página principal do módulo |
| `src/components/campaigns/CampaignsDashboard.tsx` | Componentes da UI |

---

## 8. Pontos de atenção para o Claude Code

### 8.1 Risco de ban — Evolution API não oficial
O `delay_seconds` padrão é 45 segundos. **Nunca deixar abaixo de 30.**  
O `daily_limit` padrão é 50. **Nunca deixar acima de 80 por número.**  
Adicionar validação no frontend que impeça valores fora desse range.

### 8.2 Opt-out obrigatório
Se `campaign_contacts.status = 'opted_out'`, o dispatcher **nunca** pode reprocessar esse número.  
O webhook deve detectar palavras-chave de opt-out ("para", "não quero", "remove", "sair") e atualizar o status automaticamente.

### 8.3 PDF enviado apenas se existir
O bloco de inserção do PDF na `send_queue` deve ser condicional:
```typescript
if (campaign.pdf_url) {
  // inserir registro document na send_queue
}
```

### 8.4 Metadata da conversa no orchestrator
Verificar se o SELECT de `conversations` no `nina-orchestrator` já inclui `metadata`.  
Buscar por: `from('conversations').select(...)` e confirmar se `metadata` está na lista.  
Se não estiver, adicionar ao SELECT.

### 8.5 Fuso horário dos disparos
O `campaign-dispatcher` deve verificar horário antes de processar.  
Disparar apenas entre **08h e 19h horário de Brasília (UTC-3)** para não incomodar fora do horário comercial.

---

## 9. Referências no código para o Claude Code consultar

| O que consultar | Onde encontrar |
|---|---|
| Padrão de toggle de módulo | `src/components/admin/AdminAccounts.tsx` → `toggleCoworkingModule` |
| Padrão de hook de módulo | `src/hooks/useCoworking.tsx` → `useCoworkingModuleAvailable` |
| Como inserir na send_queue | `supabase/functions/nina-orchestrator/index.ts` → linha ~881 (função `handleSendFile`) |
| Como o sender envia document | `supabase/functions/whatsapp-sender/index.ts` → `sendMessageEvolution` → case 'document' |
| Como o webhook cria contato e conversa | `supabase/functions/whatsapp-webhook/index.ts` → `handleEvolutionWebhook` → linha ~243 |
| Como o prompt é carregado | `supabase/functions/nina-orchestrator/index.ts` → linha ~312 (`system_prompt_override`) |
| Padrão de Edge Function trigger | `supabase/functions/trigger-nina-orchestrator/index.ts` |
| Estrutura de RLS existente | Qualquer migration recente em `supabase/migrations/` |
