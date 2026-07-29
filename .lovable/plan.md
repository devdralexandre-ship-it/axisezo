Agrupar os filtros do desktop em um menu para reduzir a altura da barra superior e deixar o cabeçalho mais enxuto.

### O que será feito

1. **Novo componente de menu de filtros para desktop**
   - Criar um componente (ou estender `FilterSheet`) que, no desktop, abra como **Sheet lateral direita** (480 px, mesmo padrão dos slide-overs do projeto) e contenha o `FilterBar` existente.
   - No mobile, manter o comportamento atual de bottom sheet.
   - O gatilho será um botão "Filtros" com ícone e badge mostrando a quantidade de filtros ativos (mesma lógica já usada no `FilterSheet`).

2. **Ajustar o cabeçalho do `PipelineDashboard` no desktop**
   - Remover a exibição inline do `FilterBar`.
   - Deixar sempre visíveis: campo de busca, botão "Filtros", toggles rápidos de SLA (Todos / SLA estourado / Escaladas), `ViewToggle` e `SortControl`.
   - Agrupar esses elementos em uma única linha compacta, sem quebra de layout.

3. **Preservar comportamentos**
   - Limpar filtros (`Limpar`) continua funcionando dentro do menu.
   - Contador de filtros ativos continua igual ao do mobile.
   - Filtros aplicados refletem imediatamente na tabela/kanban ao fechar/alterar o menu.

### Detalhes técnicos
- Arquivos alterados:
  - `src/components/FilterSheet.tsx` — adicionar variação de layout desktop (Sheet lateral) e props de `side`/`className`.
  - `src/components/PipelineDashboard.tsx` — substituir o bloco desktop do `FilterBar` inline pelo novo menu de filtros.
  - Opcionalmente `src/components/FilterBar.tsx` — apenas se for necessário ajustar espaçamentos internos para caber melhor no Sheet lateral.

### Não inclui
- Mudança na lógica de filtragem (mesmos filtros e estados).
- Alteração no mobile (continua com bottom sheet).
- Alteração nos toggles de SLA (permanecem visíveis fora do menu).