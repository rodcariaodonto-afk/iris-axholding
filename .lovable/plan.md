## Objetivo
Adicionar **Ricardo Bahls (rico@axhub.com.br)** como Super Admin global, com acesso equivalente ao seu (caria@axhub.com.br).

## Como funciona o Super Admin neste sistema
Não é um cargo separado — é derivado automaticamente por esta regra na função `is_super_admin()`:

> "É super admin quem é `owner` ou `admin` de uma conta marcada como `is_internal = true`."

A conta **AXHolding Internal** já tem `is_internal = true`. Basta o Ricardo ser membro `admin` dela.

## Passos

1. **Criar o usuário no Auth** (via admin API, e-mail já confirmado)
   - Email: `rico@axhub.com.br`
   - Senha temporária gerada (te entrego no chat, só para você — ele deve trocar no primeiro login)
   - Nome no perfil: "Ricardo Bahls"

2. **Criar o `profile`** correspondente (linha em `public.profiles`).

3. **Vincular como admin da AXHolding Internal**
   - Insert em `public.account_members` com `role = 'admin'`, `status = 'active'`.
   - Isso automaticamente ativa `is_super_admin() = true` para ele — libera o painel `/admin`, criação de clientes, gestão de planos etc.

4. **Confirmar acesso** rodando `is_super_admin()` no contexto dele.

## O que ele vai poder fazer
- Ver e gerenciar todas as contas (inclusive Vila do Corpo, futuros clientes)
- Criar novos clientes (Super Admin → Contas → Nova conta)
- Ativar/desativar módulos (Coworking, Campanhas Outbound)
- Alterar planos, suspender contas, ver auditoria global

## O que ele **não** vai poder fazer
- Acessar o **Lovable Cloud/billing** — isso é acesso ao workspace Lovable, separado. Se quiser que ele também administre infra/custos, precisamos convidá-lo pelo Lovable (Settings → People no workspace). Me diga se quer que eu te oriente isso também.

## Entrega
Depois de aplicado, te devolvo aqui no chat:
- E-mail: rico@axhub.com.br
- Senha temporária: (gerada na hora)
- URL de login: https://iris.axholding.com.br/auth
