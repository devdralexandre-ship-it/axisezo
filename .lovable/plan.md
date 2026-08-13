# Correção do link de paciente + Prazos máximos por tipo de ação

## 1. Pendências: abrir a ficha do paciente

Hoje, ao clicar no nome do paciente na Central de Pendências, o app navega para `/?patient=<id>`, mas o Kanban não lê esse parâmetro — por isso só a tela do Kanban aparece.

Correção: o Kanban passa a ler o parâmetro `patient` da URL ao carregar e abre automaticamente o painel individual daquele paciente (mesmo comportamento em desktop e mobile). Depois de abrir, o parâmetro é limpo da URL para não reabrir ao voltar.

## 2. Prazos máximos por tipo de ação

### Como vai funcionar

- Toda ação passa a ter obrigatoriamente um **tipo** (catálogo), além do título livre.
- Cada tipo tem um **prazo máximo** (em horas) e uma **tolerância padrão**.
- Ao escolher o tipo, a data/hora limite já vem preenchida com o prazo do tipo.
- Se a concierge tentar escolher uma data além do limite, o sistema bloqueia e só libera mediante **justificativa obrigatória** (texto). A ação salva fica marcada como "prazo estendido", com o motivo e quem autorizou registrados.
- Ações com prazo estendido aparecem sinalizadas na Central de Pendências e viram uma métrica no relatório (quantidade, % por concierge, motivos mais usados) — assim o desvio fica visível em vez de escondido.

### Tela de administração de tipos de ação

Nova página `/admin/tipos-acao` (somente admin), acessível pelo menu de administração:

- Lista dos tipos: nome, prazo máximo (h), tolerância padrão (h), ativo/inativo.
- Criar, editar, desativar tipos.
- Catálogo inicial pré-carregado (valores ajustáveis por você depois):

| Tipo de ação | Prazo máx. | Tolerância |
|---|---|---|
| Ligar para o paciente | 24h | 24h |
| Enviar orçamento / material | 24h | 24h |
| Consultar convênio | 48h | 24h |
| Consultar hospital | 48h | 24h |
| Checar documentos | 48h | 24h |
| Emitir documentos | 48h | 24h |
| Solicitar exames / laudos | 72h | 24h |
| Confirmar agendamento | 24h | 24h |
| Atualizar etapa no follow-up | 24h | 24h |
| Outro (genérico) | 48h | 24h |

Ações já existentes não são alteradas retroativamente; a regra vale para novas ações e para edições de prazo.

## Detalhes técnicos

**Frontend**
- `PipelineDashboard.tsx`: `useSearchParams` para `?patient=<id>` → `setSelectedPatient` + `setPanelOpen(true)` e limpeza do parâmetro.
- `TaskFormFields.tsx`: novo `Select` de tipo de ação (obrigatório) alimentado pelo catálogo; título mantém o autocomplete. Ao trocar o tipo, recalcula `dueDate`/`dueTime` e `slaHours`. Validação client-side do teto, com campo de justificativa exibido quando ultrapassado.
- `AddTaskDialog.tsx` / edição de ação no `PatientPanel`: repassam tipo e justificativa.
- `Pendencias.tsx`: badge "Prazo estendido" nas linhas com justificativa.
- `Relatorios.tsx`: bloco novo "Prazos estendidos" (contagem, % sobre ações criadas, quebra por concierge) + CSV.

**Banco**
- Nova tabela `task_types` (nome, `max_hours`, `default_tolerance_hours`, `active`, ordem) com GRANTs, RLS: leitura por usuários autenticados; escrita apenas admin (`has_role`). Seed com o catálogo acima.
- Em `tasks`: colunas `task_type_id`, `deadline_override_reason`, `deadline_override_by`, `deadline_override_at`.
- Trigger em `tasks` (BEFORE INSERT/UPDATE) valida `due_date + due_time` contra o `max_hours` do tipo, medido a partir da criação da ação; se exceder e não houver justificativa, rejeita. Se houver justificativa, grava os campos de override. Isso garante a regra também fora da UI.
- `set_task_sla_due_at` continua responsável pela tolerância e escalonamento de 24h.
