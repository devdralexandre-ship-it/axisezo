# Plano confirmado — Templates PDF + Assinatura A1

Decisões registradas:
- **Etapa A** (template PDF) primeiro → valido com você → **Etapa B1** (A1) na sequência.
- Multi-página: **repete o mesmo timbre** em todas as páginas adicionais.
- Assinatura A1 visual: **carimbo textual padrão** ("Assinado digitalmente por Dr. X — CRM xxx — 24/04/2026 — ICP-Brasil") desenhado na área de assinatura marcada no template.

---

## Etapa A — Template em PDF timbrado (a fazer agora)

### Banco
Migração adicionando em `document_templates`:
- `mode text not null default 'html'` (`'html'` | `'pdf'`)
- `pdf_template_path text` (path no bucket `patient-documents/template-pdfs/{id}.pdf`)
- `content_box jsonb` (`{ x, y, width, height, fontSize, lineHeight }` em pontos PDF)
- `signature_box jsonb` (área onde o carimbo de assinatura vai ser desenhado na Etapa B; aceita null)

### Dependências
- `pdf-lib` (manipulação do PDF base, desenho de texto, exportação)
- `react-pdf` + `pdfjs-dist` (visualização do PDF no editor de área)

### Componentes novos
- `src/components/PdfTemplateEditor.tsx`: renderiza a primeira página do PDF subido em canvas (via react-pdf), overlay com 2 retângulos arrastáveis/redimensionáveis (caixa de conteúdo em verde, caixa de assinatura em azul). Mostra coordenadas em mm, botão "Salvar áreas".
- `src/lib/pdf-template-renderer.ts`: nova função `renderInsidePdfTemplate({ templatePdfBytes, contentBox, blocks })` que carrega o PDF base com pdf-lib, clona páginas conforme necessário e desenha texto block-by-block dentro da `content_box`, com quebra de página automática e Helvetica/Helvetica-Bold embutidas.

### Modificações
- `src/pages/Templates.tsx`: tabs **HTML** / **PDF Timbrado** no formulário; em PDF: upload do `.pdf`, preview com `PdfTemplateEditor`, salvar template com `mode='pdf'`.
- `src/hooks/useDocuments.ts → useGenerateDocument`: branch — se `template.mode === 'pdf'`, baixa o PDF base via signed URL, monta os blocos de texto (estruturado para `surgical_request`, HTML simples para os outros) e usa `renderInsidePdfTemplate`. Caso contrário, fluxo atual com `@react-pdf/renderer`.
- Manter `pdf-generator.tsx` atual intacto para o modo HTML legado.

### Storage
Bucket `patient-documents` já existe e cobre. Subpasta `template-pdfs/` criada na hora do primeiro upload.

### O que a secretária verá
1. `/templates` → "Novo template" → tipo "Solicitação Cirúrgica" → cirurgião "Dr Estrela" → tab **PDF Timbrado** → sobe o PDF do papel timbrado dele → arrasta a caixa verde para demarcar a área branca onde o conteúdo deve ser escrito → arrasta a caixa azul para a área da assinatura (vazia agora, usada na Etapa B) → Salvar.
2. No paciente → Novo documento → Solicitação Cirúrgica → preenche o formulário estruturado normalmente → Gerar PDF → o PDF baixado é o **timbre do Dr Estrela com o conteúdo da solicitação dentro da caixa**.

### Limitações já assumidas
- Fonte do conteúdo é Helvetica/Helvetica-Bold padrão do PDF (não a fonte do timbre).
- Caixa única retangular igual em todas as páginas.
- Quebra de linha simples (palavra a palavra com largura calculada por Helvetica). Sem justificação avançada nem hifenização.

---

## Etapa B1 — Assinatura digital A1 (depois de A validado)

Faço só depois que você confirmar que a Etapa A está funcionando. Resumo do que virá:

- Tabela `surgeon_certificates` (1 linha por cirurgião): `surgeon`, `cert_path`, `cert_password_secret_name`, `valid_until`, `crm`, `auto_sign boolean`.
- Bucket privado novo `surgeon-certificates` com RLS bloqueando todo acesso autenticado direto (só `service_role`).
- Página `/settings/certificates`: upload do `.pfx`, campo de senha (vai virar secret no Lovable Cloud com nome `CERT_PWD_<surgeon_slug>`), CRM, toggle "Assinar automaticamente".
- Edge function `sign-pdf` (Deno): recebe `{ pdfBase64, surgeonId, signatureBox }`, baixa `.pfx`, lê senha do secret, assina com `@signpdf/signpdf` + `@signpdf/signer-p12` (PAdES-B), desenha o carimbo textual padrão na `signature_box`, devolve PDF assinado.
- `useGenerateDocument`: depois de gerar o PDF (Etapa A), se `surgeon_certificates.auto_sign === true` para esse cirurgião, chama `sign-pdf` antes do upload no storage. Botão manual "Assinar agora" em documentos não assinados.
- Coluna nova em `patient_documents`: `signed_at timestamptz`, `signed_by_certificate_serial text`.

### Riscos da Etapa B1 que você está aceitando ao aprovar
- O `.pfx` fica no bucket privado do Lovable Cloud (acessível por edge function via service role).
- A senha do `.pfx` fica como secret do projeto.
- Equivale a confiar a custódia do certificado A1 à infra do Lovable Cloud — não é o mesmo nível de segurança de um token físico ou HSM. Para a clínica, isso é prática comum quando o objetivo é assinar em lote sem intervenção humana; juridicamente válido, mas tecnicamente o cirurgião deve estar ciente de que cedeu o controle direto.

---

## Verificação ao final da Etapa A

1. `/templates` → criar template "Solicitação — Dr Estrela" modo PDF, subir um PDF timbrado de teste, marcar caixa de conteúdo no centro da página.
2. Abrir paciente do Dr Estrela → Novo documento → Solicitação Cirúrgica → preencher CBHPM/CID/OPME → Gerar.
3. Baixar o PDF → verificar:
   - Timbre do cirurgião visível (cabeçalho, marca d'água, rodapé).
   - Conteúdo da solicitação aparece **dentro** da caixa marcada, sem invadir o cabeçalho/rodapé.
   - Quebra de linha funcionando, negrito nos rótulos.
   - Documento longo gera 2ª página com mesmo timbre.
4. Templates HTML antigos continuam gerando PDF normalmente (não regredir).

Aprove para eu começar pela **Etapa A**.