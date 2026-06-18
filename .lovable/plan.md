## Objetivo
Reduzir a CPU do banco (hoje ~96%) atacando a causa real: a query `usePatients` (JOIN pesado de 5 tabelas) está sendo reexecutada centenas de vezes por hora devido a invalidações de realtime em rajada.

## Mudanças

### 1. `src/hooks/usePatients.ts`
- Adicionar `staleTime: 30_000` e `refetchOnWindowFocus: false` no `useQuery(['patients'])`.
- Remover `contact_records` e `preop_checklist_items` do `select` principal (não usados nos cards do Kanban).

### 2. Novo hook `src/hooks/usePatientDetails.ts`
- Carrega `contact_records` + `preop_checklist_items` sob demanda, só quando o painel do paciente abre. Usado por `PatientPanel`.

### 3. `src/hooks/useRealtimePatients.ts`
- Debounce de 1.5 s antes de invalidar `['patients']`, agrupando rajadas de eventos (ex.: sla-watcher atualizando dezenas de tasks de uma vez) num único refetch.
- Mesmo debounce para `patient-uploads` e `patient-documents`.

### 4. Ajustar consumidores de `Patient.contacts`/`preOpChecklist`
- `PatientPanel` passa a usar `usePatientDetails(id)` para preencher essas seções.
- Cards do Kanban (`PatientCard`) não dependem delas — sem mudança visual.

### 5. (Verificação) índice do sla-watcher
- Conferir via `EXPLAIN` se `idx_tasks_sla_open` está sendo usado pelo UPDATE recorrente. Ajustar se necessário.

## Detalhes técnicos

**Por que isso resolve:** hoje cada UPDATE em `tasks`, `patients`, `contact_records`, `preop_checklist_items`, `pending_items`, `patient_uploads` ou `patient_documents` dispara um refetch da query mais cara do sistema (1,1 s de média, 1.676 chamadas registradas = >32 min de CPU só dessa variante). O sla-watcher sozinho faz milhares de UPDATEs/dia. Debounce + staleTime + payload menor reduz a frequência e o custo de cada refetch.

**Impacto esperado:** >80% menos CPU consumida pelas queries do Kanban. Pequeno atraso (~1,5 s) na propagação de mudanças entre usuários — aceitável para um CRM.

**Sem mudanças:** schema do banco, RLS, lógica de negócio, layout. Apenas frontend e (opcional) um índice.

## Fallback
Se após as otimizações a instância ainda ficar saturada com mais tráfego, recomendar ao usuário aumentar a instância em **Backend → Advanced settings → Upgrade instance**.
