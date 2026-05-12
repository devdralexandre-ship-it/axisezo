## Escopo desta rodada

### 1. Paridade do bloco "Nova ação" no cadastro de paciente
Hoje o `AddPatientForm` tem um mini-formulário próprio (título livre + data + hora + responsável). O `AddTaskDialog` já evoluiu com:
- Dropdown **Tipo de ação** (presets de `TASK_PRESETS` + "Outro")
- Campo "Título" sincronizado ao preset
- Label **"Prazo máximo"** em vez de "Data"

**Ação:** extrair o conteúdo de `AddTaskDialog` para um componente reutilizável `TaskFormFields` (sem o `<Dialog>` ao redor) e usá-lo dentro de `AddPatientForm` na seção de ações iniciais. O cadastro continuará exigindo ao menos uma ação válida.

### 2. Renomear coluna "Cirurgia Autorizada" → "Apto para agendar"
Editar `STAGE_LABELS.preop_preparation` em `src/data/types.ts`. A chave interna `preop_preparation` permanece (sem migration). Atualizar quaisquer textos hard-coded que mencionem o rótulo antigo (busca por "Cirurgia Autorizada").

### 3. Headers fixos do Kanban no scroll vertical
Em `PipelineColumn.tsx`, transformar o cabeçalho da coluna (`h3` + Badge) em `sticky top-0 z-10 bg-background pb-2` para que ao rolar a coluna verticalmente o título permaneça visível. O scroll horizontal do board já é independente.

### 4. Data de indicação como base do SLA
- No `AddPatientForm`, adicionar campo **"Data da indicação"** (date picker), pré-preenchido com hoje. O campo `createdAt` continua sendo a data de inclusão no CRM (auto, somente leitura no painel).
- Trocar a referência de SLA: `getDaysInStage` continua medindo dias na etapa atual, mas o card e dashboard passarão a exibir também **"dias desde a indicação"** baseado em `indicationDate` (fallback `createdAt` quando ausente).
- Ordenação no Kanban (`PipelineDashboard` linha 393) já usa `indicationDate || createdAt` — manter, mas garantir que novos pacientes salvem `indicationDate` informado pelo usuário, não `today` automático.

### 5. Procedimentos principal + complementares no cadastro com persistência e sugestões
Hoje o `AddPatientForm` só captura `procedure` (texto único). A solicitação cirúrgica (`SurgicalRequestForm`) já tem `mainCbhpm`, `extraCbhpm[]`, `cid[]`, `opme[]` com `CodeAutocomplete` que sugere a partir de `procedure_code_suggestions` e `procedure_default_codes`.

**Plano:**
- No `AddPatientForm`, após o campo Procedimento, adicionar bloco **"Códigos CBHPM (opcional)"** com:
  - Campo CBHPM principal (`CodeAutocomplete` kind=cbhpm)
  - Lista de complementares (add/remove, `CodeAutocomplete`)
- Persistir esses códigos no novo campo JSONB `patients.procedure_codes` (ver migration abaixo).
- Quando uma solicitação cirúrgica for gerada, o `GenerateDocumentDialog` (que já consome defaults via `useDefaultProcedureCodes`) passa também a usar os códigos salvos no paciente como sementes prioritárias.
- O `CodeAutocomplete` já registra cada uso em `procedure_code_suggestions`, então as sugestões aparecerão automaticamente em pacientes futuros do mesmo procedimento.

**Migration:**
- `ALTER TABLE patients ADD COLUMN procedure_codes JSONB NOT NULL DEFAULT '{"main": null, "extras": []}'::jsonb;`

### 6. Assinatura eletrônica A1 (ICP-Brasil) — fundação
Abordagem escolhida: **upload do .pfx no perfil + assinatura no servidor**.

**Banco:**
- Novo bucket privado de Storage: `signing-certificates` (RLS: usuário só lê/escreve `{auth.uid()}/cert.pfx`).
- Nova tabela `signing_certificates`:
  - `user_id uuid` (PK, FK auth)
  - `pfx_path text` (caminho no bucket)
  - `password_encrypted text` (senha do .pfx criptografada com `pgcrypto` usando uma master key em secret)
  - `subject_cn text`, `valid_from date`, `valid_to date` (extraídos no upload para exibir validade no perfil)
  - RLS: usuário só vê/edita o próprio; admin lê tudo.
