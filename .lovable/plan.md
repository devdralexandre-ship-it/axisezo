# Anexos: confirmação visível e arquivo sempre acessível

## O que foi verificado

Os arquivos enviados pelo cirurgião **não se perderam**. Os três anexos enviados hoje (17:16, 17:18 e 17:19 — pacientes Gilliard, Margarida e Luiza) estão registrados no banco e presentes no armazenamento, e as regras de acesso permitem que o próprio cirurgião os leia.

O problema é de interface, na seção "Documentos do paciente":

- Os botões de baixar/abrir/excluir de cada arquivo só aparecem ao passar o mouse por cima (`opacity-0` + `group-hover`). No celular/tablet não existe "passar o mouse": a linha do arquivo fica sem nenhuma ação visível, dando a impressão de que o anexo não está disponível.
- Não existe pré-visualização nem opção de abrir o arquivo: a única ação é "baixar", que no iPhone frequentemente não dá retorno claro.
- Durante o envio (fotos de 3–6 MB) não há indicação de progresso nem linha provisória na lista; o único retorno é um aviso rápido no rodapé, que pode passar despercebido.

## O que será feito

1. **Ações sempre visíveis**: os botões de cada arquivo deixam de depender do mouse — ficam permanentemente visíveis (com destaque discreto), em qualquer dispositivo.
2. **Abrir/visualizar o arquivo**: clicar no nome do arquivo abre o anexo — imagens e PDFs em visualizador dentro do app (aba de imagem ampliada / PDF em nova aba), com botão separado para baixar.
3. **Miniatura para imagens**: fotos passam a exibir uma miniatura na lista, tornando óbvio que o anexo foi incluído e qual é.
4. **Feedback durante o envio**: enquanto sobe, aparece imediatamente uma linha "enviando…" com o nome do arquivo e indicador de progresso; ao concluir, a linha vira o anexo real com um breve destaque visual (e contagem atualizada no cabeçalho).
5. **Erros claros**: se um arquivo falhar, ele fica na lista marcado como falha com o motivo e um botão "tentar novamente", em vez de sumir.
6. **Contagem no cabeçalho e ordenação**: mais recentes primeiro (já é o caso) e rótulo "Documentos do paciente (N)" atualizado assim que o envio termina.

## Detalhes técnicos

- `src/components/PatientUploads.tsx`: remover `opacity-0 group-hover:opacity-100`; estado local de uploads em andamento (`pending[]`) renderizado acima da lista; miniatura via URL assinada para `mime_type` de imagem; nome do arquivo vira botão que abre visualizador (Dialog para imagem, `window.open` da URL assinada sem parâmetro `download` para PDF); estado de erro por arquivo com ação de reenvio.
- `src/hooks/usePatientUploads.ts`: adicionar variante da URL assinada **sem** `download` (para abrir em vez de baixar) e um hook para miniaturas, mantendo o cache de 50 min já existente.
- Sem mudanças de banco, de regras de acesso ou de lógica de negócio.

## Verificação

Testar no navegador com sessão real de cirurgião (Dr Evaristo): abrir um paciente com anexos, conferir miniatura + ações visíveis sem hover, abrir imagem e PDF, enviar um arquivo novo e observar a linha "enviando…" e a atualização da lista; repetir em viewport de celular.
