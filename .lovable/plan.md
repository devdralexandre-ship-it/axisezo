# Fase 2 — SLA por ação/tarefa pendente

## Objetivo
Cada tarefa pendente passa a ter prazo formal (SLA). O sistema marca quando o SLA estoura, e quando passa do tempo de tolerância sem conclusão, escala automaticamente para um responsável superior (admin/cirurgião). UI deixa visível o que está vencendo, vencido e escalado.

## 1. Banco de dados

### Migração na tabela `tasks`
Adicionar colunas:
- `sla_hours` (int, default 24) — janela do SLA em horas a partir da criação.
- `sla_due_at` (timestamptz) — calculado `created_at + sla_hours`. Usado em vez de `due_date+due_time` para o relógio do SLA (mantém `due_date/due_time` como prazo "humano").
- `sla_breached_at` (timestamptz, null) — quando o cron detectou o estouro.
- `escalate_after_hours` (int, default 24) — tolerância após o estouro antes de escalar.
- `escalated_at` (timestamptz, null).
- `escalated_to` (text, null) — papel/nome alvo da escalação ("admin" ou nome do cirurgião responsável).
- `escalation_reason` (text, null).

### Nova tabela `sla_policies`
Configuração por `preset` (mesmo campo já existente em `tasks.preset`) e `responsible` (papel). Colunas: `preset`, `responsible`, `sla_hours`, `escalate_after_hours`, `escalate_to_role`. RLS: leitura para qualquer autenticado, escrita só admin. Se não houver linha para o preset, usa default global (24h / 24h / admin).

### Backfill
Popular `sla_due_at` das tarefas existentes com `created_at + 24h`.

## 2. Edge function `sla-watcher` (cron 15 min)

Roda com service role:
1. **Detectar breach**: `UPDATE tasks SET sla_breached_at = now() WHERE completed = false AND sla_breached_at IS NULL AND sla_due_at < now()`.
2. **Escalar**: para tarefas com `sla_breached_at IS NOT NULL`, `escalated_at IS NULL`, `completed = false`, e `now() - sla_breached_at >= escalate_after_hours`:
   - Resolver alvo: admin global, ou cirurgião responsável pelo paciente.
   - Atualizar `escalated_at = now()`, `escalated_to = <nome>`.
   - Inserir registro em `contact_records` (type=`system`, by_whom=`SLA Watcher`, note descrevendo a escalação) para deixar trilha no painel do paciente.
3. Retornar contagem de breaches/escalações para log.

Agendamento via `pg_cron` + `pg_net` (insert tool, não migration).

## 3. UI

### Hook `usePatients.ts`
- Mapear novos campos (`slaDueAt`, `slaBreachedAt`, `escalatedAt`, `escalatedTo`, `slaHours`).
- Ao criar tarefa, aceitar `slaHours` opcional; default 24.

### Cards do Kanban (`PipelineDashboard`)
- Para cada paciente, contar tarefas: `slaDanger` (faltando <2h ou já vencida), `escalated`. Mostrar badge compacto:
  - 🟡 `SLA -1h` (próxima do vencimento)
  - 🔴 `Atrasada Xh` (vencida)
  - 🟣 `Escalada` (escalonada)
- Filtro novo no topo: "Apenas SLA estourado" e "Apenas escaladas".

### `PatientPanel` — bloco de tarefas
- Cada item exibe: prazo humano + chip de SLA (`SLA 23h`, `Vencida 4h`, `Escalada para Dr. Fulano`).
- Cor de fundo da linha muda conforme estado.
- Ordenação: escaladas → vencidas → próximas do vencimento → demais.
- Form de nova tarefa ganha campo opcional "SLA (h)" com sugestão do `preset`.

### Página admin `/admin/sla` (admin only)
- Lista global de tarefas vencidas/escaladas, agrupada por responsável (concierge/owner do paciente).
- Permite reatribuir responsável da tarefa ou marcar concluída.
- Editor de `sla_policies` por preset.

## 4. Testes manuais
1. Criar tarefa com SLA 1h → após 1h cron marca `sla_breached_at`, card mostra "Atrasada".
2. Não concluir por mais 1h (com `escalate_after_hours=1`) → cron grava `escalated_at`, badge "Escalada", entrada em contact_records.
3. Concluir tarefa → some dos filtros de SLA, mantém histórico.
4. Tarefa sem `preset` herda defaults.

## 5. Ordem de execução
1. Migração de schema + backfill (precisa aprovação).
2. Edge function `sla-watcher` + cron (insert tool após migração).
3. Hook + tipos.
4. Badges no Kanban + filtros.
5. Painel do paciente.
6. Página admin `/admin/sla`.

## Notas técnicas
- Não usar CHECK constraints com `now()` — usar trigger se precisar validar `sla_due_at >= created_at`.
- `escalated_to` é texto livre por simplicidade (não há tabela de "alertas/notificações" ainda; se a equipe quiser notificação push/email depois, adicionamos uma tabela `notifications` em fase própria).
- Toda lógica de escalação fica na edge function — frontend só lê estado.
