## Objetivo

1. Desativar a abertura automática do modal de briefing da concierge (desktop e mobile).
2. Redirecionar concierges automaticamente para `/pendencias` ao fazer login, tanto no desktop quanto no mobile.

## Mudanças

### 1. `src/components/ConciergeLoginBriefing.tsx`
No hook `useConciergeBriefing`, remover o `useEffect` que faz `setOpen(true)` automaticamente (linhas ~154-184) e o flag `autoopen` no localStorage. O modal continua existindo e pode ser aberto manualmente via `openManually()` (usado em algum botão do header, se houver) — apenas nunca abre sozinho.

### 2. Redirecionar concierge para `/pendencias` no login

Em `src/App.tsx`, na rota `/`, envolver `<Index />` num pequeno wrapper (ou ajustar `ProtectedRoute`) que:
- Aguarda `useAuth` + `useUserRole` carregarem.
- Se `role === 'concierge'` **e** for a primeira navegação da sessão (flag em `sessionStorage`, ex.: `concierge-landed:<userId>`), faz `<Navigate to="/pendencias" replace />` e grava o flag.
- Caso contrário, renderiza `<Index />` normalmente.

Usar `sessionStorage` (não `localStorage`) para que:
- O redirect ocorra uma vez por sessão de login (não fica preso — a concierge ainda pode navegar para `/` manualmente depois).
- Vale igualmente no mobile, pois é o mesmo App/rota.

Nenhuma mudança em Auth.tsx é necessária — o redirect já leva para `/`, e o wrapper decide o destino final.

## Fora de escopo
- Não mexer no conteúdo da tela `/pendencias` nem no `Index`/Kanban.
- Não remover o componente `ConciergeLoginBriefing`; permanece disponível para abertura manual futura.