# Impedir que a IA continue respondendo depois que o humano assume

## O que os dados mostram

Na conta Pró Animais, a IA quebra a resposta em várias mensagens e as enfileira com atrasos escalonados (`message_breaking_enabled = true`). Exemplo real: 3 mensagens da IA criadas na fila às 17:46:33 e só entregues às 17:50 — quase 4 minutos depois.

Nesse intervalo o atendente pode assumir a conversa (`status = 'human'`), mas:

- `whatsapp-sender` não verifica o status da conversa antes de enviar; ele só olha a fila (`send_queue`) e dispara o que está pendente.
- Trocar para humano não cancela nada: os itens já enfileirados em `send_queue` e os itens pendentes em `nina_processing_queue` continuam válidos.

O `nina-orchestrator` já checa `status !== 'nina'` antes de gerar, então o problema não é a geração — é o que já estava na fila (ou entrou nela segundos antes da troca) e sai depois.

Observação: não existe hoje nenhum registro de quando cada conversa passou para humano (`whatsapp_transfer_logs` e `audit_logs` estão vazios para essas conversas), então a correlação exata de horário não pode ser provada. O plano trata a causa e passa a registrar a troca para conferência futura.

## O que será feito

1. **Bloqueio no envio (`whatsapp-sender`)**
   Antes de enviar cada item da fila, ler o status da conversa. Se o item for da IA (`from_type = 'nina'`) e a conversa não estiver mais em `nina`, o item é descartado (marcado como cancelado com motivo `conversation_taken_over`) em vez de enviado. Mensagens enviadas pelo humano continuam passando normalmente.

2. **Cancelamento imediato ao assumir a conversa**
   Trigger no banco em `conversations`: quando o status sai de `nina` para `human` ou `paused`, cancelar na mesma hora:
   - itens pendentes/agendados de `send_queue` daquela conversa com `from_type = 'nina'`;
   - itens pendentes de `nina_processing_queue` daquela conversa (inclusive os adiados por horário de atendimento).
   Assim o corte é atômico e vale para qualquer origem (painel, edge function, transferência).

3. **Rastro da troca**
   Registrar em `audit_logs` a mudança de status da conversa (de/para, quem fez, quando), para poder auditar reclamações desse tipo sem adivinhação.

4. **Deploy e verificação**
   Deploy de `whatsapp-sender` e teste prático: enfileirar resposta da IA, assumir a conversa antes do envio e confirmar que nenhuma mensagem da IA sai.

## Detalhes técnicos

- `send_queue` usa o enum `queue_status`; itens cancelados ficam como `failed` com `error_message = 'conversation_taken_over'` para não poluir o contador de enviados.
- A trigger roda com `security definer` e `search_path = public`, sem tocar em schemas gerenciados.
- Isolamento por conta preservado: todas as operações usam `account_id` da própria conversa.
- Nenhuma mudança no comportamento de horário de atendimento já implementado.
