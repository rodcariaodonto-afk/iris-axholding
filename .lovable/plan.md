# Isolamento total por cliente: arquivos e IA

## O que está acontecendo (verificado)

1. **Arquivos (Biblioteca)** — as regras de segurança do banco estão corretas: cada arquivo tem `account_id` e as políticas só liberam leitura para membros da própria conta. Hoje existem 8 arquivos da AXHolding e 3 da R R Holding, nenhum "solto". **Porém** a tela de Configurações > Arquivos busca a lista **sem filtrar pela conta ativa**. Para um usuário comum isso é barrado pelo banco, mas para quem é super admin (ou está com conta ativa trocada/impersonando) a tela mostra os arquivos de todas as contas — foi isso que você viu.

2. **IA pegando coisas de outro cliente** — este é o erro real e grave. As funções da IA usam uma cadeia de fallback ao carregar as configurações do agente: conta → usuário → "global" → **"qualquer configuração existente" (`limit 1`)**. Se por qualquer motivo a conversa não resolver a conta (sessão sem vínculo, conversa antiga sem `account_id`), a IA carrega a configuração de **outro cliente** — nome, prompt, credenciais. Além disso, todas as 5 contas têm `user_id` nulo, então o passo "global" também pode devolver a linha de outra conta.

Cadeia atual (perigosa):

```text
conta -> usuário -> global(user_id null) -> QUALQUER LINHA (limit 1)
                                            ^ vazamento entre clientes
```

## Correção proposta

### 1. Eliminar fallback entre contas na IA
Nas funções `nina-orchestrator`, `message-grouper` e `whatsapp-sender`:
- Buscar as configurações **somente** por `account_id` (e credenciais da sessão WhatsApp da mesma conta).
- Remover os passos "global" e "qualquer configuração existente".
- Se a conta não for resolvida: **não responder**, marcar o item da fila como erro com mensagem clara (`account_not_resolved`) e registrar log. Nada de responder com a persona de outro cliente.

### 2. Escopo de conta na busca de arquivos da IA
Tornar `account_id` obrigatório em `sendFileFromLibrary`: sem conta, nenhum arquivo é buscado nem enviado (hoje, sem conta, a busca roda sem filtro).

### 3. Tela de Arquivos filtrada pela conta ativa
Em Configurações > Arquivos: filtrar a listagem por `account_id` da conta ativa e recarregar ao trocar de conta. Assim, mesmo super admin vê apenas os arquivos da conta em que está.

### 4. Auditoria de dados
Verificar e reportar registros sem vínculo de conta que possam cair no fallback:
- conversas/sessões sem `account_id` ou apontando para sessão de outra conta;
- contas ativas sem linha em `nina_settings` (que hoje herdariam a configuração de outro cliente).
Corrigir os vínculos encontrados; criar configuração própria para contas que estiverem sem.

### 5. Trava no banco
Adicionar validação para impedir que `send_queue`, `messages` e `conversations` recebam registros cuja conversa/sessão pertença a outra conta (checagem de consistência de `account_id`), evitando reincidência por qualquer caminho novo.

## Detalhes técnicos

Arquivos afetados:
- `supabase/functions/nina-orchestrator/index.ts` (linhas ~193-295 da cadeia de settings; `sendFileFromLibrary` ~855-875)
- `supabase/functions/message-grouper/index.ts` (~105-130)
- `supabase/functions/whatsapp-sender/index.ts` (`getSettings`, ~150-180)
- `src/components/settings/MediaLibrary.tsx` (fetch sem filtro de conta)
- Uma migração de banco para o gatilho de consistência de `account_id`

Não altera prompts, nem o comportamento da IA quando a conta está corretamente resolvida.
