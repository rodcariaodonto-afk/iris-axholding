# Pró Animais: agente sem receber mensagens

## O que os dados mostram

- A instância `proanimais` aparece como **conectada e "saudável"**, mas o último evento real vindo da Evolution foi em **27/08 às 16:57 (BRT)** — ou seja, está muda há 6 dias, não desde ontem.
- Nenhuma mensagem gravada para a conta desde 27/08 (`messages`), fila de recebimento vazia, fila de envio vazia. Não há nada travado internamente.
- Outras contas receberam mensagens normalmente nas últimas 48h, então o problema é isolado nessa instância.
- O monitor automático roda a cada 5 min e o auto-reparo de webhook não acusa divergência (URL e evento `MESSAGES_UPSERT` corretos no servidor Evolution).

## Por que ninguém foi avisado (falha real do monitor)

Na checagem de saúde (`whatsapp-session-status`), o tempo de silêncio é medido como `max(último evento recebido, última tentativa de recuperação)`. Como o próprio monitor fez um restart hoje às 14:00 (BRT) e gravou `last_recovery_at`, o cálculo zerou o silêncio e a sessão voltou a ser marcada como **healthy** — mesmo sem nunca ter recebido um evento de volta. É um ciclo cego: reinicia, se autodeclara curada, repete.

## Correções

1. **Restabelecer o recebimento da Pró Animais**
   - Consultar o estado real da instância no servidor Evolution (`connectionState`, `fetchInstances`) para distinguir socket zumbi de sessão deslogada no aparelho.
   - Se for socket zumbi: `restart` + reaplicação do webhook e validação com evento real.
   - Se o WhatsApp foi desconectado no celular (o mais provável após 6 dias de silêncio total): a sessão precisa de **nova leitura de QR Code** pelo cliente. Nesse caso deixo a sessão em `qr_pending` e te aviso para o cliente reconectar pela tela de WhatsApp.

2. **Corrigir o diagnóstico de silêncio**
   - `last_recovery_at` deixa de contar como sinal de vida. Passa a ser usado apenas como *cooldown* entre tentativas de restart.
   - Nova regra: se após uma recuperação a instância continuar sem nenhum evento real por mais de 2 horas em horário comercial, a saúde vira `degraded` e depois `offline`, exigindo reconexão manual em vez de restarts infinitos.

3. **Alerta visível**
   - Registrar em `audit_logs` e em `governance_notifications` quando uma sessão passar de X horas sem evento, para aparecer no painel em vez de ficar silencioso.
   - Na tela de sessões WhatsApp, mostrar o tempo desde o último evento real recebido ("sem mensagens há 6 dias") ao lado do status.

## Detalhes técnicos

- Arquivos: `supabase/functions/whatsapp-session-status/index.ts` (função `diagnoseSilentInstance` e bloco de health), `supabase/functions/evolution-session-monitor/index.ts` (escalonamento/notificação), `src/components/settings/WhatsAppSessions.tsx` (exibição do último evento).
- Sem alteração de schema: `last_inbound_event_at`, `last_recovery_at`, `health` e `health_reason` já existem.
