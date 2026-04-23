

## Problema

O drop está caindo em uma coluna **errada (várias posições atrás)** quando o board faz scroll horizontal durante o arraste. A sessão confirma: card arrastado de `budget_preparation` foi solto sob a coluna visível à direita, mas caiu em `indication` (várias colunas à esquerda — exatamente onde o ponteiro estaria *antes* do scroll).

## Causa raiz

A implementação atual de auto-scroll horizontal (adicionada no último ciclo) faz `container.scrollLeft += delta` dentro de um `requestAnimationFrame` disparado por `pointermove`. Isso **invalida o cache interno de posições dos droppables** do `@hello-pangea/dnd`. A biblioteca calcula as bounding boxes dos droppables no `onDragStart` e só as recalcula quando *ela mesma* dispara o scroll. Como o scroll está vindo de fora do ciclo dela, o droppable-alvo é resolvido com base nas coordenadas antigas → o card cai na coluna que estava sob o cursor antes do scroll.

A premissa do plano anterior ("a biblioteca recalcula em cada frame quando o container scrolla") estava incorreta: ela só recalcula quando o scroll vem do auto-scroller dela.

## Por que o auto-scroll nativo da biblioteca não funciona hoje

`@hello-pangea/dnd` faz auto-scroll do **scrollable ancestor mais próximo do Droppable**. Hoje:

```text
<div overflow-x-auto>          ← board (queremos que ela use esse)
  <PipelineColumn>
    <Droppable>
      <div overflow-y-auto>    ← coluna (a biblioteca acha esse primeiro)
```

Como cada coluna tem seu próprio `overflow-y-auto`, a biblioteca trava nele e nunca enxerga o scroll horizontal do board. Por isso só foi implementado o manual — que causa o bug de drop errado.

## Solução

Remover o auto-scroll manual e deixar o **auto-scroller nativo** da biblioteca cuidar de ambos os eixos. Para isso, eliminar o scroll vertical interno de cada coluna, fazendo do board o único ancestral scrollável dos droppables — assim a biblioteca faz auto-scroll horizontal *e* vertical sem desincronizar coordenadas.

### Mudanças concretas

**1. `src/components/PipelineDashboard.tsx`** — remover toda a lógica manual:
- Remover `rafIdRef`, `isDraggingRef`, `pointerXRef`, `stopAutoScroll`, `tickAutoScroll`, `handlePointerMove`, o `useEffect` de cleanup desses listeners.
- Simplificar `handleDragStart` (vira no-op ou removido) e `handleDragEnd` (manter apenas a lógica de mover paciente).
- Manter `scrollContainerRef` apenas se necessário (provavelmente não será mais).
- Trocar o wrapper externo para permitir scroll **vertical e horizontal** no board:
  ```tsx
  <div className="flex-1 overflow-auto">
    <div className="flex gap-4 p-6 min-w-max min-h-full">
      ...colunas...
    </div>
  </div>
  ```

**2. `src/components/PipelineColumn.tsx`** — remover `overflow-y-auto` do `<div>` do Droppable:
- Trocar `flex flex-col gap-2 flex-1 overflow-y-auto pr-1 pb-2 min-h-[80px] ...` por `flex flex-col gap-2 flex-1 pr-1 pb-2 min-h-[80px] ...`.
- Manter `min-w-[240px] max-w-[280px]` e `shrink-0` na coluna externa para preservar o layout.
- Resultado: o board todo rola (horizontal + vertical), as colunas crescem com o conteúdo.

### Por que isso resolve

- `@hello-pangea/dnd` agora encontra o board como o único scrollable ancestor → ativa o auto-scroller nativo dela em ambos os eixos quando o ponteiro chega perto da borda.
- O scroll é feito **dentro do ciclo da biblioteca**, então as posições dos droppables são sempre recalculadas corretamente → o drop cai exatamente sob o cursor, sempre.
- Elimina o código manual frágil que era a causa do bug.

## Trade-off

- Antes, cada coluna scrollava verticalmente de forma independente. Agora a página inteira do board rola junto. Em colunas muito longas isso é uma mudança visual leve, mas é o padrão típico de Kanban (Trello, Linear) e é o único caminho seguro para auto-scroll horizontal correto com `@hello-pangea/dnd`.

## Verificação

1. Arrastar um card e mover para perto da borda direita → board rola horizontalmente, drop cai na coluna sob o cursor.
2. Mesmo na borda esquerda.
3. Drop em coluna que estava fora da viewport inicial cai na coluna **correta** (não mais várias colunas atrás).
4. Reordenar verticalmente dentro de uma coluna continua funcionando.
5. Sem drag, o board é navegável com scroll horizontal e vertical normal.

## Arquivos afetados

- `src/components/PipelineDashboard.tsx`
- `src/components/PipelineColumn.tsx`

