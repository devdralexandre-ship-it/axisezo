# Diagnóstico

Versão instalada vs. versão usada por `react-pdf`:
- Top-level `pdfjs-dist`: **5.6.205**
- `react-pdf@10.4.1` resolve internamente `pdfjs-dist@5.4.296` (vê em `node_modules/react-pdf/node_modules/pdfjs-dist`)

Quando `PdfTemplateEditor.tsx` faz:
```ts
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
```
Vite resolve isso pra **5.6.205** (top-level). Mas o `import { pdfjs } from 'react-pdf'` traz a API da **5.4.296**. Worker e API com versões diferentes → o pdfjs aborta o carregamento e dispara `onLoadError`, que agora aparece pra você como "Não foi possível carregar o PDF".

## Correção

Alinhar `pdfjs-dist` top-level com a versão que `react-pdf` realmente usa, garantindo um único worker compatível.

### Passos

1. Em `package.json`, fixar:
   ```json
   "pdfjs-dist": "5.4.296"
   ```
   (sem `^`, exatamente a versão que `react-pdf@10.4.1` declara como dependência).

2. Reinstalar para deduplicar.

3. Manter `PdfTemplateEditor.tsx` usando o import local (`pdfjs-dist/build/pdf.worker.min.mjs?url`) — agora vai bater com a API da `react-pdf`.

4. Adicionar log explícito de versão no editor para ajudar diagnóstico futuro:
   ```ts
   console.info('pdfjs API version:', pdfjs.version);
   ```

## Arquivos afetados

- `package.json` — pinning de `pdfjs-dist` para `5.4.296`.
- `src/components/PdfTemplateEditor.tsx` — adicionar `console.info` de versão (1 linha) para confirmar alinhamento.

## Verificação

1. Recarregar app, abrir `/templates`, novo template, modo PDF Timbrado, subir um PDF.
2. Console mostra `pdfjs API version: 5.4.296` e nenhum erro de versão de worker.
3. PDF renderiza, caixas verde/azul aparecem sobre a primeira página.
4. Templates HTML continuam funcionando (não tocamos nesse caminho).

## Por que isso resolve

A causa raiz não é CDN nem `?url` — é deduplicação de dependência. Com versões alinhadas no top-level, `Document.file` e o worker conversam na mesma "linguagem" (mesmo schema de mensagens internas do pdfjs). Pinning é a forma mais limpa de garantir isso sem hacks de alias no Vite.
