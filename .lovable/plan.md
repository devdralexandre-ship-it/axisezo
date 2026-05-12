## Diagnóstico

A signed URL é gerada corretamente, mas abre em branco porque o Storage devolve o PDF inline sem `Content-Disposition: attachment`. O Supabase Storage suporta forçar download adicionando o parâmetro `?download=<filename>` na signed URL — exatamente o que precisamos.

## Correção

**`src/hooks/useDocuments.ts`** — atualizar `getDocumentSignedUrl` para aceitar um nome de arquivo opcional e passar `{ download: filename }` ao `createSignedUrl`, fazendo o Storage incluir o cabeçalho `Content-Disposition: attachment; filename="..."`.

```ts
export async function getDocumentSignedUrl(pdfPath: string, downloadAs?: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(pdfPath, 600, downloadAs ? { download: downloadAs } : undefined);
  ...
}
```

**`src/components/PatientDocuments.tsx`** — em `handleDownload`:
- Passar o título como `downloadAs` (ex.: `"Solicitação Cirúrgica — Geraldo (assinado).pdf"`).
- Trocar `window.open` por um `<a href download>` clicado programaticamente. Como agora o servidor envia `attachment`, mesmo navegadores que ignoram o atributo `download` fazem o download em vez de exibir.
- Se o anchor click falhar, cair para `window.location.href = url` (que também respeitará o `attachment`).

Não há mudanças de DB, edge function ou políticas.

## Validação

- Clicar em "Baixar" → arquivo `.pdf` baixa direto, sem abrir aba.
- Clicar em "Baixar PDF assinado" → arquivo `... (assinado).pdf` baixa direto.