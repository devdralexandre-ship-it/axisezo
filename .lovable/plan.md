# Refinamento estético — EZO Urologia

Aplicar identidade visual institucional sóbria ao CRM, sem logo gráfico, com wordmark textual, mantendo PDFs neutros.

## 1. Tokens de cor — `src/index.css`

Substituir o bloco `:root` (modo claro, único tema ativo) pelos novos tokens HSL. Conversão das cores hex do manual:

```text
Deep Medical Teal   #003F3C → 177 100% 12%   (primary, ring, sidebar-primary)
Muted Teal          #0F766E → 174 77% 26%    (primary hover, accent ativo)
Charcoal Gray       #3F3F3F → 0 0% 25%       (foreground)
Muted Gray          #6B7280 → 220 9% 46%     (muted-foreground)
Warm White          #FAFAF8 → 60 14% 98%     (background)
Soft White          #FFFFFF → 0 0% 100%      (card, popover)
Light Clinical Gray #E5E7EB → 220 13% 91%    (border, input, divisórias)
Sucesso             #166534 → 142 61% 24%
Atenção             #B45309 → 30 91% 37%
Crítico             #991B1B → 0 72% 35%
Info / andamento    #1D4ED8 → 224 76% 48%
```

Mapeamento aos tokens existentes:
- `--background` Warm White; `--foreground` Charcoal
- `--card`, `--popover` Soft White; foregrounds Charcoal
- `--primary` Deep Teal; `--primary-foreground` branco
- `--secondary`, `--accent`, `--muted` cinza muito claro (`220 14% 96%`); foregrounds Charcoal
- `--muted-foreground` Muted Gray
- `--border`, `--input` Light Clinical Gray; `--ring` Deep Teal
- `--destructive` Crítico
- `--radius` 0.75rem (cards 12–16px)
- Pipeline tokens (mantêm os nomes para não quebrar componentes):
  - `--pipeline-blue` → Info (`224 76% 48%`)
  - `--pipeline-green` → Sucesso (`142 61% 24%`)
  - `--pipeline-amber` → Atenção (`30 91% 37%`)
  - `--pipeline-gray` → Muted Gray
- Sidebar:
  - `--sidebar-background` Deep Teal; `--sidebar-foreground` branco/teal claro
  - `--sidebar-primary` branco; `--sidebar-accent` Muted Teal
  - `--sidebar-border` teal escuro translúcido
- Bloco `.dark` será removido (sistema fica somente em modo claro, conforme memória do projeto).

Adicionar tokens semânticos extras para badges:
- `--status-success`, `--status-warning`, `--status-critical`, `--status-info` (e respectivos `-foreground` escuros), usados em fundos claros.

