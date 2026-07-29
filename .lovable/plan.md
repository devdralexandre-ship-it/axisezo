
## 1. Mobile: mais espaço para o Kanban

- **Filtros colapsáveis**: `FilterBar` vira um botão único no mobile ("Filtros") que abre um `Sheet` lateral com todos os campos. Chips resumindo filtros ativos ficam abaixo do header, com "×" individual.
- **Busca compacta**: campo de busca permanece visível (input pequeno) — é o mais usado.
- **Header enxuto**: mover ações secundárias (perfil, admin, templates) para o menu hambúrguer já existente. Manter apenas: logo, busca, filtros, notificações.
- **Tabs de estágio**: reduzir altura das Tabs e permitir swipe horizontal entre colunas (usando a estrutura atual de tabs). Adicionar contador ao lado do nome do estágio.
- **Ordenação**: novo botão de ordenação (ícone) ao lado dos filtros, também disponível no mobile.

## 2. Ordenação por coluna do Kanban

Novo controle global de ordenação (aplicado a todas as colunas) com 4 modos:
- Dias no estágio (padrão, mais antigos no topo)
- Urgência da próxima ação (estouradas → hoje → futuras)
- Valor estimado (maior primeiro — soma dos honorários)
- Data de indicação (mais recentes ou mais antigos, toggle asc/desc)

Toggle de direção (↑/↓) ao lado do seletor. Estado salvo em `localStorage`.

## 3. Nova rota `/pendencias` — Central de Ações da Concierge

Lista unificada de todas as **ações abertas** dos pacientes visíveis ao usuário, agrupadas por urgência:
- **Estouradas** (SLA breached / escalated) — topo, vermelho
- **Hoje** — amarelo
- **Esta semana**
- **Futuras**

Cada linha mostra: paciente, título da ação, responsável, prazo, chip de SLA, badges do paciente (sensível/risco/ticket), estágio atual.

**Edições inline** (sem abrir painel):
- Concluir ação → dialog rápido para criar a próxima (obrigatório)
- Botão de contato rápido (WhatsApp/telefone/nota) — cria `contact_record`
- Dropdown para mudar estágio do pipeline
- Toggle rápido dos badges (sensível/risco/ticket)

**Sincronia**: usa os mesmos hooks (`usePatients`, realtime) — qualquer mudança feita no Kanban ou no painel reflete aqui e vice-versa (React Query invalida as mesmas queries).

Filtros locais: concierge, cirurgião, estágio.

## 4. Nova rota `/relatorios` — Dashboard Analítico

Filtros no topo (reaproveitam `FilterBar` + intervalo de datas: 7d / 30d / 90d / mês atual / customizado). Filtros mantidos entre abas.

**Cards de KPI** (topo): total no pipeline, taxa de conversão, ticket médio, tempo médio até cirurgia.

**Visualizações** (usando `recharts`):
1. **Funil de conversão por estágio** — barra horizontal com contagem + valor por estágio. Toggle "filtrar pelo mês de indicação" (agrupa pacientes cuja `indication_date` está no período, mostrando onde estão hoje).
2. **Perdidos por motivo** — pizza + tabela com `loss_reason`.
3. **Produtividade** — barras agrupadas por concierge e por cirurgião: pacientes movidos, ações concluídas, % SLA cumprido.
4. **Financeiro** — soma de honorários por período, ticket médio, receita projetada (pacientes em `surgery_scheduled` + `preop_preparation`), quebra por convênio e hospital.

Botão "Exportar CSV" por seção.

## Detalhes técnicos

### Arquivos novos
- `src/components/FilterSheet.tsx` — wrapper mobile de `FilterBar` em `Sheet`
- `src/components/SortControl.tsx` — seletor de ordenação
- `src/pages/Pendencias.tsx` + `src/components/PendingActionRow.tsx`
- `src/pages/Relatorios.tsx` + `src/components/reports/*` (FunnelChart, LossReasonsChart, ProductivityChart, FinancialChart)
- `src/hooks/useReportData.ts` — agrega dados client-side a partir do cache de `usePatients`

### Arquivos alterados
- `src/App.tsx` — registrar `/pendencias` e `/relatorios`
- `src/components/PipelineDashboard.tsx` — integrar `FilterSheet` (mobile), `SortControl`, aplicar ordenação
- `src/components/PipelineColumn.tsx` — aceitar lista já ordenada
- `src/components/NavLink.tsx` — adicionar links "Pendências" e "Relatórios"

### Sem alterações de backend
Todos os agregados são calculados no cliente a partir dos dados já em cache (`usePatients` traz tudo). Ordenação é puramente client-side. Nenhuma migração SQL, nenhuma nova policy.

### Realtime / persistência
Reaproveita `useRealtimePatients` — a tela de pendências e o dashboard consomem o mesmo cache do Kanban, então mutations em qualquer tela propagam automaticamente para as outras.
