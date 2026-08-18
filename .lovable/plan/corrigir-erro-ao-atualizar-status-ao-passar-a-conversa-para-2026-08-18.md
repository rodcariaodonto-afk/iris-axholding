# Corrigir "Erro ao atualizar status" ao passar a conversa para humano

## Causa (verificada)

A trava de isolamento entre contas criada ontem (`enforce_account_consistency`) foi aplicada também na tabela `conversations`, mas a função lê o campo `conversation_id` da linha. A tabela `conversations` não tem essa coluna (verificado no schema: só existe `id`, `session_id`, `account_id`, ...). Resultado: **qualquer** INSERT/UPDATE em `conversations` falha no banco, inclusive a troca de status IA → Humano — daí o toast "Erro ao atualizar status".

As tabelas `messages`, `send_queue` e `nina_processing_queue` têm as três colunas e continuam funcionando normalmente.

## Correção

1. Reescrever `enforce_account_consistency()` para ler os campos de forma segura (via `to_jsonb(NEW)`), ignorando colunas que não existem na tabela em questão. Assim a mesma função serve para as quatro tabelas sem quebrar.
2. Manter as validações de isolamento intactas:
   - se houver `conversation_id`, o `account_id` deve bater com o da conversa;
   - se houver `session_id`, o `account_id` deve bater com o da sessão de WhatsApp.
3. Em `conversations`, a checagem passa a ser apenas contra a sessão vinculada (comportamento pretendido originalmente).
4. Verificar após a migração: atualizar o status de uma conversa real e confirmar que grava sem erro, e confirmar que uma gravação cruzada entre contas continua sendo bloqueada.

## Detalhes técnicos

- Uma migração SQL substituindo a função `public.enforce_account_consistency()` (SECURITY DEFINER, `search_path = public`), mantendo os triggers existentes.
- Nenhuma mudança de frontend necessária; `src/services/api.ts` e `useConversations.ts` já filtram por conta corretamente.
