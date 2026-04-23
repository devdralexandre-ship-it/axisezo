

## Problema

O Kanban possui scroll horizontal (`overflow-x-auto`), mas ao arrastar um card para perto da borda esquerda/direita, a tela **não rola automaticamente**. Isso obriga o usuário a soltar o card, rolar manualmente, e arrastar de novo — quebrando o fluxo.

## Causa

A biblioteca `@hello-pangea/dnd` faz auto-scroll automaticamente, mas precisa que o container com `overflow-auto` seja **identificável como o scroll container do droppable**. Hoje a estrutura está assim:

```text
<DragDropContext>
  <div ref=scrollContainerRef class="overflow-x-auto">   ← scroll container
    <div class="flex gap-4 min-w-max">                   ← conteúdo largo
      <PipelineColumn> (Droppable)
      <PipelineColumn> (Droppable)
      ...
```

O `Droppable` está dentro de cada coluna (que tem `overflow-y-auto` próprio para rolagem vertical da lista de cards). A biblioteca encontra primeiro o scroll vertical da coluna e usa ele como referência — então o auto-scroll **horizontal do board** nunca é acionado, apenas o vertical dentro da coluna.

Além disso, na implementação anterior havia um auto-scroll manual via `mousemove` que foi removido (causava o bug do ghost desalinhado). Agora não há nada cobrindo o eixo horizontal.

## Solução

Implementar um auto-scroll horizontal **controlado e seguro**, que não conflite com o posicionamento do `@hello-pangea/dnd` (que foi a causa do bug anterior do "card cai na coluna errada").

### Abordagem

Em vez de mover o scroll via `scrollLeft +=` durante `mousemove` (que desincroniza coordenadas do DnD), usar os eventos do próprio DnD:

1. **`onDragStart`**: começar a escutar `dragover` (ou `pointermove`) no container.
2. Durante o drag, se o ponteiro estiver a menos de ~80px da borda esquerda ou direita do container scrollável, iniciar um `requestAnimationFrame` que incrementa `scrollLeft` em pequenos passos (ex.: 8–14px/frame, proporcional à proximidade da borda).
3. **`onDragEnd` / `onDragUpdate`**: parar o RAF e remover listeners.
4. Garantir que o scroll afete somente o container do board (`scrollContainerRef`), nunca a janela.

Por que isso é seguro agora (e não causa o bug antigo do drop na coluna errada):
- O `@hello-pangea/dnd` recalcula posições dos droppables em cada frame quando o container scrolla, **desde que o scroll seja feito pelo próprio elemento que ele observa**. O bug anterior acontecia porque o scroll era feito de forma fora do ciclo do DnD com transformações concorrentes. Movendo `scrollLeft` no container correto via RAF dentro do ciclo de drag ativo, as coordenadas permanecem consistentes.
- Adicionar marcador `data-rbd-scroll-container-context-id` não é necessário; basta scrollar o ancestral correto.

### Detalhes de UX

- Zona de ativação: 80px de cada borda lateral do board.
- Velocidade: rampa linear de 4px/frame (na borda interna da zona) até 16px/frame (encostando na borda).
- Parar imediatamente quando: drag termina, ponteiro sai da zona, ou scroll atinge limite.
- Não fazer scroll vertical da página — somente horizontal do `scrollContainerRef`.

## Arquivos afetados

- `src/components/PipelineDashboard.tsx`
  - Adicionar `useRef` para o RAF id e estado de drag ativo.
  - Implementar `handleDragStart` (ativar listener `pointermove` no container) e estender `handleDragEnd` / cancelamento para limpar.
  - Função `autoScrollIfNearEdge(clientX)` chamada pelo listener.

## Verificação

Após a implementação:
1. Arrastar um card e mover o ponteiro até ~50px da borda direita → o board deve rolar suavemente para a direita.
2. Mesmo teste na borda esquerda.
3. Soltar o card em uma coluna que estava fora da viewport inicial → deve cair exatamente na coluna sob o cursor (sem o bug de "cair várias colunas atrás").
4. Sem drag ativo, mover o mouse pelas bordas não deve causar nenhum scroll.
5. Drag-and-drop dentro de uma mesma coluna (reordenação vertical) continua funcionando.

## Limitações conhecidas

- Em telas muito pequenas onde todas as colunas já cabem na viewport, o auto-scroll simplesmente não terá efeito (esperado).
- Touch devices: a implementação usará `pointermove`, que cobre mouse e touch; em alguns navegadores móveis o gesto de scroll nativo pode competir — será testado, mas pode exigir ajuste fino se houver conflito.

