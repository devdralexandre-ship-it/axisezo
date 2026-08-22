# Documentos: mobile sem preview, fotos multipágina e anexo mais confiável

## 1. Sem preview no mobile
Na janela "Novo documento", o painel de Preview some em telas pequenas (menos de 768px), deixando apenas o formulário em coluna única, com o botão "Gerar PDF" fixo no rodapé. No desktop/tablet largo nada muda.

## 2. Várias fotos em um único arquivo (PDF multipágina)
Em "Documentos do paciente":
- Novo botão "Digitalizar" (câmera) que permite tirar/escolher várias fotos em sequência.
- As fotos entram numa lista com miniaturas, onde é possível reordenar (subir/descer), remover e adicionar mais.
- Ao confirmar, as imagens viram um único PDF (uma foto por página, orientação preservada, imagem ajustada à página A4) com nome sugerido editável (ex.: "Laudo - 3 páginas").
- Esse PDF é enviado como um anexo normal, na categoria escolhida, e aparece na lista como qualquer outro arquivo.
- Fotos grandes são redimensionadas/comprimidas antes de entrar no PDF, para o envio não estourar o limite de 20 MB nem travar no celular.

## 3. "Failed to Fetch" ao anexar (caso do João no card do Fabrício)
O erro é de rede no envio do arquivo ao armazenamento (não é permissão — o João é o cirurgião responsável pelo paciente, então tem acesso). Envios de fotos grandes por 4G costumam cair no meio.

Correções:
- Reenvio automático (até 3 tentativas com espera crescente) quando o envio falha por rede.
- Compressão automática de fotos acima de ~2 MB antes do envio (mantendo legibilidade de laudos).
- Mensagem clara em vez de "Failed to fetch": "Falha de conexão ao enviar o arquivo. Verifique a internet e toque em tentar novamente."
- O botão "Tentar novamente" já existente passa a reaproveitar o mesmo arquivo comprimido.

## Detalhes técnicos
- `GenerateDocumentDialog.tsx`: usar `useIsMobile()` para renderizar apenas a coluna do formulário (grid vira 1 coluna, preview não montado).
- Novo `src/lib/images-to-pdf.ts`: canvas para redimensionar/comprimir (JPEG, lado maior ~2000px, qualidade ~0.8) + `pdf-lib` (`embedJpg`) para montar o PDF A4.
- Novo `src/components/ScanToPdfDialog.tsx`: captura múltipla (`input capture` + `multiple`), lista reordenável, geração e envio via `uploadPatientFile`.
- `src/hooks/usePatientUploads.ts`: envolver `supabase.storage.upload` em helper de retry com backoff e traduzir `TypeError: Failed to fetch` para mensagem de conexão; aplicar compressão para imagens grandes.
- `src/components/PatientUploads.tsx`: botão "Digitalizar" e integração com o novo diálogo.
