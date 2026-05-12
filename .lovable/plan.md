## Problema

Os botões "Baixar PDF assinado" e "Baixar" disparam o handler, mas o download não acontece e nenhum erro aparece. Isso normalmente ocorre porque:

1. O fluxo atual faz `fetch(signedUrl) → blob → <a download>.click()`. Em alguns navegadores/contextos (especialmente quando o clique parte de dentro de um Sheet/Dialog do Radix que pode estar desmontando o nó), o `a.click()` programático é silenciosamente ignorado.
2. Se o `fetch` falhar por CORS/política do Storage, o erro é engolido pelo `catch` sem log — então o usuário só vê "nada acontecendo".

## Plano de correção

Arquivo único: `src/components/PatientDocuments.tsx`

Reescrever `handleDownload` para um caminho mais simples e confiável:

- Pedir a signed URL via `getDocumentSignedUrl(pdfPath)`.
- Se falhar → `toast.error` (mantém o feedback).
- Se obtiver a URL → abrir diretamente em nova aba com `window.open(url, '_blank', 'noopener,noreferrer')`. Como o bucket retorna `Content-Disposition: attachment` para PDFs assinados (e mesmo quando não retorna, o usuário consegue baixar pelo visualizador), isso garante que o clique sempre produz uma ação visível.
- Adicionar `console.error` no catch e quando a URL vier nula, para facilitar debugging futuro.
- Como bônus, evitar que o clique do botão burbulhe e dispare seleção do card: chamar `e.stopPropagation()` no `onClick` dos dois botões de download.

Não é necessário alterar políticas de Storage, edge function, hooks ou qualquer outro arquivo — o `signed_pdf_path` gravado pelo `sign-pdf` continua dentro de `patient_id/...`, então a RLS do bucket `patient-documents` já autoriza o `createSignedUrl`.

## Validação

- Clicar em "Baixar" num documento não assinado → abre/baixa o PDF original.
- Clicar em "Baixar PDF assinado" num documento assinado → abre/baixa o PDF com a assinatura ICP-Brasil.
- Caso a signed URL falhe, ver toast de erro e mensagem no console.