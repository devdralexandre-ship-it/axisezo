# Corrigir "Erro ao gerar: Load failed" no orçamento

## O que está acontecendo

O template de Orçamento usa o modo "PDF de fundo": antes de gerar o documento, o navegador precisa baixar o arquivo de papel timbrado do storage. Esse arquivo tem **3 MB** (verificado: `template-pdfs/f7eee8de-….pdf`, 3.010.480 bytes).

"Load failed" é a mensagem que o Safari dá quando um download de rede falha ou é interrompido — ou seja, o download do papel timbrado não completou. Hoje o código faz esse download uma única vez, sem tempo limite, sem nova tentativa e sem nenhuma mensagem explicativa; qualquer oscilação de rede derruba a geração inteira.

Não é problema dos dados do paciente nem do conteúdo do orçamento: o preview na tela é montado corretamente.

## O que será feito

1. **Nova tentativa automática**: até 3 tentativas de baixar o papel timbrado, com espera curta entre elas e tempo limite explícito.
2. **Cache na sessão**: uma vez baixado, o papel timbrado fica em memória enquanto a aba estiver aberta — o segundo, terceiro e demais documentos do dia não baixam 3 MB de novo.
3. **Mensagem de erro clara**: em vez de "Load failed", algo como "Falha ao baixar o papel timbrado do template (verifique a conexão e tente novamente)".
4. **Validação do arquivo baixado**: se o download vier incompleto/corrompido, o erro aponta isso em vez de quebrar dentro do gerador de PDF.
5. **Aviso na tela de templates**: sinalizar templates de fundo acima de ~1 MB, sugerindo substituir por uma versão comprimida (a compressão do arquivo atual, se desejada, pode ser feita em seguida — reduz muito a chance de falha em conexões móveis).

## Detalhes técnicos

- `src/hooks/useDocuments.ts`: extrair o `fetch(signedUrl)` para um helper `fetchTemplatePdfBytes(path)` com `AbortController` (timeout ~30 s), retry com backoff, cache `Map<path, ArrayBuffer>` em nível de módulo, e checagem de `resp.ok` + tamanho > 0 antes de passar para `renderInsidePdfTemplate`.
- Erros de rede passam a ser lançados como `Error` com mensagem em português; o `onError` do mutation continua exibindo a mensagem no toast.
- `src/pages/AdminTemplates` (tela de templates): badge de aviso quando o PDF de fundo excede 1 MB.
- Sem mudanças de schema nem de RLS.
