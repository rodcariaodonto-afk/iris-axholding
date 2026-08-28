# RR Holding: IA não responde — diagnóstico e correção

## O que eu verifiquei agora (dados reais)

- Sessão "Aline iA" da RR Holding: `connected`, saúde `healthy`, instância `iris-de65f931-fa1d5082-bf5fb625`. Conexão OK.
- O webhook **está recebendo eventos hoje** (09:46 UTC / 06:46 BRT), porém todos os eventos de hoje são de **grupo** (`@g.us`), que o sistema ignora por regra. Nenhuma mensagem individual entrou hoje.
- Última mensagem individual de cliente: **27/08 às 14:32 BRT**. A IA respondeu normalmente até 14:12 BRT desse dia.
- A conversa mais ativa (contato do Maico) está com status **`human`**. Nesse estado a IA fica calada por regra — foi exatamente aí que o cliente escreveu 14:29/14:32 e não recebeu resposta.
- Hoje existem **8 conversas em `human`** e 51 em `nina` nessa conta. Nenhuma volta sozinha para IA.
- Não há registro de auditoria de quem trocou o status das conversas (a auditoria de troca IA↔humano não está ativa).
- Alerta de segurança encontrado no caminho: o webhook aceita POST sem verificação porque `EVOLUTION_WEBHOOK_SECRET` não está configurado.

Conclusão provável (ainda não confirmada por teste ponta a ponta): a IA não está "quebrada" — as conversas em que o cliente reclama estão em modo humano/pausado, e por isso a Aline não responde. Precisa de um teste real para fechar o diagnóstico.

## Plano

1. **Confirmar com teste ponta a ponta** — enviar uma mensagem individual (não de grupo) para o número da RR Holding e acompanhar: chegada no webhook → agrupamento → fila da IA → resposta enviada. Isso separa definitivamente "IA quebrada" de "conversa em modo humano".
2. **Se o teste responder normalmente**: devolver as conversas travadas em `human` para o modo IA (com confirmação sua sobre quais) e implementar retorno automático:
   - Voltar a conversa para IA após X horas sem interação humana (padrão sugerido: 12h), configurável por conta.
   - Mostrar no painel um aviso claro de "Conversa em atendimento humano — IA pausada" para o operador saber por que a Aline parou.
3. **Se o teste não responder**: seguir o rastro no ponto onde parar (webhook, message-grouper, orquestrador ou fila de envio) e corrigir o elo com falha.
4. **Auditoria de troca de status** — registrar em `audit_logs` toda mudança IA↔humano (quem, quando, qual conversa), para não voltarmos a depender de suposição.
5. **Fechar a brecha do webhook** — configurar `EVOLUTION_WEBHOOK_SECRET` e passar a validar a assinatura nos eventos da Evolution.

## Detalhes técnicos

- Retorno automático: campo novo em `nina_settings` (ex.: `human_takeover_timeout_hours`) + verificação no `evolution-session-monitor` (já roda a cada 5 min) devolvendo `conversations.status` para `nina` quando expirar.
- Auditoria: trigger `AFTER UPDATE OF status ON public.conversations` gravando em `audit_logs` com `account_id`, conversa, status anterior/novo e ator.
- Sem mudanças em prompts, isolamento por conta ou RLS.

## Decisão necessária

Confirme se posso: (a) devolver automaticamente para IA as conversas paradas há mais de 12h em modo humano, e (b) qual número usar para o teste ponta a ponta na instância da RR Holding.
