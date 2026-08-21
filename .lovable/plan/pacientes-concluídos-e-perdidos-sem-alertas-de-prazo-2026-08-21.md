# Pacientes concluídos e perdidos sem alertas de prazo

## O que está acontecendo hoje

Verifiquei no banco: os pacientes em **Cirurgia realizada** e **Perdido / não procedeu** continuam com ações abertas antigas, e por isso ficam em vermelho no Kanban.

- Cirurgia realizada: 79 pacientes, 37 ações abertas (a maioria já estourada/escalada) e 44 pacientes sem nenhuma ação — que hoje mostram o aviso "⚠ Sem próxima ação definida".
- Perdido / não procedeu: 116 pacientes, 68 ações abertas e 49 sem ação.

As ações abertas são resíduos do fluxo anterior ("Confirmar status", "Retorno quanto aos orçamentos", etc.), todas com vencimento de meses atrás.

Na Central de Pendências esses dois estágios já são ignorados; o problema aparece no Kanban, na planilha e no sino de notificações (que hoje ignora apenas "Perdido", não "Cirurgia realizada").

## O que será feito

### 1. Estágios finais não geram alerta

Tratar **Cirurgia realizada** e **Perdido / não procedeu** como estágios encerrados:

- Sem o aviso vermelho "Sem próxima ação definida" — no lugar, um selo neutro "Sem pendências".
- Ações abertas que existam nesses estágios deixam de aparecer em vermelho: continuam visíveis (para os casos de exceção), mas em tom neutro, sem selo de prazo estourado/escalado.
- Sem notificações de atraso no sino para esses pacientes.
- O vigia de prazos (rotina automática) deixa de marcar estouro e de escalar ações de pacientes nesses dois estágios.

### 2. Exceção quando ainda houver algo a fazer

Nada impede criar uma ação para um paciente já concluído ou perdido (ex.: recuperar paciente, pendência de documento). A ação continua funcionando e aparece no card com sua data — apenas não gera alarme vermelho nem escalonamento. Se o paciente voltar para outro estágio, os alertas voltam a valer normalmente.

### 3. Limpeza única das pendências antigas

Encerrar as 105 ações abertas dos pacientes que hoje estão nesses dois estágios, deixando todos como "Sem pendências".

Recomendação: **remover** essas ações em vez de marcá-las como concluídas, porque elas nunca foram efetivamente executadas e marcá-las como concluídas inflaria os relatórios de produtividade das concierges com trabalho que não aconteceu. Se preferir preservar o histórico, posso marcá-las como concluídas com a data em que o paciente entrou no estágio final — diga qual opção prefere.

Isso não apaga notas, documentos, anexos ou o histórico de contatos — só as ações pendentes.

## Detalhes técnicos

- Novo helper em `src/data/types.ts`: `isTerminalStage(stage)` para `surgery_completed` e `lost`, e variantes de `getTaskUrgency`/`getTaskSlaState` que recebem o paciente e retornam estado neutro em estágio final.
- `src/components/PatientCard.tsx`: substituir o bloco vermelho de "sem próxima ação" por selo neutro em estágio final; suprimir chip de SLA e cores de urgência; `breachedCount` passa a ignorar estágios finais.
- `src/components/PipelineDashboard.tsx`: o `useMemo` de notificações passa a ignorar ambos os estágios finais (hoje só ignora `lost`).
- `src/components/PatientsTable.tsx`: coluna "Próxima ação" sem realce vermelho em estágio final.
- `supabase/functions/sla-watcher/index.ts`: excluir tarefas cujo paciente esteja em estágio final antes de marcar `sla_breached_at` / escalar.
- Limpeza de dados via operação de dados (não migração): `delete from tasks where completed = false and patient_id in (select id from patients where stage in ('surgery_completed','lost'))`.
- Verificação: recontar ações abertas nesses estágios (esperado 0) e conferir um card de cada coluna no preview.
