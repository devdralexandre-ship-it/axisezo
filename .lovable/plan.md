## Otimizações da interface mobile

Foco nas três jornadas priorizadas: **cirurgião revisando casos**, **inclusão rápida de paciente** e **kanban navegável no celular**. Tudo ativado abaixo de `md` (768px) via Tailwind, mantendo o desktop intacto.

---

### 1. Pipeline: tabs por estágio com swipe (`PipelineDashboard.tsx` + `PipelineColumn.tsx`)

Substituir o scroll horizontal de 11 colunas por uma única coluna visível.

- Barra de **tabs horizontais com scroll** fixa no topo, uma por estágio, mostrando:
  - rótulo curto do estágio
  - contagem de pacientes
  - bolinha vermelha se há card com `Tolerância estourada` ou `Novo`
- **Swipe horizontal** entre estágios (gesto nativo via `embla-carousel-react` — já instalado pelo shadcn `carousel`). Tab e swipe ficam sincronizados.
- Cabeçalho do estágio ativo: nome completo + total R$ (oculto se `!canSeeFinancials`).
- Filtros (`FilterBar`) recolhidos atrás de um botão "Filtros" que abre um `Sheet` lateral; chip mostra quantos filtros estão ativos.
- Botões secundários do header (Importar CSV, Admin, Biblioteca, etc.) movidos para o `DropdownMenu` "Menu" já existente; no mobile só ficam visíveis **+ Paciente**, sino de notificação e menu.

### 2. Card de paciente compacto (`PatientCard.tsx`)

Versão mobile mais densa, ainda usando o mesmo componente com variantes responsivas:

- **Linha 1:** nome + idade no funil (dias) + badges `Novo` / `Tolerância estourada · N` (já existem).
- **Linha 2:** cirurgião (avatar/iniciais) + procedimento abreviado.
- **Linha 3:** "Próxima ação" — título da `getNextPendingTask` + responsável, com cor por urgência (`getTaskUrgency`). Se não há ação pendente, mostra "Sem ação pendente" em muted.
- **Swipe actions** (usando `framer-motion` `drag="x"` com snap):
  - swipe → esquerda: "Concluir ação" (chama `useCompleteTask` da próxima task; abre `AddTaskDialog` para registrar próximo passo, mantendo a regra obrigatória de próxima ação).
  - swipe → direita: "Mover estágio" — abre bottom sheet com a lista de estágios.
  - tap longo / botão: abre o `PatientPanel`.
- DnD do `@hello-pangea/dnd` fica **desativado no mobile** (gestos conflitam com swipe e scroll); movimentação acontece pelo swipe → "Mover estágio".

### 3. PatientPanel em tela cheia (`PatientPanel.tsx`)

- No mobile, o `Sheet` abre com `side="bottom"` em altura `100dvh` e cantos arredondados no topo, ao invés do slide-over de 480px.
- Cabeçalho fixo com nome do paciente, estágio atual e botão fechar.
- Abas internas (Resumo, Ações, Documentos, Orçamento, etc.) viram um **scroll horizontal de chips** já que tabs do shadcn estouram em telas estreitas.
- Botões de ação primária (Adicionar ação, Concluir próxima, Mover estágio) ancorados em uma barra inferior fixa (`sticky bottom-0`) com `safe-area-inset-bottom`.

### 4. AddPatientForm em etapas (`AddPatientForm.tsx`)

Hoje é um formulário longo. No mobile vira **wizard de 4 passos**, mantendo um único submit no fim:

```text
[1 Identificação] → [2 Clínico] → [3 Comercial] → [4 Ação inicial]
```

- Progresso no topo (4 bolinhas + label do passo atual).
- Botões "Voltar" / "Avançar" fixos no rodapé; "Salvar" só aparece no passo 4.
- Campos com `inputMode` correto (`tel`, `numeric`, `email`) para subir o teclado certo.
- Datas usam `<input type="date">` nativo no mobile (mais rápido que o popover).
- Campos condicionais (lateralidade, via de acesso, billing) continuam respeitando a lógica existente — apenas reagrupados nos passos.
- No desktop o formulário continua single-page (sem regressão).

### 5. Briefing concierge: banner fixo no topo (`ConciergeLoginBriefing.tsx` + `PipelineDashboard.tsx`)

- Substituir o modal por um **banner sticky** abaixo do header quando há novos pacientes ou tolerâncias estouradas para a concierge logada.
- Layout: ícone + "3 novos · 2 tolerâncias estouradas" + chevron. Tap expande para a lista já existente em um `Sheet` bottom.
- Botão "Marcar como visto" atualiza `lastSeenAt` (mesmo localStorage atual).
- Desktop continua usando o modal atual.

### 6. Ajustes globais

- Header principal: logo encolhe, search vira ícone que expande para input full-width ao tocar.
- `NotificationBell` mantém badge; popover vira `Sheet` no mobile para caber a lista.
- Toques mínimos de 44px em todos os botões/cards.
- `viewport-fit=cover` + classes `pb-[env(safe-area-inset-bottom)]` nas barras fixas.

---

### Detalhes técnicos

- Breakpoint único: `md` (Tailwind). Helper `useIsMobile()` já existe em `src/hooks/use-mobile.tsx` — usar para alternar componentes (Sheet side, swipe vs DnD).
- Sem novas dependências: `embla-carousel-react` e `framer-motion` já estão no projeto via shadcn.
- Nenhuma mudança em RLS, schema, hooks de dados, regra de ação obrigatória ou cálculo de SLA — apenas UI/UX.
- Arquivos tocados: `PipelineDashboard.tsx`, `PipelineColumn.tsx`, `PatientCard.tsx`, `PatientPanel.tsx`, `AddPatientForm.tsx`, `ConciergeLoginBriefing.tsx`, `FilterBar.tsx`, `NotificationBell.tsx`. Um novo `MobileStageTabs.tsx` para encapsular o carrossel de estágios.

### Fora de escopo

- Mudanças no fluxo de DnD desktop.
- Notificações push / PWA / instalação como app (pode ser próximo passo se desejado).
- Reescrita do `BudgetForm`, `SurgicalRequestForm` e demais formulários longos — só `AddPatientForm` nesta rodada.
