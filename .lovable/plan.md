## Fase 4 — Governança de Dados B2B

Camada de governança sobre o multi-tenant: exportação controlada, retenção/exclusão auditada, DSAR, consentimentos, conformidade e auditoria expandida. Mantém o que já existe da Fase 3 e fecha as lacunas para venda B2B.

### O que já existe e será preservado
- `audit_logs` básico + triggers em `account_members` e `accounts` → vamos **expandir** schema (event_type, severity, ip, user_agent, old/new values).
- `account-export` (síncrono) → vira **assíncrono** com tracking em `data_exports`.
- `account-cancel` (seta `cancelled_at`/`delete_after`) → integra com novo fluxo de retenção/aprovação.
- `/account/audit` e `/account/security` → migram para nova área `/account/governance/*`.
- `/admin/audit` → ganha visão global de governança.

### Novas tabelas (todas com RLS rigoroso por `account_id`)

**`data_exports`** — fila de exportações
`id, account_id, requested_by, status (pending|processing|completed|failed|expired), format (json), scope (jsonb: módulos incluídos), file_path, file_size, download_count, expires_at (7d), created_at, completed_at, error_message, metadata`

**`data_deletion_requests`** — pedidos de exclusão controlados
`id, account_id, requested_by, request_type (account|contact|message|custom), status (pending|approved|scheduled|completed|cancelled|failed), reason, scope (jsonb), scheduled_for, approved_by, approved_at, completed_at, error_message, metadata`

**`data_subject_requests` (DSAR)** — pedidos LGPD/GDPR dos titulares
`id, account_id, requester_name, requester_email, requester_phone, request_type (access|rectification|portability|erasure|anonymization|consent_revocation|opposition), related_contact_id, status (open|in_progress|resolved|rejected|expired), priority, description, assigned_to, due_at (15d default), resolved_at, resolution_notes, created_by, created_at`

**`account_policies`** — políticas configuráveis por conta
`account_id (PK), retention_days_after_cancel (default 30), audit_retention_days (default 365), require_dsar_approval, default_legal_basis, dpo_email, privacy_policy_url, terms_url, updated_at, updated_by`

**`governance_notifications`** — notificações internas
`id, account_id, user_id (nullable=todos owners/admins), type, severity, title, body, link, read_at, created_at`

### Tabelas existentes — extensões

**`audit_logs`** — adicionar `event_type, entity_type, entity_id, severity (info|warn|critical), ip_address, user_agent, old_values jsonb, new_values jsonb`. Manter colunas antigas.

**`accounts`** — adicionar `retention_until, deletion_scheduled_at, deleted_at, deletion_status (none|pending|scheduled|completed), deletion_reason`. Já tem `cancelled_at` e `delete_after` (este vira sinônimo de `retention_until`).

**`contacts`** — campos de consentimento: `consent_status (granted|revoked|unknown), consent_source, consent_given_at, consent_revoked_at, legal_basis (consent|contract|legitimate_interest|legal_obligation), privacy_notes, data_origin, data_classification (public|internal|confidential|restricted, default internal)`.

**`media_library` e `messages`** — `data_classification` (default `internal`).

### Edge Functions novas (todas validam JWT + membership + papel + account_id)

- **`account-export`** (refactor) — cria registro em `data_exports`, processa em background, gera ZIP/JSON com módulos: `accounts, account_members, contacts, conversations, messages, deals, appointments, pipeline_stages, teams, team_members, team_functions, tag_definitions, media_library (metadados), nina_settings (sem chaves), audit_logs (90d), data_subject_requests`. Exclui binários grandes (áudio/mídia) — só metadados/URLs. Sobe para `account-exports/{account_id}/{export_id}.json`, signed URL 7d. Audita evento `data.exported`.
- **`account-deletion-request`** — cria `data_deletion_requests` com `scheduled_for = now()+30d`, audita `deletion.requested`. Owner-only.
- **`account-deletion-approve`** — Owner ou super-admin AXHolding aprova/cancela request. Audita `deletion.approved`.
- **`account-reactivate`** — durante janela de retenção, owner pode reverter cancelamento. Limpa `cancelled_at, delete_after, deletion_*`.
- **`account-purge`** (cron diário) — apaga contas com `delete_after < now()` e `deletion_status='scheduled'`. Anonimiza ou hard-delete conforme `account_policies`.
- **`compliance-report`** — gera JSON com checklist: RLS ativo, exports nos últimos 90d, DSAR pendentes, integrações ativas, eventos críticos 30d, usuários inativos 90d, papéis elevados, riscos.
- **`dsar-create`** — endpoint público (verify_jwt=false) para titulares submeterem pedido. Validação rigorosa (email, captcha futuro, rate limit). Notifica owners/admins.

### UI — nova área `/account/governance/*`

Substitui `/account/audit` e absorve as ações sensíveis hoje em `/account/security`. Acesso só Owner/Admin. Layout com sub-tabs:

