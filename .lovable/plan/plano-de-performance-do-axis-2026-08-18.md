# Plano de performance do Axis

Investiguei o banco e o frontend. O gargalo principal está no backend, não na tela.

## Diagnóstico (medido)

- A consulta que carrega o Kanban (pacientes + ações + contatos + checklist + pendências) tem **média de 1,2 a 2,1 segundos** por chamada, com picos de **7,6s**, e foi executada ~9.000 vezes. É de longe o maior consumo do banco.
- A base é pequena (51 MB, memória em 45%, conexões 22/60). Ou seja: **não é falta de máquina** — é a forma como a permissão é avaliada.
- Causa: a regra de acesso `can_access_patient(id)` recebe o ID do paciente como parâmetro, então o banco a executa **uma vez para cada linha** — paciente, cada ação, cada contato, cada item de checklist e cada pendência. São milhares de execuções por carregamento, e cada uma consulta as tabelas de papéis/permissões.
- Falta índice em `pending_items(patient_id)` (as outras tabelas filhas já têm).
- A lista de sugestões de título de ação lê 500 ações do banco (média 526 ms, 1.334 chamadas) e é recarregada junto com o Kanban.
- No frontend, todas as páginas (relatórios com gráficos, editor de PDF, assinatura, biblioteca) são carregadas de uma vez no primeiro acesso, mesmo sem serem usadas — isso pesa no tempo de abertura inicial.

## O que será feito

### 1. Reescrever a avaliação de permissão (maior ganho)
Trocar a função por parâmetro por funções **sem parâmetro** que resolvem o escopo do usuário uma única vez por consulta (é admin? tem restrição "somente atribuídos"? qual o nome de cirurgião/concierge?). As políticas passam a comparar direto as colunas da linha.

Efeito esperado: de milhares de execuções por carregamento para poucas dezenas — a consulta deve cair para a casa das dezenas/centenas de milissegundos, sem mudar quem vê o quê.

Nas tabelas filhas (ações, contatos, checklist, pendências) a checagem passa a ser uma busca direta por chave primária do paciente, também com escopo resolvido uma vez.

### 2. Índices
- Criar índice em `pending_items(patient_id)`.
- Criar índice em `patients(created_at DESC)` para a ordenação da listagem.

### 3. Reduzir chamadas repetidas
- Sugestões de título de ação: deixar de recarregar a cada mudança no Kanban e aumentar a validade do cache (1 hora), já que é dado praticamente estático.
- Manter o debounce de tempo real já existente, mas evitar recarregar a consulta pesada quando o próprio usuário acabou de salvar (o cache local já foi atualizado).

### 4. Carregamento inicial mais leve
- Carregar as páginas sob demanda (relatórios, biblioteca, modelos, admin, documentos/PDF) em vez de tudo no primeiro acesso, com um indicador de carregamento entre telas.
- Separar as bibliotecas pesadas (gráficos e geração/visualização de PDF) para que só sejam baixadas quando a tela correspondente for aberta.

### 5. Validação
- Rodar `EXPLAIN ANALYZE` antes/depois na consulta do Kanban e reportar os tempos.
- Conferir o carregamento pelo navegador (tempo até o Kanban aparecer) e verificar que admin, concierge e cirurgião continuam vendo exatamente os mesmos pacientes de hoje.

## Detalhes técnicos

- Novas funções `SQL STABLE SECURITY DEFINER` sem argumentos (`current_is_admin()`, `current_scope_assigned_only()`, `current_surgeon_name()` já existe), permitindo que o Postgres as avalie como InitPlan (uma vez por consulta) em vez de por linha.
- Políticas `SELECT` reescritas em `patients`, `tasks`, `contact_records`, `preop_checklist_items`, `pending_items`. Sem alteração nas políticas de INSERT/UPDATE/DELETE nesta etapa.
- Frontend: `React.lazy` + `Suspense` nas rotas em `src/App.tsx`; ajuste de `staleTime` em `useTaskTitleSuggestions`; refinamento das invalidações em `useRealtimePatients`.

Não é necessário aumentar o tamanho da instância — memória e conexões estão folgadas; o problema é o custo por consulta.
