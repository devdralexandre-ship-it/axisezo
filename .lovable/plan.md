# Busca insensível a acentos

Hoje "Joao" não encontra "João" (e vice-versa) porque os filtros usam apenas `toLowerCase().includes()`, sem normalizar diacríticos.

## Correção

Criar helper `normalizeText(s)` em `src/lib/utils.ts`:

```ts
export function normalizeText(s: string | null | undefined) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
```

Aplicar em todos os pontos de busca por digitação:

1. **`src/components/PipelineDashboard.tsx`** (linha 119) — filtro do Kanban por nome/procedimento.
2. **`src/components/TaskFormFields.tsx`** (linha 92) — sugestões de título de ação.
3. **`src/components/CodeAutocomplete.tsx`** (linhas 69–72) — sugestões CBHPM/TUSS por código e rótulo.
4. **`src/components/ProcedureCombobox.tsx`** — passar `keywords={[normalizeText(p)]}` em cada `CommandItem` para que o filtro interno do `cmdk` também ignore acentos ao buscar procedimentos.
5. **`src/pages/AdminDuplicates.tsx`** — normalizar nomes ao agrupar duplicatas (opcional mas coerente: "João" e "Joao" viram o mesmo grupo). Confirmar com o usuário se quer isso ou apenas na busca.

## Fora de escopo

- Buscas server-side no Supabase (não há nenhuma dependendo de acento hoje).
- Alterações em labels/UI.

## Pergunta ao usuário

Aplicar a normalização também na detecção de duplicatas (item 5) ou apenas nos campos de busca?
