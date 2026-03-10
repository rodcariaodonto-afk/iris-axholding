

# Corrigir modais de agendamento - adicionar scroll e limitar altura

## Problema
Os 3 modais (criar, detalhes, editar) não têm scroll e ultrapassam a tela, escondendo os botões de ação.

## Solução
Adicionar `max-h-[90vh]` e `overflow-y-auto` no corpo dos modais para que o conteúdo seja rolável quando exceder a altura da tela.

### Alterações em `src/components/Scheduling.tsx`:

1. **Modal de Criar (linha ~627):** Adicionar `max-h-[90vh] flex flex-col` no container e `overflow-y-auto` no form.
2. **Modal de Detalhes (linha ~761):** Adicionar `max-h-[90vh]` no container e `overflow-y-auto` no body.
3. **Modal de Editar (linha ~889):** Mesmo padrão - `max-h-[90vh] flex flex-col` e `overflow-y-auto` no conteúdo.

### Exemplo da mudança (modal de criar):
```
// De:
<div className="bg-slate-900 ... max-w-md w-full overflow-hidden ...">

// Para:
<div className="bg-slate-900 ... max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden ...">
  <div className="p-6 ...">Header (fixo)</div>
  <form className="p-6 ... overflow-y-auto flex-1">
```

Mesma lógica aplicada aos 3 modais. O header fica fixo no topo, o conteúdo rola.

