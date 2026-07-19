## Objetivo
Pausar temporariamente a conta **Vila do Corpo** (`fbb1ad4b-7d44-4994-842a-b091fc33dcf0`) para parar de consumir Cloud/IA, sem apagar nenhum dado. Reversível a qualquer momento.

## O que vou fazer

1. **Suspender a conta**
   - `accounts.status = 'suspended'` para Vila do Corpo.
   - Isso bloqueia login dos usuários dessa conta e impede novas mutações.

2. **Desligar a IA (Nina) da Vila do Corpo**
   - `nina_settings` da conta: `is_active = false`, `auto_response_enabled = false`.
   - Garante que nenhuma mensagem recebida via webhook consuma IA / AI Gateway.

3. **Pausar campanhas outbound da conta**
   - `outbound_campaigns.status = 'paused'` para as campanhas ativas da Vila do Corpo.
   - Evita que o cron `trigger-campaign-dispatcher` continue disparando mensagens dessa conta.

4. **Congelar a fila de envio pendente da conta**
   - `send_queue` da Vila do Corpo com status `pending`/`processing` → `status = 'paused'` (ou similar já suportado).
   - Impede que o `whatsapp-sender` (cron por minuto) processe itens dessa conta enquanto suspensa.

## O que NÃO será feito
- **Nenhum dado é apagado** (contatos, conversas, mensagens, deals, agendamentos permanecem intactos).
- Não mexo em outras contas (AXHolding Internal e demais seguem normais).
- Não removo integrações (WhatsApp/Meta), só desativo o processamento.
- Não mexo nos crons globais — eles continuam rodando para as outras contas.

## Como reativar depois
Quando você quiser voltar a Vila do Corpo, executo o inverso em uma única migração:
- `accounts.status = 'active'`
- `nina_settings.is_active = true`, `auto_response_enabled = true`
- Campanhas voltam para `active` (as que você escolher)
- `send_queue` volta os itens de `paused` para `pending`

## Detalhes técnicos
Tudo será feito em **uma migração SQL** com `UPDATE` escopado por `account_id = 'fbb1ad4b-7d44-4994-842a-b091fc33dcf0'`. Sem alterações de código no frontend/edge functions. Sem risco para as outras contas.

Confirma que posso aplicar?
