## Diagnóstico

O arquivo assinado está sendo gerado e salvo corretamente. A chamada para criar o link assinado também retorna `200`, mas em alguns cliques a requisição falha como `Load failed` e o código atual trata isso como “link nulo”, então nenhum download é iniciado.

## Plano

1. Tornar o download mais robusto no frontend:
   - buscar o PDF como `Blob` usando o link assinado;
   - criar um `objectURL` local;
   - acionar o download com nome de arquivo definido;
   - liberar o `objectURL` depois do clique.

2. Melhorar o tratamento de erro:
   - diferenciar falha ao gerar link de falha ao baixar o arquivo;
   - registrar no console o erro real da Storage API;
   - exibir toast mais claro para o usuário.

3. Evitar múltiplos cliques concorrentes:
   - adicionar estado local de download por documento/caminho;
   - desabilitar o botão e mostrar carregamento enquanto baixa.

## Arquivos a alterar

- `src/hooks/useDocuments.ts`
- `src/components/PatientDocuments.tsx`

## Validação

- Testar que “Baixar PDF assinado” gera o link, baixa o blob e dispara o arquivo `.pdf` sem abrir aba em branco.
- Confirmar que o botão “Baixar” do PDF original continua funcionando.