

# Sala de Reunião por Vídeo

## O que será feito
Implementar uma página de videochamada integrada usando **Jitsi Meet** (gratuito, open-source, sem API key necessária) embutido via iframe.

## Etapas

### 1. Criar página `MeetingRoom.tsx`
- Rota `/meeting/:id`
- Carrega dados do appointment pelo ID
- Embute Jitsi Meet iframe com sala nomeada pelo ID do appointment
- Mostra título, participantes e duração do agendamento
- Botão para sair/voltar aos agendamentos

### 2. Adicionar rota no `App.tsx`
- Rota protegida `/meeting/:id` → `MeetingRoom`

### 3. Gerar link de meeting automaticamente
- Ao criar appointment, gerar `meeting_url` automático baseado em Jitsi (ex: `https://meet.jit.si/axhub-{appointment-id}`)
- Salvar na coluna `meeting_url` existente

## Detalhes Técnicos
- Jitsi é 100% gratuito e não requer API key
- O iframe permite configurar: nome do usuário, desabilitar lobby, tema escuro
- A sala é criada automaticamente ao acessar a URL

