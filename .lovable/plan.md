## Diagnóstico confirmado

Sim, entendi. A interface está trocando o **nome/workspace ativo**, mas várias telas continuam buscando dados sem filtrar pela **conta ativa**.

O que confirmei:

- A conta **DRM REPRESENTAÇÕES** tem no banco: `0 contatos`, `0 conversas`, `0 deals` e `6 etapas de pipeline`.
- A conta **AXHolding Internal** tem: `25 contatos`, `28 conversas`, `25 deals` e `6 etapas`.
- Mesmo assim, no print da DRM aparecem cards/deals da AXHolding. Isso bate com o código lido em `src/services/api.ts`:
  - `fetchPipeline()` busca `deals` sem `.eq('account_id', activeAccountId)`.
  - `fetchPipelineStages()` busca `pipeline_stages` sem `.eq('account_id', activeAccountId)`.
  - a busca de conversas relacionadas ao deal também não filtra por `account_id`.
- Também encontrei outros pontos do `api.ts` e `Contacts.tsx` com queries sem filtro explícito por conta, o que é perigoso para Super Admin porque ele enxerga mais de uma conta por permissão.

## Correção proposta

### 1. Blindar todas as buscas principais por `account_id`
Aplicar filtro explícito com `requireActiveAccountId()` nas telas/serviços principais:

- Dashboard
- Pipeline
- Etapas do pipeline
- Chat ao vivo/conversas
- Contatos
- Agendamentos
- Relatórios já parecem parcialmente corrigidos, mas vou revisar os pontos restantes
- Equipe/configurações quando houver consulta multi-tenant

Regra: **toda query de tabela com `account_id` deve filtrar pela conta ativa**, mesmo que o RLS já exista.

### 2. Corrigir especificamente o Pipeline
Em `src/services/api.ts`:

- `fetchPipeline()`:
  - usar `const accountId = requireActiveAccountId()`.
  - filtrar `deals.eq('account_id', accountId)`.
  - filtrar conversas dos contatos também com `.eq('account_id', accountId)`.
- `fetchPipelineStages()`:
  - filtrar `.eq('account_id', accountId)`.
- `createPipelineStage()`:
  - calcular posição apenas dentro da conta ativa.
- `updatePipelineStage()`, `deletePipelineStage()`, `reorderPipelineStages()`:
  - garantir que updates/deletes só atinjam registros da conta ativa.

### 3. Corrigir Contatos
Em `src/components/Contacts.tsx`:

- Listagem/exportação/importação precisam usar `account_id` da conta ativa.
- Exportação hoje lê contatos sem filtro explícito; vou corrigir para não exportar contatos de outra conta quando for Super Admin.

### 4. Corrigir módulos opcionais por conta
Além do vazamento de dados, corrigir o que você reportou antes:

- **Campanhas**: `useOutboundCampaignsModuleAvailable()` deve consultar `accounts` filtrando por `activeAccountId`, não `limit(1)`.
- **Coworking**: botão de ativação não pode aparecer em conta cliente se `coworking_module_available` não estiver liberado no Super Admin.
- **Follow-up**: criar gate real baseado em `settings.followup_enabled` da conta ativa e esconder opções/atalhos quando desligado.

### 5. Resetar estado visual quando trocar de conta
Em telas como Pipeline/Chat/Contatos, ao mudar de conta ativa:

- limpar estado local imediatamente;
- mostrar loading;
- buscar novamente com o novo `account_id`.

Isso evita a sensação de “mudou o nome, mas os dados ficaram da AXHolding”.

### 6. Validação pós-correção
Depois de implementar:

- Entrar como Super Admin na AXHolding e confirmar que dados da AXHolding aparecem normalmente.
- Acessar DRM via botão **Acessar** e confirmar:
  - Pipeline vazio ou apenas dados da DRM;
  - Chat sem conversas da AXHolding;
  - Contatos sem contatos da AXHolding;
  - Campanhas/Coworking/Follow-up ocultos/desativados se os toggles estiverem off.

## Resultado esperado

Quando você acessar a conta do cliente pelo Super Admin, a aplicação deve se comportar como se estivesse realmente dentro do workspace daquele cliente: **nome, dados, módulos, pipeline, chat, contatos, agenda e configurações todos isolados pela conta ativa**.
