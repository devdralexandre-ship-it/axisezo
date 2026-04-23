

# Plano: Transformar Axis em ferramenta diária da secretária

Quatro fases independentes. Cada uma entrega valor sozinha; juntas, formam o fluxo completo: **gerar documento → enviar pelo WhatsApp → arquivar no Drive → mandar orientações certas para cada cirurgia**.

---

## Fase 1 — Documentos por paciente (orçamento, solicitação, atestado, relatório)

### O que a secretária vai fazer
Abrir um paciente → aba **"Documentos"** → clicar **"Novo documento"** → escolher tipo (Orçamento, Solicitação Cirúrgica, Atestado, Relatório) → o sistema preenche automaticamente nome, idade, procedimento, lateralidade, valores, hospital, cirurgião, convênio → ela revisa, ajusta o texto livre se quiser, e salva. O PDF fica listado na ficha do paciente, pronto para baixar/enviar.

### Modelo de templates
Cada tipo de documento tem um template padrão **por cirurgião**. Ex.: o orçamento do Dr. Estrela tem cabeçalho/assinatura dele; o atestado do Dr. Ziomkowski tem o dele. Admin edita os templates em uma tela dedicada (`/templates`) com editor de texto rico e variáveis tipo `{{paciente.nome}}`, `{{procedimento}}`, `{{valor_total}}`.

### Banco de dados
- `document_templates`: id, tipo (`budget`|`surgical_request`|`medical_certificate`|`report`), surgeon, title, body_html, header_html, footer_html, is_default
- `patient_documents`: id, patient_id, template_id, type, title, body_html (snapshot renderizado), pdf_url (storage), created_at, created_by, sent_via_whatsapp_at, drive_file_id (nullable, usado na Fase 4)

### Geração do PDF
Edge function `generate-document`: recebe `{ patientId, templateId, overrides }`, busca paciente + template, faz substituição de variáveis, renderiza HTML→PDF (Puppeteer/Playwright via Lovable AI image gen não serve; usar `@react-pdf/renderer` no client OU Deno + html-to-pdf). Recomendação: **renderizar no client com `@react-pdf/renderer`** — sem custo de edge function, preview instantâneo, salva o PDF no Lovable Cloud Storage e registra em `patient_documents`.

### UI
- Nova aba "Documentos" no `PatientPanel` (ao lado das atuais).
- Lista de documentos do paciente: título, tipo, data, ações (baixar, enviar WhatsApp, enviar Drive).
- Modal "Novo documento": seleciona template, mostra preview com dados do paciente, permite editar antes de gerar.
- Página `/templates` (admin): CRUD de templates, marcadores `{{...}}` com autocomplete dos campos disponíveis.

### Storage
Bucket `patient-documents` (privado), path `{patient_id}/{document_id}.pdf`, RLS: authenticated leitura/escrita.

---

## Fase 2 — WhatsApp via Evolution API (Baileys)

### Decisão e risco assumido
Usaremos Evolution API (não-oficial). **Riscos que a secretária precisa conhecer**: (1) banimento do número se enviar muitas mensagens em massa; (2) instabilidade — pode cair e exigir reconectar via QR. Mitigação: usar um número dedicado da clínica, não pessoal; volume baixo e personalizado.

### Hospedagem
Evolution API precisa rodar em servidor próprio (não cabe em edge function — exige WebSocket persistente e estado do Baileys). Opções:
- **Recomendada**: Railway/Render/VPS (~5-10 USD/mês), Docker pronto da Evolution.
- O Lovable não hospeda isso — o usuário precisa subir e fornecer URL + API key.

### Integração no app
- Settings → "WhatsApp": campo para `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`. Botão "Conectar" mostra QR code para parear.
- Edge function `whatsapp-send`: `{ to, message, mediaUrl? }` → POST para Evolution `/message/sendText` ou `/message/sendMedia`.
- Edge function `whatsapp-webhook`: recebe mensagens de entrada, identifica paciente pelo telefone, anexa em `whatsapp_messages` ligado ao paciente.
- Tabela `whatsapp_messages`: id, patient_id, direction (`in`|`out`), body, media_url, status, sent_at, evolution_message_id.
- Aba "WhatsApp" no `PatientPanel`: histórico estilo chat. Botão "Enviar documento" abre seleção dos PDFs do paciente.

### Fluxo de envio de documento
Na aba Documentos, botão "Enviar WhatsApp" → modal escolhe contato (telefone do paciente prefilled) → mensagem padrão editável → envia o PDF via Evolution → marca `sent_via_whatsapp_at` no documento.

---

## Fase 3 — Biblioteca de orientações pré/pós-op

