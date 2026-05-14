## Sistema de Papéis e Permissões Granulares

Hoje cada papel (admin/cirurgião/concierge/call_center) já vem com um pacote fixo de permissões "embutido" no código e nas RLS. Vamos manter os papéis (que controlam **escopo de pacientes**) e adicionar uma camada de **capacidades** ligáveis por usuário (que controlam **o que ele pode fazer e ver**).

### 1. Papéis (definem QUAIS pacientes a pessoa vê)

| Papel | Vê quais pacientes |
|------|--------------------|
| **Admin** | Todos |
| **Cirurgião** | Apenas os do próprio nome |
| **Concierge** | Apenas os do próprio nome |
| **Call Center** | Todos |
| **Estagiária** *(novo)* | Todos (conforme escolhido) |

Continua sendo possível dar mais de um papel à mesma pessoa.

### 2. Capacidades granulares (ligadas/desligadas por usuário)

Sugestão de catálogo inicial (você marca por usuário no formulário de edição):

**Financeiro**
- `view_financials` — Ver honorários, orçamentos, valor estimado, totais da pipeline
- `edit_financials` — Editar honorários médicos, anestesia, hospital, materiais

**Pacientes**
- `edit_clinical` — Editar dados clínicos (procedimento, lateralidade, alertas)
- `move_pipeline` — Arrastar entre estágios do Kanban
- `delete_patients` — Deletar pacientes
- `assigned_only` — *Restritor*: ver apenas pacientes onde for explicitamente atribuído (sobrepõe o escopo do papel, exceto Admin)

**Documentos & Biblioteca**
- `generate_documents` — Gerar/assinar documentos
- `manage_templates` — Criar/editar templates PDF
- `manage_library` — Criar/editar materiais e pacotes de orientação

**Operacional**
- `import_csv` — Importar CSV / exportar dados
- `view_dashboard` — Ver métricas globais (valor da pipeline, conversão, SLA)
- `manage_users` — Criar, editar, resetar senha de usuários (hoje só Admin)

### 3. Presets rápidos (atalho na UI de criação)

Para não obrigar marcar checkbox por checkbox, ofereceremos botões de preset que pré-marcam o conjunto:

- **Acesso pleno** — todas as capacidades ligadas (equivalente a Admin antigo)
- **Operacional sem financeiro** — tudo, exceto `view_financials` e `edit_financials` (perfil clássico de Call Center / Estagiária)
- **Cirurgião padrão** — financeiro + clínico + documentos + biblioteca, sem `manage_users` nem `delete_patients`
- **Concierge padrão** — clínico + mover pipeline + documentos, sem financeiro nem dashboard global
- **Estagiária restrita** — somente pacientes atribuídos a ela (`assigned_only` ligado), sem financeiro, sem deletar
- **Customizado** — você marca manualmente

### 4. Atribuição direta de pacientes (para `assigned_only`)

Adicionar campo `assigned_user_ids` no paciente (lista). No painel do paciente, um seletor "Atribuir a..." permite ligar usuários específicos. Quem tiver `assigned_only` só vê pacientes onde seu user_id estiver na lista.

### 5. Fluxo na tela de Administração de Usuários

Ao criar/editar usuário:
```text
┌─ Identidade ──────────────────────────────┐
│ Nome, email, senha temporária             │
└───────────────────────────────────────────┘
┌─ Papel (escopo de pacientes) ─────────────┐
│ ☑ Admin  ☐ Cirurgião  ☐ Concierge         │
│ ☐ Call Center  ☐ Estagiária               │
│  → (campos condicionais: nome cirurgião…) │
└───────────────────────────────────────────┘
┌─ Capacidades (o que pode fazer) ──────────┐
│ Preset: [Pleno][Sem financeiro][Cirurgião]│
│         [Concierge][Restrita][Custom]     │
│                                           │
│ Financeiro                                │
│  ☑ Ver valores                            │
│  ☐ Editar financeiro                      │
│ Pacientes                                 │
│  ☑ Editar dados clínicos                  │
│  ☑ Mover no Kanban                        │
│  ☐ Deletar pacientes                      │
│  ☐ Restringir aos pacientes atribuídos    │
│ Documentos & Biblioteca…                  │
│ Operacional…                              │
└───────────────────────────────────────────┘
```

### 6. Reflexo na UI

- `view_financials = false` → esconde colunas/cards financeiros (já temos a flag `canSeeFinancials`, vamos generalizá-la).
- `delete_patients = false` → esconde botão de excluir.
- `move_pipeline = false` → desabilita drag-and-drop.
- `manage_library = false` → esconde "Biblioteca" no header.
- `view_dashboard = false` → esconde widgets de métricas globais.
- E assim por diante. Cada componente sensível consultará `usePermissions()`.

---

## Detalhes técnicos

**Banco**
- Nova tabela `user_capabilities (user_id uuid PK, caps jsonb default '{}'::jsonb, updated_at)` armazenando as flags ligadas.
- Nova coluna `patients.assigned_user_ids uuid[] default '{}'`.
- Função `has_capability(_uid uuid, _cap text) returns boolean` (security definer, lê do jsonb).
- Atualizar `can_access_patient` para considerar `assigned_only`: se o usuário tem essa cap, exige `auth.uid() = ANY(assigned_user_ids)`.
- Atualizar políticas RLS de `patients DELETE` para usar `has_capability(auth.uid(), 'delete_patients')` em vez de só `has_role(admin)`.
- RLS de `materials/templates/library`: liberadas para quem tem `manage_library` / `manage_templates`.

**Frontend**
- Estender `useUserRole` → renomear/agrupar como `usePermissions` retornando `{ roles, caps, can(cap), assignedOnly }`.
- `AdminUsers.tsx`: adicionar bloco de capacidades + presets no `UserDialog`. Adicionar `Estagiária` em `ROLE_OPTIONS` e no enum `app_role`.
- `admin-users` edge function: aceitar `caps` no create/update e gravar em `user_capabilities`.
- Componentes que hoje usam `isAdmin` ou `canSeeFinancials` passam a usar `can('...')`.
- Painel do paciente: novo seletor "Atribuído a" (multi-usuário) que escreve em `assigned_user_ids`.

**Migração de dados existentes (idempotente)**
- Para cada usuário atual, gravar capacidades equivalentes ao papel:
  - admin → todas
  - call_center → tudo exceto `view_financials`, `edit_financials`, `manage_users`, `manage_templates`, `delete_patients`
  - surgeon → ver/editar financeiro + clínico + documentos + biblioteca + dashboard
  - concierge → clínico + mover + documentos + biblioteca, sem financeiro

Assim ninguém perde acesso no momento da migração.

---

## Escopo desta implementação
1. Migração SQL (tabela, coluna, função, policies, seed de capabilities)
2. Edge function `admin-users` aceitando `caps`
3. UI da tela `/admin/users` com presets + checkboxes
4. Hook `usePermissions` + refactor dos pontos sensíveis (financeiro, deletar, mover, biblioteca, dashboard)
5. Seletor "Atribuído a" no painel do paciente

Aprovando o plano, começo pela migração e em seguida a UI.
