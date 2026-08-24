# Corrigir horários invertidos e impedir que aconteça de novo

## O que está errado hoje

Três contas têm início/fim de atendimento invertidos, o que hoje significa "atender de madrugada":

- Directconstru: 17:30 → 07:30
- Pró Animais: 18:00 → 08:00
- DRM: 12:00 → 06:00 (e sem dias de atendimento definidos)

Nas telas de configuração, quando o fim é anterior ao início a UI só mostra um aviso amarelo — o salvamento é permitido, então o cliente pode reintroduzir o mesmo erro. No onboarding não existe nem aviso.

## Correções

1. **Ajustar os dados das três contas** para horário comercial diurno:
   - Directconstru: 07:30 → 17:30
   - Pró Animais: 08:00 → 18:00
   - DRM: 08:00 → 18:00, dias seg–sex

2. **Bloquear o salvamento inválido nas Configurações do Agente**
   Em `src/components/settings/AgentSettings.tsx`, no `handleSave`:
   - se fim = início → erro "O horário de fim deve ser diferente do início" e não salva;
   - se fim < início → abrir confirmação explícita ("Isso configura atendimento durante a madrugada, das 17:30 às 07:30 do dia seguinte. É isso mesmo?"); só salva se o cliente confirmar. Assim quem realmente atende à noite continua conseguindo, mas ninguém cria janela noturna por engano.
   - manter a validação já existente de "ao menos um dia da semana".

3. **Mesma proteção no onboarding**
   Em `src/components/onboarding/StepBusinessHours.tsx` (e no avanço de etapa do `OnboardingWizard`): impedir avançar com fim = início ou sem nenhum dia selecionado, e exibir o mesmo alerta de janela noturna quando fim < início.

4. **Guarda no banco**
   Migration com uma trigger de validação em `nina_settings` que rejeita fim = início e normaliza `business_days` vazio para seg–sex, garantindo que nenhuma outra origem (API, edge function, importação) grave configuração impossível. Janela noturna intencional continua permitida.

## Detalhes técnicos

- Sem mudança de colunas; apenas UPDATE nos três registros + trigger `BEFORE INSERT OR UPDATE` em `public.nina_settings`.
- O utilitário `_shared/business-hours.ts` já trata corretamente janelas que cruzam a meia-noite, então nada muda no motor da IA.
- Confirmação de janela noturna via diálogo já existente do design system (AlertDialog), sem `window.confirm`.
