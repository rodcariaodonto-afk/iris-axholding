# Respeitar horário de atendimento por cliente

## O problema (confirmado)

As configurações de horário (`business_hours_start`, `business_hours_end`, `business_days`, `timezone`) são salvas por conta em `nina_settings`, mas **nenhuma parte do motor de IA as lê**. O `nina-orchestrator` só considera `is_active`, `auto_response_enabled`, delays e modelo — por isso a agente responde a qualquer hora, em qualquer dia.

Além disso, follow-ups e campanhas usam janela fixa 08:00–19:00 seg–sex escrita no código, ignorando o que cada cliente configurou.

## Comportamento definido

- Mensagem recebida fora do horário: nada é enviado na hora. A mensagem fica pendente e a IA responde automaticamente na abertura do próximo dia/horário útil daquele cliente.
- Conversas em atendimento humano não são afetadas — o time responde quando quiser.
- Follow-ups e campanhas outbound passam a usar o horário/dias configurados em cada conta (não mais 08:00–19:00 fixo).

## O que será feito

1. **Utilitário de horário comercial compartilhado**
   Novo módulo em `supabase/functions/_shared/business-hours.ts` com:
   - `isWithinBusinessHours(settings, now)` — avalia dia da semana e faixa de horário no fuso da conta.
   - `nextOpeningAt(settings, now)` — calcula o próximo instante de abertura (mesmo dia mais tarde, ou próximo dia útil no horário de início), com limite de busca de 14 dias.
   - Fuso via `Intl.DateTimeFormat` com o `timezone` da conta (padrão `America/Sao_Paulo`); se a conta não tiver horário configurado, o comportamento atual (sempre responder) é mantido.

2. **`nina-orchestrator`: adiar em vez de responder**
   Após resolver `effectiveSettings` (e antes de `processQueueItem`), se estiver fora do horário da conta: devolver o item da fila para `status = 'pending'` com `scheduled_for = nextOpeningAt(...)` e registrar o motivo. A função `claim_nina_processing_batch` já ignora itens com `scheduled_for` no futuro, então a resposta sai sozinha na abertura, sem cron extra.
   Mensagens de follow-up sintéticas fora do horário são adiadas do mesmo jeito.

3. **`followup-dispatcher`: horário por conta**
   Remover o teste global de hora UTC; para cada conta processada, checar `isWithinBusinessHours` com os settings daquela conta e pular quem estiver fechado.

4. **`campaign-dispatcher`: horário por conta**
   Mesma troca: em vez de barrar a execução inteira por hora UTC, avaliar por campanha/conta. O `scheduled_at` dos envios continua respeitando o `delay_seconds`, mas nenhuma campanha é enfileirada fora da janela da sua conta.

5. **Transparência na UI (pequeno ajuste)**
   Em `src/components/settings/AgentSettings.tsx`, texto de apoio no bloco de horários deixando claro que fora da janela a IA não responde na hora e responde na próxima abertura.

## Detalhes técnicos

- Sem mudanças de schema: `nina_processing_queue.scheduled_for` já existe e é respeitada pelo claim.
- Isolamento por conta preservado: os settings continuam sendo lidos por `account_id` da conversa; nenhum fallback global é introduzido.
- Conversas com `status = 'human'` já não entram no orquestrador, então nenhum bloqueio novo atinge o atendimento humano.
- Deploy das funções `nina-orchestrator`, `followup-dispatcher` e `campaign-dispatcher` após as alterações.
