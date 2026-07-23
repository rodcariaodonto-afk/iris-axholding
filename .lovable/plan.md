## 1) Confirmação sobre o Ricardo

Confirmado: `rico@axhub.com.br` já existia como usuário desde 13/03/2026, com último login em 26/05/2026, e já estava vinculado à conta **AXHolding Internal** com `role = admin`. Como no nosso modelo "Super Admin" = ser `owner`/`admin` de uma conta interna, ele já era Super Admin — não precisava de usuário novo nem de senha nova.

**Ação:** manter a senha atual dele (a que ele já usava). A senha temporária que gerei antes deve ser descartada — não vou precisar redefinir nada; ele entra normalmente com a senha que ele já tinha. Se ele não lembrar, aí sim ele mesmo pede "esqueci senha" no login e recebe reset por e-mail (fluxo normal, sem intervenção manual).

## 2) Garantir que toda conta cliente nova nasça "zerada" e isolada

Vou reforçar o fluxo de criação de conta cliente para que nunca mais apareça dado de outra conta no ambiente do cliente novo.

### Diagnóstico
- RLS das tabelas sensíveis (`contacts`, `conversations`, `messages`, `deals`, `appointments`, `nina_settings`, `pipeline_stages`) já filtra corretamente por `account_id` + `is_super_admin()`. Ou seja, um usuário **cliente** logado só vê dados da conta dele; quem vê "tudo" é só Super Admin.
- O que falta hoje na função `super-admin-create-client`: ela só cria o registro em `accounts` + convite. Não inicializa `nina_settings`, `pipeline_stages`, e não garante que o convidado, ao aceitar, tenha profile criado e ambiente pronto. Foi por isso que na Vila do Corpo tive que rodar coisas manualmente.
- Do lado do Super Admin, o vazamento visual que você viu antes já foi corrigido (fetchConversations e useCompanySettings passaram a usar `activeAccountId`). Vou revisar rapidamente as demais queries de leitura para garantir o mesmo padrão em todo lugar que o Super Admin transita entre contas.

### O que vou implementar

**A. Edge Function `super-admin-create-client` (bootstrap completo da conta):**
Ao criar a conta, na mesma transação lógica, provisionar:
1. `nina_settings` inicial (linha em branco, `is_active = false`, com `account_id`).
2. `pipeline_stages` padrão (6 estágios: Novo Lead, Qualificação, Proposta, Negociação, Fechado Ganho, Fechado Perdido) já com `account_id` correto.
3. `whatsapp_account_settings` inicial vazio (para o onboarding do WhatsApp já ter o container).
4. Marcar `accounts.settings.onboarding_pending = true` para o cliente ver o wizard de setup no primeiro login.
5. Nada de contatos, mensagens, conversas, deals ou agendamentos — a conta nasce **zero**.

**B. Fluxo de aceite de convite (`accept-account-invite` ou equivalente):**
- Ao aceitar o convite, garantir que exista `profiles` do usuário aceitante.
- Vincular como `owner` na `account_members` da nova conta.
- Definir `activeAccountId = nova conta` no primeiro login.

**C. Auditoria rápida de queries no frontend (proteção extra contra futuras regressões):**
Percorrer os pontos listados abaixo e garantir `.eq('account_id', activeAccountId)` em cada leitura — mesmo com RLS ativa, isso protege o Super Admin ao trocar de conta:
- `src/services/reports.ts` (relatórios agregados)
- `src/services/api.ts` (deals, appointments, pipeline, conversations)
- `src/components/Contacts.tsx`, `CreateDealModal.tsx`, `ChatInterface.tsx`
- `src/hooks/useConversations.ts`, `useOnboardingStatus.ts`, `useCompanySettings.tsx`
- `src/components/OnboardingWizard.tsx`, `src/components/account/governance/GovernanceConsents.tsx`

Onde já usa `requireActiveAccountId()`, não mexo. Onde não usa, adiciono.

**D. Teste de aceitação:**
- Criar uma conta cliente de teste via Super Admin.
- Logar como o convidado.
- Verificar que Chat, Contatos, Pipeline, Agenda e Relatórios aparecem **completamente vazios**, e que o Onboarding aparece pedindo para configurar WhatsApp / Perfil / Pipeline.

### Detalhes técnicos
- Todo o bootstrap roda com `service_role` dentro da edge function, então RLS não bloqueia os inserts iniciais.
- Nenhuma alteração de schema é necessária (as tabelas e RLS já suportam multi-tenant).
- O checklist de "conta zerada" fica documentado na função para que qualquer futura mudança preserve o comportamento.

### Fora de escopo
- Não vou mexer em RLS existente.
- Não vou mexer em senha do Ricardo.
- Não vou alterar as contas já existentes (Vila do Corpo, AXHolding) — só o fluxo para clientes futuros.