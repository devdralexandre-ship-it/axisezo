## Diagnóstico do bug

`PipelineDashboard` está assim:

```text
<div class="flex flex-col h-screen">
  <header>  ← largura natural (logo + 7 botões + email + sino + métricas + filtros)
  <div class="flex-1 overflow-auto">  ← rolagem horizontal do Kanban
```

Em tablet/celular o header é mais largo que a viewport e não tem `overflow` controlado, então a página inteira fica horizontalmente rolável. Quando o usuário rola para o lado para ver as colunas do Kanban, dois eixos de rolagem se desencontram (o do `<body>` e o do contêiner do Kanban) e o layout "quebra" visualmente.

## Solução — apenas frontend, em `src/components/PipelineDashboard.tsx`

### 1. Conter o overflow no contêiner raiz
- Adicionar `overflow-hidden` ao wrapper `flex flex-col h-screen`. Apenas o contêiner do Kanban rola horizontalmente; a página nunca rola.
- `min-w-0` nos filhos flex relevantes para evitar largura forçada.

### 2. Header responsivo enxuto no celular

**Desktop (≥ md)** — comportamento atual: tudo visível em uma linha (logo, métricas, filtros e todos os botões).

**Mobile (< md)** — layout compacto:

```text
┌──────────────────────────────────────────────┐
│ EZO Urologia        🔔  [+ Paciente]   [☰]   │ ← linha 1
├──────────────────────────────────────────────┤
│ Ativos: 24   Conversão: 38%   Perdidos: 3    │ ← linha 2 (rola horiz. se preciso)
├──────────────────────────────────────────────┤
│ 🔍 Buscar…   [Cirurgião ▾] [Procedimento ▾]  │ ← linha 3 (FilterBar com flex-wrap)
└──────────────────────────────────────────────┘
```

Em evidência no mobile:
- **Logo EZO**
- **Sino de notificações**
- **Botão "+ Paciente"** (sólido, primário)
- **FilterBar** completo (já tem `flex-wrap`, vai quebrar naturalmente)
- **Métricas principais** (Ativos / Conversão / Perdidos)

Recolhidos em um menu **☰ (hamburger / `DropdownMenu`)** no mobile:
- Email do usuário (no topo do menu)
- Perfil
- Templates
- Biblioteca *(se `manage_library`)*
- Usuários *(se admin/`manage_users`)*
- Importar CSV *(se `import_csv`)*
- Filtros de SLA (Todos / SLA estourado / Escaladas)
- Pipeline (valor financeiro, se `view_financials`) — como item informativo
- Sair

No desktop esse menu fica oculto (`md:hidden`); todos os botões voltam à linha do header como hoje (`hidden md:inline-flex`).

### 3. Header `sticky` + `shrink-0`
Reforça que o header pertence ao viewport e não ao "mundo" do Kanban.

### 4. Linha de métricas
Aplicar `flex-wrap gap-y-2` para não causar overflow horizontal. No mobile, esconder as métricas que vão para o menu (mantendo só Ativos / Conversão / Perdidos).

## Resultado esperado

- **Desktop**: nenhuma mudança visual.
- **Tablet/celular**: header em 3 linhas curtas com hamburger, sem overflow horizontal da página; o Kanban rola lateralmente apenas dentro de sua área, sem desalinhar com o header. Acesso a todas as funções permanece via menu ☰.

## Arquivos afetados

- `src/components/PipelineDashboard.tsx` — apenas classes Tailwind, wrappers e adição de um `DropdownMenu` mobile (sem mudança de lógica de negócios nem de permissões).
