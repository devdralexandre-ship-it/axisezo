## Objetivo

Adicionar uma camada visual institucional ao PDF assinado com ICP-Brasil, sem quebrar a assinatura criptográfica já embutida, e expor uma página pública de verificação acessada via QR Code.

## Visão geral do fluxo

```text
sign-pdf (edge function)
  1. Carrega PDF original
  2. Calcula SHA-256 do PDF original (hash de referência)
  3. Cria registro em signature_verifications (id público)
  4. Estampa visualmente: bloco institucional + QR Code + selo (pdf-lib)
  5. Adiciona placeholder ICP-Brasil e assina com P12 (fluxo atual)
  6. Salva _signed.pdf no Storage e atualiza patient_documents

Página pública /verify-document/:id
  - Lê signature_verifications (RLS pública por id)
  - Mostra status, signatário, hash, timestamp, validade do certificado
```

A ordem importa: o conteúdo visual (bloco + QR) é desenhado **antes** do `pdflibAddPlaceholder` + `SignPdf`, garantindo que tudo esteja dentro do escopo da assinatura digital. O Adobe Reader e o validador do ITI continuam reconhecendo a assinatura ICP-Brasil.

## Backend

### 1. Nova tabela `signature_verifications`

Pública para leitura (apenas pelo id, que é UUID não-enumerável). Sem dados clínicos sensíveis — apenas metadados de assinatura.

Campos de domínio:
- `document_id` → FK para `patient_documents`
- `signer_user_id`, `signer_name`, `signer_crm`, `signer_specialty`
- `patient_name_snapshot` (apenas iniciais, ex.: "G. S.")
- `document_title`, `document_type`
- `signed_at`
- `pdf_sha256` (hash do PDF assinado final)
- `subject_cn`, `valid_to` (do certificado)
- `revoked_at` (preenchido se documento for refeito)

Acesso:
- SELECT público pelo `id` (anon + authenticated).
- INSERT/UPDATE apenas via service role (edge function).

### 2. Adicionar `crm` e `specialty` em `profiles`

Campos opcionais para o cirurgião preencher no perfil. Já exibidos no bloco institucional.

### 3. Atualizar `sign-pdf/index.ts`

Antes do `pdflibAddPlaceholder`:
1. Buscar `crm` e `specialty` do `profiles` do signatário.
2. Inserir linha em `signature_verifications` (gera `verification_id`).
3. Gerar QR Code apontando para `https://axiscrm.app/verify-document/<verification_id>` usando `npm:qrcode@1.5.4` (PNG data URL → embed via `pdfDoc.embedPng`).
4. Desenhar no rodapé da última página (ou nova página se não couber):
   - Linha separadora fina.
   - Bloco texto: nome, CRM, especialidade, data/hora (timezone São Paulo), "Documento assinado digitalmente via ICP-Brasil".
   - QR Code 80×80pt à direita.
   - Selo discreto: ícone cadeado SVG mínimo desenhado com `drawSvgPath` ou texto unicode "🔒" substituído por linhas/retângulos pdf-lib (vetor, não emoji).
   - ID curto da verificação como texto monoespaço.
5. Após assinar, calcular SHA-256 do PDF final e fazer `UPDATE signature_verifications SET pdf_sha256 = ...`.

Uso de fonte: `StandardFonts.Helvetica` / `HelveticaBold` (já disponíveis no `pdf-lib`, sem download externo).

### 4. Nova edge function pública `verify-document`

`verify_jwt = false`, GET `?id=<uuid>`. Retorna JSON com os campos do `signature_verifications`. Usada pela página de verificação para evitar acoplamento direto com o cliente Supabase no front público.

Validação de integridade: a função recebe opcionalmente `?hash=<sha256>` (futuro upload manual) e compara com `pdf_sha256`. Para o fluxo do QR, basta retornar o hash registrado — o usuário pode conferir manualmente baixando o PDF.

## Frontend

### 5. Página `/verify-document/:id`

Rota pública (sem auth guard) em `src/pages/VerifyDocument.tsx`. Layout institucional minimalista:
- Cabeçalho com logo e título "Verificação de Assinatura Digital".
- Card de status: verde "Assinatura válida" / vermelho "Documento revogado/não encontrado".
- Bloco de metadados: signatário, CRM, especialidade, data/hora, título do documento, paciente (iniciais), validade do certificado.
- Hash SHA-256 em fonte mono, copiável.
- Texto explicativo: "Para validação criptográfica completa, abra o PDF no Adobe Reader ou em https://validar.iti.gov.br".
- SEO: `<title>`, meta description, H1 único.

Adicionar rota em `src/App.tsx` antes do catch-all.

### 6. Perfil do cirurgião

Adicionar campos `CRM` e `Especialidade` em `src/pages/Profile.tsx` (form simples), salvando em `profiles`.

### 7. Pequeno indicador no `PatientDocuments.tsx`

Quando `signed_pdf_path` existe, mostrar badge discreta "Verificável" com link `/verify-document/<verification_id>` (carregado da nova tabela via join leve).

## Dependências

- `npm:qrcode@1.5.4` (no edge function — gera PNG data URL no Deno).
- Sem libs novas no front; usa shadcn/Tailwind existentes.

## Garantias criptográficas

- O bloco visual e o QR são desenhados **antes** do placeholder de assinatura → ficam protegidos pelo digest assinado.
- `signatureLength: 32768` mantido (já validado).
- O P12Signer e o `@signpdf/signpdf` continuam intocados → Adobe Reader e validador ITI seguem reconhecendo a assinatura ICP-Brasil.
- O `pdf_sha256` armazenado refere-se ao PDF final assinado, permitindo conferência manual.

## Validação

- Assinar um documento → abrir no Adobe Reader → painel de assinaturas mostra "Assinado e todas as assinaturas são válidas".
- Validar em https://validar.iti.gov.br → status válido.
- Escanear QR → abre `/verify-document/:id` com todos os metadados corretos.
- Revogar/refazer documento → página mostra "revogado".

## Itens fora deste escopo

- Carimbo de tempo TSA (RFC 3161) — pode ser próximo passo.
- Validação criptográfica server-side do PDF reenviado pelo usuário (comparar hash).
- Tradução i18n da página pública.