### Modelo (materiais + pacotes)
- `materials`: id, title, description, kind (`text`|`video`|`pdf`), content_url (vídeo do YouTube/Drive ou PDF do storage) ou body_html (texto), tags. Tags livres + 3 dimensões estruturadas: `procedure` (multi), `surgeon` (multi, opcional → vale para todos), `phase` (`preop`|`postop`|`general`).
- `material_packages`: id, name, surgeon (opcional), description.
- `package_materials`: package_id, material_id, order_index.
- `patient_sent_materials`: patient_id, material_id (ou package_id), sent_at, channel (`whatsapp`|`download`).

### UI Admin
Página `/library`: dois tabs — **Materiais** (CRUD, upload de PDF/vídeo, marca tags) e **Pacotes** (cria pacote, arrasta materiais para dentro, define cirurgião alvo).

### UI no painel do paciente
Nova aba "Orientações". O sistema sugere automaticamente:
- Pacotes que combinam com `procedure + surgeon` do paciente.
- Materiais individuais relevantes (mesmo procedimento OU mesmo cirurgião OU genéricos).
Filtros por fase (Pré-op / Pós-op).
Cada item: botão "Enviar WhatsApp" (envia link/PDF) e checkbox "Já enviei". Histórico mostra o que já foi enviado a esse paciente.

### Sugestão proativa
Quando paciente entra em estágio `surgery_scheduled` → notificação "Enviar pacote pré-op de {procedimento} ({cirurgião})". Quando entra em `surgery_completed` → "Enviar pacote pós-op".

---

## Fase 4 — Google Drive: 1 pasta por paciente

### Comportamento
Quando paciente é criado → cria pasta no Drive da clínica com nome `{Nome do paciente} - {procedimento}` dentro de uma pasta-mãe configurada (ex.: `/Axis Pacientes/`). ID da pasta salvo em `patients.drive_folder_id`.

Quando documento é gerado na Fase 1 → upload automático para a pasta do paciente. Botão manual "Reenviar ao Drive" disponível.

Anexos recebidos via WhatsApp (Fase 2) também sobem para a pasta do paciente automaticamente.

### Limite importante do conector
O conector Google Drive autentica **a conta da clínica** (quem fez OAuth na conexão), não cada usuário. Todos os documentos vão para o Drive dessa conta. Compartilhamento da pasta-mãe com a equipe é manual no Drive.

### Implementação
- Edge function `drive-sync`: chama gateway Google Drive (`https://connector-gateway.lovable.dev/google_drive/drive/v3/files`) para criar pastas e fazer upload multipart.
- Settings → "Google Drive": botão para conectar via `standard_connectors--connect('google_drive')`, campo para selecionar/colar ID da pasta-mãe.
- Trigger: ao criar paciente (hook `useAddPatient`), chamar `drive-sync` para criar pasta. Ao gerar PDF, chamar `drive-sync` para upload.
- Tratamento de falha: se Drive offline, documento ainda fica no Lovable Storage; flag `drive_sync_pending` permite reprocessar.

---

## Ordem de execução proposta

1. **Fase 1 inteira** — entrega valor imediato sozinha (secretária para de fazer documento no Word).
2. **Fase 3** antes da Fase 2 — biblioteca de orientações funciona com download/copiar mesmo sem WhatsApp; é puro CRUD, baixo risco.
3. **Fase 2** — WhatsApp passa a ser o canal de envio de tudo gerado nas Fases 1 e 3.
4. **Fase 4** — sincronização Drive como camada de arquivamento.

---

## Decisões técnicas que precisam de você na hora de implementar cada fase

- **Fase 2**: você precisará subir a Evolution API em algum lugar (Railway/Render/VPS) e me passar URL + API key. Posso documentar o passo a passo do deploy quando chegarmos lá.
- **Fase 4**: você precisará conectar o Google Drive (vou disparar o fluxo de conexão na hora) e criar/escolher a pasta-mãe no Drive da clínica.

## Limitações conhecidas

- **Evolution API** não é oficial: risco de banimento e instabilidade existem e não podem ser eliminados, só mitigados.
- **Google Drive conector** usa a conta-única da clínica; não há separação por usuário.
- **PDF gerado no client** tem limites de fontes/CSS comparado a Puppeteer; suficiente para os 4 tipos de documento, mas se precisar de layout muito complexo migramos para edge function.
- Roles ainda não estão atribuídos (existe `user_roles` e `app_role`, mas ninguém é admin); para Fase 1 e Fase 3 tela de admin (`/templates`, `/library`) qualquer autenticado entra. Posso adicionar gate por role na Fase 1 se quiser.

