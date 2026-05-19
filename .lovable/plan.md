## Recuperação de senha

### 1. Link "Esqueceu sua senha?" em `src/pages/Auth.tsx`
- Adicionar link abaixo do campo de senha (apenas no modo login) que abre um diálogo modal.
- O modal contém input de email + botão "Enviar link de recuperação".
- Ao enviar, chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${window.location.origin}/reset-password\` })`.
- Toast de sucesso ("Enviamos um link para seu email") e fecha modal.

### 2. Nova página `src/pages/ResetPassword.tsx` (rota `/reset-password`)
- Rota pública adicionada em `src/App.tsx`.
- Detecta sessão de recovery (Supabase processa o token do hash automaticamente via `onAuthStateChange` com evento `PASSWORD_RECOVERY`).
- Formulário com nova senha + confirmação (validação min 6 chars, igualdade).
- Chama `supabase.auth.updateUser({ password })`.
- Em sucesso: toast + redireciona para `/auth`.

### 3. Emails de recuperação
- Hoje o projeto usa os templates default do Lovable Cloud, então o email de recuperação já é enviado automaticamente — não precisa configurar domínio nem template para funcionar.
- Se desejar branding AXHUB no email, posso depois configurar domínio próprio + template customizado (passo opcional, não incluso neste plano).

### Arquivos
- editar: `src/pages/Auth.tsx`, `src/App.tsx`
- criar: `src/pages/ResetPassword.tsx`