Atualizar `@import` da fonte:
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap');
```
`body` passa a usar `Inter`. Remover IBM Plex Sans.

## 2. `tailwind.config.ts`

- Estender `fontFamily`:
  - `sans: ['Inter', 'system-ui', 'sans-serif']`
  - `serif: ['"Cormorant Garamond"', 'Georgia', 'serif']` (para wordmark)
- Estender `colors` com tokens semânticos: `success`, `warning`, `critical`, `info` (apontando para os novos CSS vars).
- `borderRadius` mantém ligado a `--radius` (agora 0.75rem).
- Sem alterações de breakpoints, container ou animações.

## 3. Wordmark "EZO Urologia"

Componente leve inline (não criar logo gráfico). Usado em três lugares:

- **Sidebar/Header** (`src/components/PipelineDashboard.tsx`, linha do `h1` "Axis"):
  ```tsx
  <h1 className="leading-none">
    <span className="font-serif text-2xl font-semibold text-primary tracking-wide">EZO</span>
    <span className="ml-1.5 font-sans text-xs uppercase tracking-[0.2em] text-muted-foreground">Urologia</span>
  </h1>
  ```
- **Auth** (`src/pages/Auth.tsx`): substituir `<CardTitle>Axis</CardTitle>` pelo mesmo wordmark, centralizado, em tamanho maior.
- **`index.html`**: atualizar `<title>` e og/twitter para "EZO Urologia — Gestão da Jornada Cirúrgica". Comentário em `CsvImporter.tsx` linha 16: trocar "Axis" por "EZO".

Sem ícone, sem símbolo, sem SVG.

## 4. Componentes que serão alterados (apenas estilo)

Todos via tokens — sem alterar lógica, props, estados ou fluxos:

- `src/index.css`, `tailwind.config.ts` — base de tokens e fontes.
- `src/components/ui/button.tsx` — ajustar `variant.default` para usar Deep Teal (já vem via token); adicionar hover Muted Teal (`hover:bg-[hsl(var(--primary-hover))]` via novo token `--primary-hover`); `outline` ganha hover `bg-muted`.
- `src/components/ui/badge.tsx` — adicionar variantes `success`, `warning`, `critical`, `info` (fundo claro + texto escuro + borda sutil); manter as existentes.
- `src/components/ui/card.tsx` — `rounded-xl`, `shadow-none` (ou `shadow-[0_1px_2px_rgba(0,0,0,0.04)]`), borda padrão `border-border`.
- `src/components/ui/input.tsx`, `textarea.tsx`, `select.tsx` — bordas e focus ring Deep Teal (já via token).
- `src/components/ui/table.tsx` — divisórias horizontais `border-border`, hover `bg-muted/40`.
- `src/components/ui/tabs.tsx`, `dialog.tsx`, `sheet.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `tooltip.tsx`, `sonner.tsx` — verificação de que tokens novos renderizam bem (geralmente sem mudança de classes).
- `src/components/ui/sidebar.tsx` — confirmar uso dos tokens `--sidebar-*` (já parametrizado).
- `src/components/PipelineDashboard.tsx` — wordmark; ajustar header para fundo branco com borda inferior `border-border`; títulos em `text-primary`.
- `src/components/PipelineColumn.tsx` — cabeçalho de coluna sóbrio (texto `text-muted-foreground uppercase tracking-wide text-[11px]`, contagem em badge neutra), fundo `bg-muted/40`.
- `src/components/PatientCard.tsx` — manter densidade; trocar cores de urgência para tokens `success/warning/critical`; nome em `text-foreground`, procedimento em `text-muted-foreground`.
- `src/components/PatientPanel.tsx`, `FilterBar.tsx`, `NotificationBell.tsx`, `FollowUpTimeline.tsx`, `PreOpChecklist.tsx`, `PatientDocuments.tsx`, `LossReasonDialog.tsx`, `DeletePatientDialog.tsx`, `AddPatientForm.tsx`, `AddTaskDialog.tsx`, `CsvImporter.tsx`, `GenerateDocumentDialog.tsx`, `BudgetForm.tsx`, `MedicalCertificateForm.tsx`, `PrescriptionForm.tsx`, `ReportForm.tsx`, `SurgicalRequestForm.tsx`, `CodeAutocomplete.tsx` — varredura para substituir cores hardcoded (ex.: classes `bg-blue-*`, `text-green-*`, `bg-pipeline-*`) por tokens semânticos novos. Sem mudança estrutural.
- `src/pages/Auth.tsx` — wordmark, fundo `bg-background` (Warm White), card `shadow-none border-border`.
- `src/pages/AdminUsers.tsx`, `Templates.tsx`, `Index.tsx`, `NotFound.tsx`, `ResetPassword.tsx` — herdam tokens; pequenos ajustes pontuais de espaçamento/títulos se necessário.
- `index.html` — title e meta tags.

## 5. Componentes que NÃO serão alterados

- **Templates de PDF e geração de documentos médicos** — permanecem neutros:
  - `src/lib/pdf-generator.tsx`
  - `src/lib/pdf-template-renderer.ts`
  - `src/components/PdfTemplateEditor.tsx`
  - `src/data/documents.ts` (HTML builders de receita, atestado, relatório, orçamento, solicitação cirúrgica)
- **Edge functions** (`supabase/functions/admin-users`).
- **Lógica de hooks** (`useDocuments`, `usePatients`, `useUserRole`) e contexto `AuthContext`.
- **Schema/migrations Supabase**.
- **Tipos e dados** (`src/data/types.ts`, `constants.ts`) — exceto se precisarem de mapeamento de cor (não precisam).

## 6. Confirmação explícita sobre PDFs

Os documentos clínicos formais — **receitas, atestados, relatórios médicos, solicitações cirúrgicas, orçamentos, declarações** — permanecerão com o estilo neutro atual. Nenhuma classe Tailwind, token CSS ou fonte do refinamento institucional será aplicada aos arquivos de geração/template de PDF. A nova paleta e tipografia ficam restritas à interface React do CRM.

## 7. Direção visual aplicada

- Header: fundo branco, borda inferior `border-border`, wordmark à esquerda, ações à direita.
- Sidebar: Deep Teal sólido, itens em branco/teal claro, item ativo com fundo Muted Teal.
- Cards: brancos, borda fina, raio 12–16px, sombra praticamente ausente.
- Botões primários Deep Teal, hover Muted Teal; secundários brancos com borda.
- Badges: fundos claros derivados das cores funcionais com texto escuro e borda sutil.
- Kanban: colunas em fundo Warm White/cinza muito leve, cabeçalhos em caixa alta discreta, cards compactos.
- Tipografia: Inter para UI; Cormorant Garamond apenas no wordmark "EZO".

## 8. Fora de escopo

- Lógica funcional, fluxos, RLS, banco de dados, autenticação.
- Templates e renderização de PDFs.
- Criação de logo, ícones decorativos, ilustrações.
- Modo escuro (mantido apenas modo claro, conforme memória do projeto).

Após sua aprovação, troco para o modo de implementação e aplico as mudanças nesta ordem: tokens (`index.css` + `tailwind.config.ts`) → wordmark (header, sidebar, auth, index.html) → ajustes de componentes UI base (button, badge, card, table) → varredura de cores hardcoded nas telas.