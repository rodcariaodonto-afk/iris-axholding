## Atualizar planos (Starter, Pro, Business, Enterprise)

### Nova estrutura

| Plano | Preço/mês | Usuários | WhatsApp | Contatos | Mensagens |
|---|---|---|---|---|---|
| Starter | R$ 120 | 1 | 1 | ilimitado | ilimitado |
| Pro | R$ 297 | 5 | 5 | ilimitado | ilimitado |
| Business | R$ 997 | 30 | 30 | ilimitado | ilimitado |
| Enterprise | sob consulta | ilimitado | ilimitado | ilimitado | ilimitado |

Setup único de R$ 2.500 continua valendo para qualquer plano.

### Mudanças

**1. Banco de dados (`account_plans`)** — UPDATE nas 4 linhas:
- `starter`: price=120, max_users=1, max_whatsapp_numbers=1, max_contacts=999999, max_messages_month=999999
- `pro`: price=297, max_users=5, max_whatsapp_numbers=5, max_contacts=999999, max_messages_month=999999
- `business`: price=997, max_users=30, max_whatsapp_numbers=30, max_contacts=999999, max_messages_month=999999
- `enterprise`: price=0 (sob consulta), todos limites = 999999

**2. Landing page — `PricingSection.tsx`**
Reestruturar para mostrar:
- Bloco superior: Setup único R$ 2.500 (mantém checklist atual)
- Grid abaixo com 4 cards de planos mensais (Starter R$120, Pro R$297, Business R$997, Enterprise sob consulta), destacando usuários + sessões WhatsApp + recursos ilimitados
- Atualizar `WPP_URL` para mensagem genérica de interesse nos planos

**3. FAQ — `FaqSection.tsx`**
Revisar pergunta sobre "setup R$ 2.500" e adicionar/atualizar resposta para refletir os 3 planos mensais + setup único.

**4. AccountPlan.tsx (área logada)**
Já lê dinamicamente de `account_plans`, então não precisa de mudança de código — só refletirá os novos limites/preços automaticamente. Os bars de "ilimitado" vão usar o threshold `>= 999999` (que já está implementado e mostra "∞").

### Não muda
- `super-admin-create-client` (continua aceitando qualquer plan)
- Lógica de gating por limites (já lê de `account_plans`)
- Setup R$ 2.500 (texto e processo permanecem iguais)
