## Objetivo

Quando um paciente for arrastado para a coluna **Cirurgia Agendada**, abrir um diálogo pedindo a data da cirurgia (e horário opcional). A data fica salva no paciente e aparece no card e no painel.

## Mudanças

### 1. Banco
- Adicionar coluna `surgery_date` (date, nullable) e `surgery_time` (time, nullable) na tabela `patients`.
- Migração simples, sem mudança de RLS.

### 2. Diálogo novo `SurgeryDateDialog`
- Espelha o padrão do `LossReasonDialog`.
- Campos: data (obrigatório, usando o shadcn DatePicker com Popover+Calendar) e horário (opcional, input time).
- Botões "Confirmar" e "Cancelar". Cancelar aborta a movimentação.

### 3. `PipelineDashboard.tsx`
- Igual ao fluxo de "lost": ao detectar `newStage === 'surgery_scheduled'` no `handleDragEnd`, guardar `pendingSurgeryDrag` e abrir o diálogo em vez de mover direto.
- `handleSurgeryDateConfirm`: aplica update otimista (stage + surgeryDate + surgeryTime), chama `updateStage.mutate` com os novos campos, faz rollback em erro.
- `handleSurgeryDateCancel`: fecha sem mover.
- Se o paciente já estiver em `surgery_scheduled` e for movido para outra coluna e voltar, o diálogo abre de novo (sempre pede confirmação da data).

### 4. `useUpdatePatientStage` (`src/hooks/usePatients.ts`)
- Aceitar `surgeryDate?: string | null` e `surgeryTime?: string | null` nos parâmetros e incluir no `update` quando presentes (ou quando `stage !== 'surgery_scheduled'`, limpar para null — opcional, podemos manter o histórico; vou **manter** os valores caso volte).

### 5. `types.ts`
- Adicionar `surgeryDate?: string | null` e `surgeryTime?: string | null` em `Patient`.
- Mapear em `mapDbToPatient` em `usePatients.ts`.

### 6. Exibição
- `PatientCard.tsx`: quando `stage === 'surgery_scheduled'` e `surgeryDate` existir, mostrar uma badge/linha "Cirurgia: dd/mm/aaaa [hh:mm]".
- `PatientPanel.tsx`: mostrar a data abaixo do bloco da etapa quando aplicável; permitir editar via um pequeno botão "Alterar data" que reabre o `SurgeryDateDialog` (reaproveitando o componente, sem alterar stage).

## Detalhes técnicos

- Datas seguem o padrão já usado no projeto (`YYYY-MM-DD` salvo no banco, formatado para PT-BR na UI com `date-fns/format` + locale `ptBR`).
- O `SurgeryDateDialog` usa `Calendar` com `className="p-3 pointer-events-auto"` para funcionar dentro do `Dialog`.
- Sem mudanças de RLS — a coluna nova herda as policies existentes (`can_access_patient`).
- Não introduz dependência nova.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` (nova migração)
- `src/data/types.ts`
- `src/hooks/usePatients.ts`
- `src/components/SurgeryDateDialog.tsx` (novo)
- `src/components/PipelineDashboard.tsx`
- `src/components/PatientCard.tsx`
- `src/components/PatientPanel.tsx`
