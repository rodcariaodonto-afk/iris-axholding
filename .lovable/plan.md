## Módulo Coworking — IRIS

Adicionar gestão de **salas, reservas com anti-overbook (GIST), pagamento PIX manual** e integração opcional com a tela de Agendamentos existente. Tudo isolado por `account_id` (RLS), opt-in por conta, sem mexer no fluxo atual de quem não usar.

---

### Modelo de habilitação (2 níveis)

1. **Super Admin** marca quais contas têm o **módulo disponível** (feature flag por conta).
2. **Owner/Admin** da conta liga o **toggle de uso** em Settings → faz o bootstrap das 4 salas FLOW BC automaticamente.

A aba "Coworking" em Settings só aparece quando o módulo está **disponível E ativo** para aquela conta. Se não estiver disponível, o admin nem vê a aba (zero ruído para clientes que não contratam).

---

### PR1 — Banco de dados (migration única)

**Flags no `accounts.settings` (jsonb, sem nova coluna):**
- `coworking_module_available` (bool) — controlado pelo Super Admin
- `coworking_enabled` (bool) — controlado pelo Owner/Admin

**Novas tabelas:**
- `bookable_resources` — salas (nome, capacidade, ativa, bookable publicamente, prioridade, google_calendar_id, metadata).
- `coworking_payments` — pagamentos PIX manuais (status pending/paid/failed/refunded, amount, validated_by, paid_at).

**Extensão de `appointments`** (todas opcionais, default-safe — não quebra appointments existentes):
- `resource_id` (FK → bookable_resources, ON DELETE SET NULL)
- `payment_status` default `'not_required'`
- `booking_status` default `'draft'`
- `booking_source` default `'manual'`
- `customer_type`, `service_modality`, `requires_human_validation`, `internal_notes`
- `start_at` / `end_at` (timestamptz, derivados via trigger a partir de `date`+`time`+`duration` em America/Sao_Paulo)

**Anti-overbook:**
- Extensão `btree_gist`
- Constraint `EXCLUDE USING gist (resource_id WITH =, tstzrange(start_at,end_at,'[)') WITH &&)` parcial, ignorando `cancelled/no_show`. Erro `23P01` é tratado no client com toast amigável.
- Backfill de `start_at/end_at` para appointments existentes.

**RLS** (segue padrão do projeto):
- SELECT: `is_account_member(account_id) OR is_super_admin()`
- ALL: `has_account_role(account_id, ['owner','admin','manager']) OR is_super_admin()`
- Trigger garante que só owner/admin/manager preencha `validated_by` em coworking_payments.

**RPC `bootstrap_coworking_defaults(_account_id)`** — idempotente, cria as 4 salas FLOW BC (Sala 01 ativa, 02 inativa, 03 só sob pedido explícito, 04 alternativa). Se já existirem salas, apenas retorna a lista atual.

**Realtime:** adiciona `bookable_resources` e `coworking_payments` à publicação `supabase_realtime`.

---

### PR2 — Edge Functions (3, com `verify_jwt=true` — não são webhooks)

1. **`check-resource-availability`** — retorna `{ available, conflicts }` para `(resource_id, start_at, end_at)`.
2. **`create-coworking-booking`** — valida disponibilidade, insere appointment + (opcional) coworking_payment. Trata `23P01` com mensagem clara.
3. **`validate-manual-pix`** — marca pagamento como pago, atualiza appointment para `confirmed/paid`. Restrito a owner/admin/manager (trigger + check no código).

---

### PR2 — Frontend

**Hook `src/hooks/useCoworking.tsx`:**
- `useCoworkingModuleAvailable()` — lê `accounts.settings.coworking_module_available`.
- `useCoworkingEnabled()` — lê `accounts.settings.coworking_enabled` (false se módulo não estiver disponível).
- `useToggleCoworking()` — atualiza `coworking_enabled` e chama `bootstrap_coworking_defaults` na primeira ativação.
- `useBookableResources()` — lista por conta ativa, com subscription Realtime.
- `useCreateCoworkingBooking()` / `useValidateManualPix()` — invocam as edges.

