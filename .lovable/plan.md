## Objetivo

Permitir selecionar **múltiplos hospitais desejados** para pacientes particulares e alterar a métrica de SLA de 24h para considerar cumprido apenas quando **um orçamento é anexado para cada hospital selecionado**.

## 1. Schema (migration)

- Adicionar coluna `desired_hospitals text[] NOT NULL DEFAULT '{}'` em `public.patients`.
- Backfill: `UPDATE patients SET desired_hospitals = ARRAY[desired_hospital] WHERE desired_hospital IS NOT NULL AND desired_hospital <> ''`.
- Manter `desired_hospital` (deprecado) para compatibilidade; passa a espelhar o primeiro item do array na escrita pela aplicação.

## 2. Tipos e formulário de cadastro

- `src/data/types.ts`: adicionar `desiredHospitals: string[]` ao tipo `Patient`.
- `src/hooks/usePatients.ts`: mapear `desired_hospitals` ↔ `desiredHospitals` no `mapRow` e nos inserts/updates.
- `src/components/AddPatientForm.tsx`:
  - Quando `billingType` = Particular, substituir o `Select` único de hospital por um **multi-select** (checkbox list em Popover) usando a mesma lista de hospitais + opção "Outro" com input livre para adicionar itens custom.
  - Para outros tipos de faturamento, manter comportamento atual (seleção única).
  - No submit: gravar `desiredHospitals` (array) e `desiredHospital` = primeiro item (para compat).
- `src/components/PatientPanel.tsx`: mesma alteração na edição do paciente.

## 3. Card, tabela e filtros

- `PatientCard`, `PatientsTable`, `FilterBar` (filtro Hospital), `CsvImporter`: exibir/filtrar por `desiredHospitals` (any-match). Para exibição resumida no card, mostrar `hospitals.join(' · ')` truncado.

## 4. Métrica de SLA (Relatorios.tsx)

Regra nova para particulares: SLA cumprido quando, dentro de 24h da criação do paciente, existir **um `patient_documents` do tipo `budget` para cada hospital em `desiredHospitals`**.

- Buscar todos os budgets do paciente (não só o primeiro), lendo também `data->>'hospital'` do jsonb.
- Para cada paciente particular:
  - `required` = `desiredHospitals` normalizados (fallback para `[desiredHospital]` se array vazio; se ambos vazios, considerar `required = ['—']` como hoje — 1 orçamento basta).
  - `covered` = subset de `required` que possui pelo menos um budget cujo `data.hospital` case (normalizado, sem acento) com o hospital.
  - `firstCompleteAt` = timestamp do budget que fechou o último hospital pendente.
  - Status:
    - `on_time` se `firstCompleteAt - createdAt ≤ 24h`
    - `late` se completou depois de 24h
    - `pending_ok` se ainda incompleto mas dentro do prazo
    - `pending_breached` se incompleto e prazo vencido
- Exibir na linha detalhada o progresso `covered/required` (ex.: "2/3 hospitais") e listar hospitais pendentes.

## 5. Detalhes técnicos

- Normalização de nomes de hospital via `normalizeText` já existente em `src/lib/utils.ts` para tolerar acento/caixa.
- Migration inclui `GRANT`? Não — apenas `ALTER TABLE ADD COLUMN`, grants existentes permanecem.
- Nenhuma mudança em políticas RLS.
- CSV importer: aceitar múltiplos hospitais separados por `;` ou `|` na coluna Hospital (opcional, retro-compatível: sem separador vira array de 1).

## Fora de escopo

- Alterações no fluxo de geração/PDF do orçamento em si (o `BudgetForm` continua com um hospital por documento — é isso que permite contar cobertura por hospital).
- Notificações automáticas por hospital pendente (pode virar próxima etapa).