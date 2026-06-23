## Objetivos

1. Notificação evidente no login das concierges (pacientes novos + SLAs estourados).
2. Tela de ações reformulada (em todos os locais onde aparece).
3. Garantir realtime e persistência cross-screen.

---

## 1. Notificação de boas-vindas para concierges

**Onde aparece:** modal grande que abre automaticamente no primeiro acesso do dia, além do badge no sino atual.

**Conteúdo (duas seções):**
- **Novos pacientes na sua carteira** — pacientes onde `concierge = nome da usuária` criados desde o último login dela.
- **Tolerâncias estouradas** — ações ainda não concluídas cujo `prazo máximo + tolerância` já passou, das quais ela é responsável ou que escalaram para ela.

**Persistência do "último visto":** guardamos `last_seen_at` por usuário em `localStorage` (chave por user_id). Reabre o modal quando há itens novos desde então.

**Quem vê:** usuárias com role `concierge` (Margô, Íris). Outros papéis continuam só com o sino.

---

## 2. Tela de ações reformulada

Aplica-se a `AddTaskDialog`, ao bloco de ação dentro de `AddPatientForm` e a qualquer outro consumidor de `TaskFormFields`.

**Campos novos:**

| Campo | Comportamento |
|---|---|
| **Título** | Input livre com autocomplete. Sugestões = títulos distintos já usados em outras ações (consultados via React Query da tabela `tasks`, sem duplicar e ordenados por frequência/recência). Remove o seletor "Tipo de ação" e o conceito de presets fixos. |
| **Responsável** | Dropdown com **cirurgiões** (`SURGEONS`) + **concierges** (`CONCIERGES`, incluindo Íris). Remove "Call Center" como opção padrão da lista. |
| **Prazo máximo** | Data + hora. Pré-preenchido com **agora + 24h** ao abrir o formulário; editável. |
| **Tolerância (horas)** | Substitui "SLA (horas)". Conta a partir do prazo máximo (não da criação). Default 24h. |
| ~~Escalar após (h)~~ | Removido da UI. Fixado em 24h após o fim da tolerância. |

**Cálculo de `sla_due_at`:** `prazo_máximo + tolerância`. Trigger atual `set_task_sla_due_at` é reescrito para essa fórmula (em vez de `created_at + sla_hours`).

**Escalação:** continua marcando `escalated_at` 24h após `sla_due_at`. A ação **permanece visível** para a concierge responsável original E para o cirurgião do paciente (não troca o `responsible`). Watcher e UI passam a tratar `escalated_at` apenas como flag de severidade, sem reatribuir.

---

## 3. Realtime e persistência

- `useRealtimePatients` já cobre `patients` e `tasks` (debounce 1,5s). Verificar que está montado em **todas** as telas que mostram pacientes (Index/Kanban ✅; conferir Profile/Admin se exibirem listas) e nas dialogs que dependem das mesmas queries.
- Garantir que `AddPatientForm` e a edição do `PatientPanel` façam `invalidateQueries(['patients'])` no `onSuccess` (não só otimismo local), para que outras telas abertas (mesmo sem realtime) atualizem.
- Sugestões de título no autocomplete usam React Query com `staleTime` curto e mesma invalidação para refletir títulos recém-criados em outros pacientes.

---

## Detalhes técnicos

**Banco (migration):**
- Reescrever `set_task_sla_due_at()` para `due_date + due_time + sla_hours` (timezone America/Sao_Paulo).
- Backfill de `sla_due_at` para tasks existentes não concluídas.
- (Opcional) RPC `concierge_pending_summary()` retornando contagens de novos pacientes + SLAs estourados para o modal de login, evitando puxar tudo no cliente.

**Frontend:**
- `src/components/TaskFormFields.tsx`: remove preset, adiciona autocomplete (Command/Popover do shadcn), renomeia label, default prazo = now+24h, remove campo "escalar após".
- `src/components/AddTaskDialog.tsx` e `AddPatientForm.tsx`: ajustam `emptyTaskDraft`.
- `src/data/types.ts`: nova lista `TASK_RESPONSIBLES = [...SURGEONS, ...CONCIERGES]`; mantém `Owner` como union para retrocompatibilidade com tasks antigas (Call Center vira "legado" só exibido, não selecionável).
- `src/hooks/useTaskTitleSuggestions.ts` (novo): `SELECT DISTINCT title, count(*) FROM tasks GROUP BY title ORDER BY count DESC LIMIT 50`.
- `src/components/ConciergeLoginBriefing.tsx` (novo): modal disparado em `Index.tsx` quando `useUserRole().role === 'concierge'`, lê `last_seen_at` do localStorage, mostra duas listas clicáveis (abrem o PatientPanel).
- `NotificationBell` ganha um novo bucket "Escalada para mim (cirurgião)" para os médicos.

**Visibilidade pós-escalação:** notificações para o cirurgião quando `escalated_at IS NOT NULL` e `patients.surgeon = current_surgeon_name()`, mantendo também a notificação para a concierge responsável.

---

## Fora de escopo

- Não criamos tabela de notificações persistentes (continuam derivadas em memória).
- Sem mudança de roles/RLS.
- Sem alteração no Call Center existente em tasks antigas — apenas removido das novas opções.
