# Correções e melhorias — ações, códigos, procedimentos, anexos, mobile

## 1. Responsável da ação sempre "Alexandre"

**Causa:** `emptyTaskDraft()` em `src/components/TaskFormFields.tsx` faz fallback para `TASK_RESPONSIBLES[0]` (primeiro cirurgião = Dr Alexandre) quando nenhum `defaultResponsible` é passado.

**Correção:**
- Permitir `responsible` vazio (`''`) em `TaskDraft`; remover fallback para o primeiro cirurgião.
- `emptyTaskDraft(defaultResponsible?)` usa, em ordem: `defaultResponsible` → `''` (não atribuído).
- `TaskFormFields`: adicionar opção "— não atribuído —" no Select e placeholder "Selecionar responsável".
- `AddPatientForm`: passar `concierge` (state atual) como `defaultResponsible` ao criar/resetar draft; se `concierge` mudar antes do usuário editar o campo, atualizar o draft.
- `PatientPanel` → `AddTaskDialog`: passar `defaultResponsible={patient.concierge}`.
- Persistência: se `tasks.responsible` for NOT NULL, migração para tornar nullable e ajustar leitura para exibir "—".

## 2. Códigos CBHPM/TUSS com autocomplete a partir de usos anteriores

Autocomplete já lê `procedure_code_suggestions` (por `procedure + kind`), mas a tabela não é populada. Ajustes:
- Criar helper `recordCodeSuggestions(procedure, entries[])` que faz `upsert` incrementando `usage_count`.
- Chamar ao salvar solicitação cirúrgica (`GenerateDocumentDialog`/`SurgicalRequestForm`) e ao criar/editar paciente com códigos preenchidos (`AddPatientForm`, `PatientPanel`).
- Rotular o campo como "CBHPM/TUSS" (mesmo `kind='cbhpm'`, já que o usuário trata como sinônimo).

## 3. Procedimento com busca por digitação

Substituir o `<Select>` de procedimento por **Combobox** (`components/ui/command` + `popover`) com input de busca filtrando `PROCEDURES` por substring case-insensitive, mantendo "Outro…". Aplicar em `AddPatientForm.tsx` e `PatientPanel.tsx` (modo edição).

## 4. Mudar etapa do paciente no mobile

Mobile hoje usa `disableDnd`. Duas superfícies para mover:

a. **Botão "Mover" no card mobile** — abre `Sheet` com radio das etapas; confirma via `updateStage`.
b. **Seletor de etapa no cabeçalho do `PatientPanel`** — sempre visível (útil também no desktop).

Handler central: extrair `moveStageWithGuards(patientId, newStage, fromStage)` de `handleDragEnd` para reuso, preservando os fluxos especiais de `lost` (`LossReasonDialog`) e `surgery_scheduled` (`SurgeryDateDialog`).

## 5. Inconsistência ao anexar documentos — "carregado 0 documentos"

**Causa confirmada:** em `PatientUploads.handleFiles`, o `toast.success` dispara antes da lista invalidar; o texto usa `files.length` fixo e o painel adjacente mostra "0" porque o `useQuery` ainda não refetchou. Além disso, se algum arquivo falhou dentro do loop, o sucesso é reportado igual.

**Correção em `src/components/PatientUploads.tsx` e `src/hooks/usePatientUploads.ts`:**
- Rodar uploads em `Promise.allSettled`, contar `ok` e `fail`.
- Toast: `"N arquivo(s) enviado(s)"` apenas quando `ok > 0`; `"X falha(s) ao enviar"` quando `fail > 0`. Se `ok === 0 && fail === 0`, não mostrar nada.
- `await qc.invalidateQueries({ queryKey: ['patient-uploads', patientId] })` **antes** do toast final, para o contador do cabeçalho refletir os novos arquivos.
- Remover o texto "carregado 0 documentos" onde quer que apareça (label do cabeçalho continua com `uploads.length` real, que agora estará atualizado).
- Adicionar validação prévia de tamanho antes do loop.

---

## Arquivos afetados
- `src/components/TaskFormFields.tsx`
- `src/components/AddPatientForm.tsx`
- `src/components/PatientPanel.tsx`
- `src/components/PatientCard.tsx`
- `src/components/PipelineDashboard.tsx`
- `src/components/SurgicalRequestForm.tsx` / `GenerateDocumentDialog.tsx`
- `src/components/PatientUploads.tsx`
- `src/hooks/usePatientUploads.ts`
- Novo helper: `src/hooks/useCodeSuggestions.ts`
- (Se necessário) migração: `tasks.responsible` nullable.