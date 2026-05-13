## Diagnóstico

O replay mostra o fluxo concluindo sem erro (spinner aparece e some, sem toast de falha), mas nenhum arquivo é baixado. Isso é típico de iframe da preview do Lovable bloqueando downloads programáticos: `<a download>.click()` em iframe sem `allow-downloads` é silenciosamente ignorado pelo navegador, sem lançar erro.

A tentativa anterior de `window.open` veio em branco porque a URL assinada do Storage com `?download=...` retorna `Content-Disposition: attachment`, e o navegador, ao receber attachment numa nova aba sem contexto, fecha a aba e mostra branco antes de baixar (ou bloqueia popup).

## Plano

1. **`src/components/PatientDocuments.tsx` — `handleDownload` com 3 estratégias em cascata + logs**
   - Gerar signed URL **sem** `download=` (URL "limpa") e **com** `download=filename` (URL attachment).
   - Tentativa A (preferida): `fetch(urlLimpa)` → blob → `URL.createObjectURL` → `<a download>.click()`. Logar `blob.size` e `blob.type`. Se size=0, abortar e ir para B.
   - Tentativa B (fallback): `window.open(urlAttachment, '_blank', 'noopener')`. Se `popup === null` (bloqueado), ir para C.
   - Tentativa C (último recurso): navegar a aba atual com `location.assign(urlAttachment)` — o Storage devolve `Content-Disposition: attachment`, então o navegador baixa sem trocar de página.
   - Em cada etapa, `console.info('[download] tentativa X', detalhes)` para vermos no replay/console qual ramo está falhando.
   - Toast só aparece se as 3 falharem.

2. **`src/hooks/useDocuments.ts` — `getDocumentSignedUrl`**
   - Aceitar opção `{ asAttachment?: boolean }` para gerar URL com ou sem `download`.
   - Logar erro real do Storage (`error.message`) quando `createSignedUrl` falhar — hoje só retornamos `null`.

3. **Verificação**
   - Após implementar, pedir para o usuário tentar de novo e abrir o console — os logs `[download] tentativa A/B/C` vão dizer exatamente onde para.

## Detalhes técnicos

- Não muda Edge Function nem assinatura criptográfica do PDF.
- Não muda RLS/Storage.
- Mudanças isoladas a `PatientDocuments.tsx` e `useDocuments.ts`.
- A estratégia C (location.assign na própria aba) funciona dentro de iframes mesmo quando `allow-downloads` está restrito, porque o navegador apenas inicia o download e mantém a página atual.