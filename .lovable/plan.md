# Novos filtros, badges e sinalizador "Novo"

## 1. Novos filtros no Kanban

Adicionar 5 novos filtros na `FilterBar`, ao lado dos existentes:

- **Convênio** (`payer`)
- **Tipo de faturamento** (`billingType`)
- **Hospital desejado** (`desiredHospital`)
- **Origem/Indicação** (reutiliza `indicationLocation`)
- **Data de indicação** (`indicationDate`) — range com dois date pickers ("De" / "Até")

Todos como `Select` (exceto data) com opção "Todos". Listas vindas de `src/data/constants.ts` (adicionar `PAYERS`, `BILLING_TYPES`, `HOSPITALS`, `INDICATION_SOURCES` se ainda não existirem — verificar e reutilizar).

Integração em `PipelineDashboard.tsx`: novos estados + predicados no `useMemo` de filtragem. Filtros compactados em segunda linha para não estourar largura; considerar botão "Limpar filtros" quando qualquer filtro estiver ativo.

## 2. Badges de sinalização no paciente

Três flags booleanas independentes, editáveis:

| Campo | Ícone | Cor | Tooltip |
|---|---|---|---|
| `clinicallySensitive` | `*` | vermelho (destructive) | "Clinicamente sensível" |
| `highRisk` | `**` | vermelho intenso | "Altíssimo risco" |
| `highTicket` | `★` | âmbar/gold | "Alto ticket" |

**Onde editar:**
- `AddPatientForm.tsx` — nova seção "Sinalizadores" com 3 checkboxes.
- `PatientPanel.tsx` — mesmos 3 checkboxes no cabeçalho ou aba principal, editáveis a qualquer momento.

**Onde exibir:**
- `PatientCard.tsx` — sempre visíveis ao lado do nome (linha de badges compacta).
- `PatientPanel.tsx` — badges destacados no topo.

## 3. Badge "Novo" persistente

Mudar a regra atual (24h) para: **o badge permanece até qualquer edição do registro do paciente**.

Implementação: comparar `patient.updatedAt` com `patient.createdAt`. Se forem iguais (ou diferença < X segundos para tolerar o insert inicial), mostrar "✨ Novo". Qualquer save/mutation atualiza `updatedAt` e o badge some.

- Remover a lógica `newSinceIso` de `PatientCard`.
- Garantir que todas as mutations (mudança de stage, edição de campos, conclusão de tarefa, adição de contato, etc.) atualizem `updatedAt` — trigger no banco ou no hook `usePatients`.

## Detalhes técnicos

### Banco (migration)

```sql
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS clinically_sensitive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS high_risk boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS high_ticket boolean NOT NULL DEFAULT false;

-- Trigger update_updated_at_column já existe; garantir que está attachada a public.patients
```

### Tipos

Adicionar ao `Patient` em `src/data/types.ts`:
```ts
clinicallySensitive: boolean;
highRisk: boolean;
highTicket: boolean;
updatedAt: string; // já vem do banco
```

### Arquivos afetados

- `supabase/migrations/*` (novo) — 3 colunas booleanas
- `src/data/types.ts` — novos campos
- `src/data/constants.ts` — listas fixas de payer/billing/hospital/origem (verificar existentes)
- `src/hooks/usePatients.ts` — mapear novos campos, garantir touch em `updatedAt`
- `src/components/FilterBar.tsx` — 5 novos filtros
- `src/components/PipelineDashboard.tsx` — estados + predicados + reset
- `src/components/AddPatientForm.tsx` — checkboxes de sinalizadores
- `src/components/PatientPanel.tsx` — checkboxes editáveis + badges no header
- `src/components/PatientCard.tsx` — renderizar badges (*, **, ★) e nova lógica do "Novo"

## Fora do escopo

- Cálculo automático de "alto ticket" por valor (usuário optou por manual).
- Novos campos de origem além do `indicationLocation`.
