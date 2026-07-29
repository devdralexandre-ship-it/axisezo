## Objetivo

Reorganizar `Relatorios.tsx` em três análises principais de conversão + SLA, deixar clara a semântica dos filtros, permitir combiná-los e exportar cada bloco em CSV. Corrigir a métrica de SLA de orçamento para considerar apenas o **orçamento preliminar** (primeiro orçamento anexado), independentemente do número de hospitais desejados.

## Definições

- **Filtro de data = data de indicação** do paciente (`indicationDate`, com fallback para `createdAt` quando ausente). Isso será rotulado explicitamente na UI.
- **Filtros combinam entre si** (AND lógico): data + concierge + cirurgião já se cruzam hoje; vamos deixar isso explícito na UI e adicionar dois filtros novos (recorte financeiro e convênio) que também combinam.
- **Particular (financeiro do médico)**: `billingType ∈ { 'Honorários Médicos Particulares', 'Custos Totais Particulares' }`.
- **Convênio**: `billingType ∈ { 'Cooperuro', 'Unicooper' }`.
- **Taxa de conversão**: `realizadas / (realizadas + perdidos)` dentro do recorte.
- `surgical_potential` continua fora de todas as métricas.

## 1. Barra de filtros — clareza e combinação

Em `src/pages/Relatorios.tsx`:

- Rotular o range de datas como **"Indicação: de ___ até ___"** (label visível, não só tooltip).
- Adicionar uma linha de ajuda curta abaixo: *"Filtros se combinam (E lógico). Cada bloco abaixo pode ser exportado em CSV com os filtros atuais aplicados."*
- Adicionar dois novos filtros combináveis:
  - **Recorte financeiro**: Todos / Particulares / Convênio.
  - **Convênio específico** (`payer`): Todos + lista dinâmica.
- Botão global **"Exportar tudo (CSV)"** no header que gera um zip conceitual — na prática, dispara um único CSV consolidado com uma aba por bloco separada por linha em branco + título, OU faz download sequencial de um CSV por bloco (escolho a segunda opção por simplicidade; sem dependência nova).

## 2. Bloco "Conversão — Particulares"

- Taxa geral do recorte particular + quebra em "Custos Totais Particulares" e "Honorários Médicos Particulares" (cada um com % e `n/N`).
- Contadores: em andamento, realizadas, perdidas, ticket médio realizado.
- Gráfico de barras horizontal comparando os dois sub-tipos.
- Top motivos de perda dentro do recorte.
- Botão **CSV** local (uma linha por paciente).

## 3. Bloco "Conversão — Convênio"

Espelha o bloco de particulares:
- Taxa geral do recorte convênio + quebra por `payer` (top 5 + "outros").
- Contadores equivalentes + ticket médio realizado.
- Gráfico de barras horizontal por convênio.
- Motivos de perda no recorte.
- Botão **CSV** local.

## 4. SLA orçamento — Particulares (24h) — CORREÇÃO

Mudança na lógica em `Relatorios.tsx` (bloco "budgetSla"):

- O SLA passa a ser cumprido quando **existe pelo menos um `patient_documents` do tipo `budget`** para o paciente dentro de 24h do cadastro — trata-se do "orçamento preliminar/primário".
- **Não** verifica mais cobertura por hospital. Múltiplos hospitais desejados continuam sendo cadastrados e usados na geração de orçamentos definitivos, mas não entram no cálculo do SLA preliminar.
- Recorte do universo permanece: `billingType` contém "particular" (mantém ambos os sub-tipos).
- Status:
  - `on_time` se o primeiro `budget` foi criado ≤ 24h após `createdAt`.
  - `late` se o primeiro `budget` existe, mas veio depois de 24h.
  - `pending_ok` se ainda não tem `budget` e o prazo não venceu.
  - `pending_breached` se ainda não tem `budget` e o prazo venceu.
- Remover a coluna "Hospitais faltantes" do CSV e da lista de estourados; adicionar coluna "Primeiro orçamento em (h)" quando houver.
- Manter o texto explicativo curto: *"Considera o primeiro orçamento (preliminar) anexado no Axis, independentemente de quantos hospitais foram selecionados."*

## 5. Exportação CSV — padrão

- Cada card com análise ganha um botão `CSV` próprio (já existente no SLA; adicionar em Particulares e Convênio).
- Header ganha botão **"Exportar tudo"** que dispara em sequência os CSVs de: recorte filtrado bruto (pacientes + campos-chave), Conversão Particulares, Conversão Convênio, SLA Orçamento, Funil, Motivos de perda, Produtividade por concierge, Receita por convênio.
- Todos os CSVs respeitam os filtros ativos e usam o helper `downloadCsv` já existente.

## Detalhes técnicos

- Toda lógica adicional roda client-side sobre o array retornado por `usePatients`, mais a query já existente para `patient_documents` (agora simplificada — sem precisar ler `data->hospital`).
- Reaproveitar `patientValue`, `downloadCsv`, `fmtCurrency`, `CHART_COLORS`.
- Blocos novos ficam como componentes internos em `Relatorios.tsx`; se algum passar de ~80 linhas, extrair para `src/components/reports/`.
- `canSeeFinancials`: valores em R$ e ticket ficam ocultos quando falso; % e contagens permanecem.
- Sem alteração de schema, RLS, hooks ou tipos.

## Fora de escopo

- Métricas complementares (aging por estágio, cohort, heatmap por motivo × concierge) — deixo para uma próxima rodada, após você validar essa reorganização.
- Nenhuma mudança no fluxo de criação/edição de orçamento em si.
