# Corrigir "Erro ao gerar" e documento sem PDF (não clicável)

## O que está acontecendo

Verificado no banco: o documento "Orçamento — RTU de bexiga" do Albertino foi criado às 17:32, mas está com o **arquivo PDF ausente** (`pdf_path` vazio). Por isso ele aparece na lista após recarregar a página, mas não abre ao clicar.

Sequência real do bug:
1. O PDF é montado no navegador em cima do papel timbrado do template (arquivo de 3 MB no storage).
2. O registro do documento é gravado no banco.
3. O envio do PDF para o storage falhou por rede ("Load failed" é a mensagem do Safari para download/upload interrompido).
4. Como a falha veio depois da gravação, sobrou um documento "órfão", sem arquivo — e nada avisa o usuário disso na lista.

## O que será feito

1. **Gravar o registro só depois do upload dar certo**: inverter a ordem — enviar o PDF primeiro, gravar o documento com o caminho do arquivo em seguida. Assim uma falha de rede não deixa registro quebrado.
2. **Nova tentativa automática** (até 3 tentativas, com espera curta) tanto no download do papel timbrado quanto no envio do PDF final.
3. **Cache do papel timbrado na sessão**: os 3 MB são baixados uma vez por aba, não a cada documento.
4. **Mensagens de erro claras** em português, indicando a etapa que falhou, em vez de "Load failed".
5. **Recuperar documentos sem arquivo**: na lista de documentos do paciente, marcar os que estão sem PDF com um aviso e um botão "Regerar PDF", que refaz o arquivo a partir do conteúdo já salvo — inclusive para o orçamento do Albertino que já existe.
6. **Aviso na tela de templates** quando o PDF de fundo passar de ~1 MB, sugerindo uma versão comprimida (reduz muito a chance de falha em conexão móvel).

## Detalhes técnicos

- `src/hooks/useDocuments.ts`:
  - helper `fetchTemplatePdfBytes(path)` com `AbortController` (timeout ~30 s), retry com backoff e cache `Map<path, ArrayBuffer>` em nível de módulo; valida `resp.ok` e tamanho > 0.
  - helper `uploadPdfWithRetry(path, blob)` envolvendo `storage.upload` com retry.
  - `useGenerateDocument`: gerar o `id` do documento no cliente (`crypto.randomUUID()`), fazer o upload em `${patient.id}/${id}.pdf` e só então inserir a linha já com `pdf_path` preenchido.
  - novo `useRegenerateDocumentPdf(documentId)`: recarrega `body_html`/`data` do documento, renderiza e sobe o PDF, atualizando `pdf_path`.
- `src/components/PatientDocuments.tsx`: badge "PDF pendente" + ação "Regerar PDF" nos documentos com `pdf_path` nulo; item não clicável fica com estado explicativo em vez de silencioso.
- Tela de templates: badge de aviso para PDF de fundo acima de 1 MB.
- Sem mudanças de schema nem de RLS.
