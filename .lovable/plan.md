## Diagnóstico (confirmado no banco)

A conta **DRM REPRESENTAÇÕES** (empresa "Alliance Jiu Jitsu Gravataí Centro", SDR "Kako") tem uma chave ElevenLabs salva com apenas **9 caracteres** — ou seja, um valor inválido/incompleto.

O que acontece hoje:
- A validação testa a chave na API da ElevenLabs, recebe erro e marca o item como **erro** (vermelho).
- Como existe pelo menos um item em "erro", o resultado geral vira "❌ Configurações obrigatórias pendentes" e o onboarding trava em 75%.
- Isso está errado: ElevenLabs é **opcional** (áudio). Quando a chave está vazia, o próprio código já classifica como "aviso"; só quando está preenchida-mas-inválida ele vira "erro" e bloqueia.

O WhatsApp aparece como aviso porque a conta tem 1 sessão criada mas ainda não conectada — isso é esperado até escanear o QR e não bloqueia.

## O que será feito

1. **Limpar a chave inválida da DRM** (migração/atualização pontual): zerar `elevenlabs_api_key` da conta quando o valor for claramente inválido (menos de 20 caracteres). Isso já destrava a tela imediatamente.

2. **Tornar ElevenLabs não-bloqueante** na função `validate-setup`:
   - Chave ausente → aviso "ElevenLabs não configurado (opcional)".
   - Chave presente e válida → OK.
   - Chave presente e inválida/erro de rede → **aviso** com a mensagem "Chave ElevenLabs inválida (áudio desativado)", nunca "erro".

3. **Mesma regra na função `health-check`**, para o card de status e o onboarding ficarem coerentes.

4. **Validação no formulário** (passo ElevenLabs do onboarding e Configurações): não permitir salvar uma chave obviamente inválida (muito curta), avisando na hora em vez de gravar lixo no banco.

## Detalhes técnicos

- `supabase/functions/validate-setup/index.ts`: bloco ElevenLabs passa a usar `status: 'warning'` em qualquer falha; deploy da função.
- `supabase/functions/health-check/index.ts`: mesmo ajuste de severidade; deploy.
- `src/components/onboarding/StepElevenLabs.tsx` e `src/components/settings/AgentSettings.tsx` (campo da chave): rejeitar valores com menos de 20 caracteres antes de salvar.
- SQL: `UPDATE nina_settings SET elevenlabs_api_key = NULL WHERE elevenlabs_api_key IS NOT NULL AND length(elevenlabs_api_key) < 20;`

Depois disso, o onboarding da DRM deve fechar em 100% assim que o WhatsApp for conectado (ou ficar em aviso, sem bloquear).
