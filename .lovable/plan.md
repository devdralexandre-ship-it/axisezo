

## Problema

Ao baixar um documento gerado, abre uma aba em branco. O console mostra `Can't find variable: Buffer` no momento da geração — `@react-pdf/renderer` precisa do polyfill do `Buffer` do Node para funcionar no navegador. Sem ele, o blob salvo no storage é inválido/vazio, então quando a aba abre o PDF, não há nada para renderizar.

Há também um problema menor: o download usa `window.open(signedUrl)` que abre o PDF inline em vez de forçar download.

## Solução

### 1. Adicionar polyfill do `Buffer` no entry do app

Instalar `buffer` (pacote npm que reimplementa o Buffer do Node em JS puro) e expô-lo globalmente no `src/main.tsx` antes de qualquer import que use `@react-pdf/renderer`:

```ts
import { Buffer } from 'buffer';
(globalThis as any).Buffer = Buffer;
```

Isso resolve o erro de geração — os PDFs passam a ser gerados corretamente como blobs PDF válidos.

### 2. Reprocessar documentos já criados (orientação ao usuário)

Os documentos gerados antes do fix estão corrompidos no storage. Vou orientar a excluir e regerar (são poucos, recém-criados na sessão atual).

### 3. Forçar download em vez de abrir aba

Em `src/components/PatientDocuments.tsx`, trocar `window.open(url, '_blank')` por um download via `fetch` + blob + anchor com atributo `download`, conforme o padrão recomendado:

```ts
const res = await fetch(url);
const blob = await res.blob();
const blobUrl = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = blobUrl;
a.download = `${doc.title}.pdf`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(blobUrl);
```

Isso garante que clicar em "Baixar" salve o arquivo direto, sem abrir aba.

## Arquivos afetados

- `package.json` (+`buffer`)
- `src/main.tsx` (polyfill no topo)
- `src/components/PatientDocuments.tsx` (download via blob)

## Verificação

1. Recarregar app → console não mostra mais `Can't find variable: Buffer`.
2. Gerar um novo documento → clicar "Baixar" → arquivo PDF é salvo no Downloads e abre normalmente em qualquer leitor.
3. Documentos antigos corrompidos: excluir e regerar.

## Limitação

Documentos gerados antes do fix permanecem corrompidos no storage e precisam ser excluídos/regerados manualmente — não há como "consertar" o blob inválido após o fato.

