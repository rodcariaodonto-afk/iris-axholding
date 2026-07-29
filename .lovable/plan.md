## Diagnóstico (verificado)

Não existe nenhuma validação de "e-mail corporativo" no frontend nem na edge function — o rótulo "Email Corporativo" é só texto. O erro vem do banco:

- `public.team_members` tem a constraint **`team_members_email_key: UNIQUE (email)` global** (não por conta). Se aquele Gmail já foi usado em qualquer outra conta (ex.: contas antigas/testes), o cadastro quebra.
- Em `supabase/functions/create-team-user/index.ts` a busca de membro existente é feita **sem filtro por `account_id`** (`.eq("email", email).maybeSingle()`), então ela pode encontrar/alterar um registro de outra conta — vazamento multi-tenant além do erro.
- O `catch` da função devolve sempre `"Erro interno do servidor"`, por isso a tela mostra um erro genérico sem dizer a causa real.

## O que fazer

1. **Migração no banco**
   - Remover `team_members_email_key` (UNIQUE global).
   - Criar `UNIQUE (account_id, email)` — mesmo padrão já aplicado em `contacts (account_id, phone_number)`.

2. **Corrigir `create-team-user`**
   - Buscar membro existente com `.eq("account_id", account_id).eq("email", email)`.
   - Se o e-mail já existir em outra conta, criar um novo `team_members` na conta atual reaproveitando o mesmo `user_id` do auth (o mesmo usuário pode pertencer a mais de uma empresa).
   - Retornar mensagens de erro claras (ex.: "Este e-mail já é membro desta conta") em vez do 500 genérico, sem expor dados internos.

3. **UI (`src/components/Team.tsx`)**
   - Trocar o rótulo "Email Corporativo" por "E-mail" e o placeholder para algo neutro (`nome@email.com`), deixando explícito que qualquer provedor é aceito.

## Detalhes técnicos

Nenhuma mudança em RLS/GRANTs é necessária. A migração precisa ser verificada antes: se já houver e-mails duplicados entre contas, o índice composto ainda passa (duplicidade só é bloqueada dentro da mesma conta).