1. **Visão Geral** (`/governance/overview`) — cards de status: retenção configurada, última exportação, pedidos DSAR abertos, eventos críticos 30d, riscos pendentes. Estado vazio profissional (sem dados fictícios).
2. **Exportações** (`/governance/exports`) — botão "Solicitar exportação" + tabela das exportações com status, tamanho, expires_at e link de download. Owner/Admin.
3. **Auditoria** (`/governance/audit`) — substitui página atual. Filtros: período, ator, event_type, severity, entity_type. Paginação.
4. **Retenção e Exclusão** (`/governance/retention`) — política de retenção da conta, fila de `data_deletion_requests`, botão "Cancelar conta" (owner) com confirmação dupla, botão "Reativar" durante janela.
5. **Conformidade** (`/governance/compliance`) — relatório vivo com bullets verdes/amarelos/vermelhos + botão "Exportar relatório (JSON)".
6. **Pedidos dos Titulares** (`/governance/dsar`) — kanban simples (open/in_progress/resolved) + criação manual + atribuição. Mostra prazo (15d).
7. **Consentimentos** (`/governance/consents`) — lista de contatos com filtros por `consent_status`, `legal_basis`, `data_origin`. Bulk actions: revogar consentimento, marcar base legal.
8. **Políticas** (`/governance/policies`) — formulário para `account_policies` (retenção, DPO, links de privacidade).

`/account/security` mantém só **trocar senha** + atalho "Ver Governança".

### Admin AXHolding — `/admin/governance`
Nova rota visível só para super-admin:
- Tabela global de contas com `cancelled_at`, dias até purga, exportações totais, DSAR abertas, eventos críticos.
- Aprovação de exclusões cross-account.
- Audit logs agregados com filtros.

### Aplicação dos campos de classificação e consentimento
- `Contacts.tsx` ganha indicadores visuais de `consent_status` e badge de `data_classification`.
- Modal de detalhe de contato ganha aba "Privacidade" com campos editáveis (admin/manager+).
- Export filtra `restricted` se solicitante não for owner/admin.

### Notificações
- Componente `GovernanceNotificationBell` no header (owner/admin) listando `governance_notifications` da conta. Realtime via Supabase channel.
- Disparadas por: export concluído/falho, DSAR criado, deletion agendada, retenção próxima do fim (7d antes), permissão sensível alterada.

### Detalhes técnicos críticos
- Migration única com: novas tabelas, RLS, índices, extensões em `audit_logs`/`accounts`/`contacts`, função `log_audit_v2(account_id, event_type, severity, entity_type, entity_id, action, old, new, metadata)`.
- Triggers novos: `contacts` (UPDATE de consent → audit), `nina_settings` (UPDATE → audit), `account_policies` (UPDATE → audit critical), `account_members` já existe (vamos adicionar severity).
- Bucket `account-exports` já existe; criar bucket `compliance-reports` privado.
- `cron.schedule('account-purge-daily', '0 3 * * *', ...)` apontando para edge function.
- Rate limit em `dsar-create` via tabela `dsar_rate_limit (ip, count, window_start)`.
- Helpers React: `useGovernance()`, `useDataExports()`, `useDSAR()`, `useAuditLogs()`.

### Não inclui (escopo futuro)
- PDF do relatório de conformidade (só JSON nesta fase).
- Captcha no DSAR público (rate limit por IP é suficiente por ora).
- Anonimização granular por campo (faz hard-delete ou soft-delete completo).
- 2FA / SSO / IP allowlist (Fase 5 segurança operacional).

### Riscos
- **Médio-Alto**: muitas migrations e triggers — vou rodar **em uma única migration grande** com transação, e testar imediatamente após.
- Triggers de auditoria em tabelas quentes (contacts, messages) podem virar gargalo → começam só com SELECT/UPDATE críticos, não em INSERT de mensagens regulares.
- Edge function `account-export` pode estourar timeout com contas grandes → faz streaming + chunking; se >10k mensagens, parte em arquivos.
- Bucket `account-exports`: signed URL com TTL 7d, nunca público.

### Checklist de aceite (será validado ao final)
- [ ] `/account/governance` acessível só por owner/admin
- [ ] Export JSON funciona, isolado por `account_id`, sem binários pesados
- [ ] Conversas e mensagens incluídas; áudios só por referência
- [ ] Cancelar conta inicia retenção 30d e mostra contagem regressiva
- [ ] Exclusão definitiva exige aprovação dupla e fica auditada
- [ ] `audit_logs` registra todos os eventos críticos com novos campos
- [ ] Relatório de conformidade exportável em JSON
- [ ] Fluxo DSAR end-to-end (criar, atribuir, resolver)
- [ ] Filtros de consentimento e base legal em contatos
- [ ] Todas as novas tabelas têm RLS por `account_id`
- [ ] Edge functions validam JWT + membership + papel
- [ ] Admin AXHolding tem visão global isolada de clientes

### Entrega final
Relatório técnico no chat após implementação: tabelas criadas/alteradas, edge functions, políticas RLS, páginas, riscos remanescentes e próximos passos.

Confirma para eu começar a implementação?