- Nova coluna `patient_documents.signed_pdf_path text` e `signed_at timestamptz`, `signed_by uuid`.

**Edge functions:**
- `upload-signing-cert`: recebe .pfx + senha, valida com node-forge (npm:node-forge), extrai metadados, criptografa a senha (`pgp_sym_encrypt`), salva no Storage e na tabela.
- `sign-pdf`: recebe `document_id`, busca o PDF gerado, recupera .pfx + senha do usuário, assina com `npm:@signpdf/signpdf` + `npm:@signpdf/signer-p12` + `npm:@signpdf/placeholder-plain`, salva como `*_signed.pdf` no bucket de documentos e atualiza `patient_documents`.

**Secrets necessários:**
- `PFX_MASTER_KEY` (chave para `pgp_sym_encrypt`/`decrypt`).

**UI:**
- Em `/perfil`, nova seção **"Assinatura digital (A1)"**: upload do .pfx, campo senha, exibição do CN/validade, botão remover. Aviso de segurança claro ("Sua chave privada fica criptografada e só é usada para assinar PDFs deste sistema").
- Em `PatientDocuments` / `GenerateDocumentDialog`, novo botão **"Assinar com A1"** ao lado do botão de download, visível apenas se o usuário tem certificado ativo. Mostra status "Assinado em DD/MM HH:MM" após sucesso e disponibiliza link para o PDF assinado.

### Componentes alterados
- `src/data/types.ts` — rótulo da coluna
- `src/components/PipelineColumn.tsx` — header sticky
- `src/components/AddPatientForm.tsx` — campo data de indicação, bloco CBHPM, uso de `TaskFormFields`
- `src/components/AddTaskDialog.tsx` — extrai conteúdo para `TaskFormFields`
- `src/components/PatientCard.tsx` — exibir "X dias desde indicação"
- `src/components/PipelineDashboard.tsx` — ajustes de cópia
- `src/components/GenerateDocumentDialog.tsx` + `SurgicalRequestForm.tsx` — pré-preencher com `patient.procedure_codes`
- `src/pages/Profile.tsx` — seção A1
- `src/components/PatientDocuments.tsx` — botão "Assinar com A1"

### Componentes/áreas que NÃO mudam
- Templates de PDF (continuam neutros)
- Sino de notificações, presets de tarefa (já entregues)
- Auth, RLS de pacientes/tarefas
- Importação CSV
- Rótulos das demais 10 colunas

### Migration única
```sql
-- Renomeação só em label (sem alterar enum)
ALTER TABLE patients ADD COLUMN procedure_codes JSONB NOT NULL DEFAULT '{"main": null, "extras": []}'::jsonb;

ALTER TABLE patient_documents
  ADD COLUMN signed_pdf_path text,
  ADD COLUMN signed_at timestamptz,
  ADD COLUMN signed_by uuid;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.signing_certificates (
  user_id uuid PRIMARY KEY,
  pfx_path text NOT NULL,
  password_encrypted text NOT NULL,
  subject_cn text,
  valid_from date,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.signing_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cert" ON public.signing_certificates
  FOR ALL USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

INSERT INTO storage.buckets (id, name, public) VALUES ('signing-certificates','signing-certificates', false);
CREATE POLICY "Own cert read" ON storage.objects FOR SELECT
  USING (bucket_id='signing-certificates' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Own cert write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id='signing-certificates' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Own cert delete" ON storage.objects FOR DELETE
  USING (bucket_id='signing-certificates' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### Secret a solicitar
`PFX_MASTER_KEY` (32+ chars aleatórios — usado para criptografar a senha do .pfx no banco).

### Ordem de execução
1. Migration + secret
2. Refator `TaskFormFields` e paridade no cadastro
3. Rótulo + headers sticky + data de indicação
4. Bloco CBHPM no cadastro + persistência
5. Fluxo A1: edge functions → UI no perfil → botão nos documentos

Aprovando, executo todas as etapas em sequência.