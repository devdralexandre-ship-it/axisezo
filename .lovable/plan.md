
# Diagnóstico e plano de correção

## Problema 1 — "Por que preciso salvar antes do upload?"

**Não é necessário.** Foi uma decisão arbitrária de implementação: o `handlePdfUpload` exige `editing.id` para usar como nome do arquivo (`template-pdfs/{id}.pdf`). Se você ainda não salvou, não tem `id`, então o botão fica desabilitado e mostra a mensagem "Salve o template uma vez antes de enviar o PDF".

**Correção**: gerar um UUID no client no momento em que você clica em "Novo template" (via `crypto.randomUUID()`) e usar esse id já no `editing.id` desde o início. Quando salvar, o insert usa esse id em vez de deixar o banco gerar. Resultado: dá pra fazer upload de logo e PDF imediatamente, sem salvar antes. Mesma correção vale para a logo no modo HTML.

## Problema 2 — "Carregando PDF…" infinito + caixas verde/azul não aparecem

**Causa raiz**: incompatibilidade de versão do worker do PDF.js.

No `PdfTemplateEditor.tsx` o worker é carregado da CDN como `.mjs`:
```ts
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
```

Mas:
- `pdfjs-dist` instalado: **5.6.205**
- `react-pdf@10.4.1` internamente usa `pdfjs-dist@4.x` — então `pdfjs.version` resolve pra **4.x**, não 5.x
- Pior: a CDN cdnjs nem sempre tem o `.mjs` para todas as versões; e com versões mistas o worker rejeita silenciosamente carregar o documento → o `<Document>` fica preso em "Loading PDF…" para sempre, sem erro visível.

Como o `<Document>` nunca termina de carregar, o `onRenderSuccess` da `<Page>` nunca dispara, `metrics` permanece `null`, e o `useEffect` que cria as caixas default (verde e azul) nunca roda. Por isso você não vê nada.

**Correção**:
1. Servir o worker **localmente** a partir do próprio bundle, garantindo casamento de versão exato com a `pdfjs-dist` que `react-pdf` está usando:
   ```ts
   import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
   pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
   ```
   O `?url` do Vite resolve pro asset versionado correto e evita a CDN.
2. Adicionar fallback de erro visível no `<Document>` (`onLoadError`, prop `error`) para que, se algo falhar, apareça uma mensagem em vez de "Carregando…" eterno.
3. Renderizar as caixas verde/azul **mesmo antes** do `metrics` estar pronto, usando posições default em pixels durante o loading — e re-posicionar quando o PDF termina de renderizar. Assim, mesmo num cenário de fallback, você vê a UI.
4. Garantir que a página é renderizada com `onLoadSuccess` na `<Page>` também (não só `onRenderSuccess`), porque `onRenderSuccess` depende do canvas estar pintado — em telas pequenas/lentas pode demorar e dar a sensação de travado.

## Arquivos afetados

- `src/components/PdfTemplateEditor.tsx`: trocar workerSrc para local + handlers de erro + inicialização mais robusta de `metrics`.
- `src/pages/Templates.tsx`: 
  - Em `startNew`, gerar `id: crypto.randomUUID()` e iniciar `editing` com ele.
  - Remover guards `!editing.id` dos botões de upload de logo e PDF e das mensagens "Salve o template antes…".
  - Em `handleLogoUpload`/`handlePdfUpload`, remover o `if (!editing.id)` early return.
- `src/hooks/useDocuments.ts → useSaveTemplate`: passar `id` no insert payload quando vier do client (em vez de deixar o banco gerar). Isso é seguro: o tipo da coluna já é `uuid` com default; aceitar um valor explícito não muda nada.

## Verificação

1. `/templates` → "Novo template" → "Solicitação Cirúrgica" → ir direto na tab **PDF Timbrado** → clicar "Enviar PDF" → upload acontece sem precisar salvar antes.
2. PDF carrega em poucos segundos, primeira página aparece, caixas verde (conteúdo) e azul (assinatura) aparecem sobre ela com tamanhos default.
3. Arrastar/redimensionar as caixas funciona; coordenadas em mm aparecem nos rótulos.
4. Clicar Salvar → template salvo com `pdf_template_path` + `content_box` + `signature_box` populados.
5. Templates já existentes (HTML mode) continuam funcionando normalmente.

## Limitação

Se um cirurgião subir um PDF com mais de 1 página, o editor visual mostra só a página 1 — a estratégia de continuação ("repetir mesmo timbre") já está cuidando do resto na geração. Sem mudança aqui.

Aprove para corrigir.
