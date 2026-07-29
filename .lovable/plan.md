# Nova coluna: Potencial de indicação cirúrgica

Adicionar uma coluna no Kanban antes de "Indicação" para pacientes em acompanhamento (exames, laudos, patologias que podem virar cirurgia). Pacientes nessa coluna não entram em métricas até serem movidos para "Indicação".

## O que muda para o usuário

- Nova coluna à esquerda de "Indicação" no Kanban (desktop, mobile e Pendências).
- Ao cadastrar paciente, é possível já colocá-lo nessa coluna.
- Cards funcionam normalmente (ações, tolerância, anexos, documentos, badge "Novo").
- Métricas que excluem esse estágio:
  - Cabeçalho do Kanban: total no pipeline, valor total, conversão.
  - **Relatórios**: KPIs (pipeline, conversão, ticket médio, receita projetada), funil, perdidos, receita por convênio, produtividade por concierge, SLA orçamento particulares.
- Métricas que continuam contando esses pacientes:
  - Notificação de "novo paciente" para a concierge (acompanhamento especial exige atenção imediata).
  - Ações/tolerância desses pacientes na tela **Pendências**.

## Alterações técnicas

1. **Migração**: adicionar valor `surgical_potential` ao enum `pipeline_stage` (antes de `indication`).
2. **`src/data/types.ts`**: incluir `'surgical_potential'` no início de `PIPELINE_STAGES` e rótulo `"Potencial de indicação"` em `STAGE_LABELS`.
3. **`src/components/PipelineDashboard.tsx`**: novo helper `METRIC_STAGES` que exclui `lost` e `surgical_potential`; ajustar `totalValue`, `completedCount`, `conversionRate` para usar esse conjunto (mantendo `activeFiltered` para renderização de colunas).
4. **`src/pages/Relatorios.tsx`**: filtrar `surgical_potential` de `active`, `funnelData`, `particulares` (SLA orçamento) e demais agregações. Excluir do funil (`PIPELINE_STAGES.filter(s => s !== 'lost' && s !== 'surgical_potential')`).
5. **`src/components/CsvImporter.tsx`**: aceitar alias `potencial` → `surgical_potential` no mapa de estágios.
6. **`src/hooks/useUserRole` / RLS**: nenhuma alteração — a política já cobre qualquer stage.

Não requer alteração em `PipelineColumn`, `PatientCard`, `PatientPanel` ou `AddPatientForm` além do enum expandido (eles já iteram `PIPELINE_STAGES`).