**Novos componentes:**
- `src/components/settings/CoworkingSettings.tsx` — toggle "Ativar Coworking" + tabela de salas + botão "Recriar salas padrão".
- `src/components/coworking/CoworkingBookingModal.tsx` — modal dedicado (uso futuro pela IA / portal público).
- `src/components/coworking/ValidatePixDialog.tsx` — dialog para admin confirmar pagamento PIX.

**Integrações em telas existentes (mudanças mínimas):**
- `src/components/Settings.tsx` — registra a aba "Coworking" **condicionalmente**, só quando `coworking_module_available && (isAdmin || isOwner)`.
- `src/components/Scheduling.tsx` — no modal "Novo Agendamento", **só quando `coworking_enabled === true`**, mostra select extra "Sala" abaixo de "Tipo" (com capacidade ao lado). Quando off, a tela funciona exatamente como hoje.
- `src/services/api.ts` — adiciona `resource_id?: string | null` opcional ao payload de `createAppointment`. Trata erro `23P01` com toast "Sala já reservada nesse horário".

**Super Admin (gestão do módulo por cliente):**
- `src/components/admin/AdminAccounts.tsx` — adiciona switch "Habilitar módulo Coworking" na ficha da conta, gravando em `accounts.settings.coworking_module_available`.

---

### Pagamento PIX (escopo desta fase)

Apenas **registro + validação manual**:
- Admin cria booking marcando "requer pagamento" + valor → cria `coworking_payments` com status `pending`.
- Admin abre `ValidatePixDialog`, clica "Confirmar pagamento" → status vira `paid`, appointment vira `confirmed`.
- **Sem QR code, sem comprovante (upload), sem integração com PSP nesta fase.** Campo `proof_url` fica no schema para fase futura.

---

### Critérios de aceitação

1. Cliente sem o módulo disponível não vê nada novo no produto.
2. Super Admin habilita módulo para conta X → Owner da X passa a ver aba "Coworking" em Settings.
3. Owner ativa o toggle → 4 salas FLOW BC criadas automaticamente; reativar não duplica.
4. Em conta com coworking ativo, modal "Novo Agendamento" ganha campo "Sala" opcional; em conta sem coworking, tela idêntica à atual.
5. Tentativa de reserva sobreposta → toast amigável (erro GIST 23P01 capturado).
6. PIX pending → admin valida → appointment `confirmed/paid`.
7. RLS impede vazamento cross-account; non-admin vê salas (read-only).
8. Realtime: criação/edição de salas reflete sem reload.

---

### Ordem de execução

1. **PR1** — migration completa (schema + RPC + RLS + realtime), aplicada e aprovada.
2. **PR2** — edge functions + hook + componentes + integrações nas telas existentes (Settings, Scheduling, AdminAccounts, services/api).

Os 2 PRs ficam em turnos separados (migration não mistura com escrita de código TS para os tipos do Supabase serem regenerados entre eles).

### Arquivos tocados

```
supabase/migrations/<ts>_coworking_module.sql                    [novo]
supabase/functions/check-resource-availability/index.ts          [novo]
supabase/functions/create-coworking-booking/index.ts             [novo]
supabase/functions/validate-manual-pix/index.ts                  [novo]
src/hooks/useCoworking.tsx                                       [novo]
src/components/coworking/CoworkingBookingModal.tsx               [novo]
src/components/coworking/ValidatePixDialog.tsx                   [novo]
src/components/settings/CoworkingSettings.tsx                    [novo]
src/components/Settings.tsx                                      [editar — aba condicional]
src/components/Scheduling.tsx                                    [editar — campo Sala condicional]
src/components/admin/AdminAccounts.tsx                           [editar — switch módulo]
src/services/api.ts                                              [editar — resource_id + erro 23P01]
```

Pronto para começar pelo PR1 quando aprovar.
