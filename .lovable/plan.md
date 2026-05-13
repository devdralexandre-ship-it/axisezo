# Fase 3 — Biblioteca de Orientações Pré/Pós-Operatórias

A secretária cadastra materiais educativos (textos, vídeos, PDFs) e monta pacotes por procedimento/cirurgião. No painel do paciente, o sistema sugere automaticamente o que enviar e quando.

---

## Banco de dados

### materials
- title, description, kind (text | video | pdf), content_url (video externo) ou body_html (texto), file_path (PDF no storage)
- procedure (text, opcional — qual procedimento se aplica; vazio = genérico)
- surgeon (text, opcional — qual cirurgião; vazio = todos)
- phase (preop | postop | general)
- created_at, updated_at

### material_packages
- name, description, surgeon (opcional), created_at, updated_at

### package_materials
- package_id → material_id, order_index

### patient_sent_materials
- patient_id, material_id (ou package_id, nullable), sent_at, channel (whatsapp | download | manual), notes

### Storage
- Novo bucket privado `patient-materials` para uploads de PDFs da biblioteca.

---

## RLS e políticas

- Admin: pode criar/editar/excluir materiais e pacotes
- Todos os authenticated: podem visualizar materiais e pacotes
- Todos os authenticated: podem registrar envio em `patient_sent_materials` (via `can_access_patient`)

---

## Backend

### Edge function: suggest-materials
- Recebe patient_id
- Retorna: materiais e pacotes que combinam com `procedure + surgeon` do paciente, ordenados por relevância
- Relevância: match exato de procedimento → match de surgeon → genérico

---

## UI — Página /library (Admin)

Dois tabs:

1. **Materiais**
   - Lista em cards: título, tipo (badge), fase (pré/pós/geral), procedimento, cirurgião
   - Botão "Novo material": modal com formulário
     - Título, descrição
     - Tipo: Texto / Vídeo / PDF
     - Se Texto: textarea rich (ou simples) para body_html
     - Se Vídeo: input de URL (YouTube, Drive, etc.)
     - Se PDF: upload para storage `patient-materials`
     - Procedimento: select dos procedimentos existentes (ou vazio = genérico)
     - Cirurgião: select dos cirurgiões (ou vazio = todos)
     - Fase: Pré-op / Pós-op / Geral
   - Ações: editar, excluir

2. **Pacotes**
   - Lista de pacotes com contagem de materiais dentro
   - Botão "Novo pacote": modal
     - Nome, descrição, cirurgião (opcional)
     - Seletor de materiais para incluir (arrastar ou multi-select com order_index)
   - Ações: editar (reorganizar materiais, renomear), excluir

---

## UI — Painel do Paciente (nova aba "Orientações")

Nova aba ao lado de "Documentos" no `PatientPanel`.

### Layout
- Topo: filtros rápidos (Pré-op | Pós-op | Geral | Pacotes | Tudo)
- Corpo: lista de materiais/pacotes sugeridos

### Card de material individual
- Ícone por tipo (texto, vídeo, PDF)
- Título, descrição resumida
- Tags: fase (badge colorido), procedimento, cirurgião
- Estado: "Já enviado" (check verde) ou "Pendente"
- Botões:
  - "Ver conteúdo" (abre modal: texto renderizado, player de vídeo embed, ou preview de PDF)
  - "Marcar como enviado" (registra em `patient_sent_materials`)
  - "Enviar WhatsApp" (desabilitado até a Fase 2 estar ativa, ou escondido)

### Card de pacote
- Nome, descrição, X materiais dentro
- Botão "Ver pacote" → modal lista todos os materiais do pacote
- Botão "Marcar pacote como enviado" (registra todos de uma vez)

### Sugestões proativas (banner no topo da aba)
- Se paciente está em `surgery_scheduled` e ainda não recebeu pacote pré-op do seu procedimento → banner amarelo: "Sugerido: enviar pacote pré-op de {procedimento}"
- Se paciente está em `surgery_completed` e ainda não recebeu pacote pós-op → banner correspondente
- Banner com botão "Enviar agora" que marca o pacote/material como enviado

---

## Hook: useMaterials

- `useMaterials(filters?)` — lista materiais com filtros opcionais
- `useMaterial(id)` — detalhe de um material
- `useSaveMaterial()` — cria/edita
- `useDeleteMaterial()` — remove
- `usePackages()` — lista pacotes
- `useSavePackage()` — cria/edita pacote
- `useDeletePackage()` — remove
- `useSuggestMaterials(patientId)` — chama edge function de sugestão
- `useMarkSent()` — registra envio em `patient_sent_materials`
- `usePatientSentMaterials(patientId)` — histórico de envios do paciente

---

## Roteamento

- Nova rota `/library` em `App.tsx`
- Link no header do dashboard (botão "Biblioteca", ao lado de "Templates")

---

## Seeding

Incluir materiais de exemplo úteis para urologia:
- "O que esperar da vasectomia" (texto, pré-op, Vasectomia)
- "Cuidados pós-cirurgia de próstata" (texto, pós-op, Prostatectomia)
- "Como preparar o jejum pré-operatório" (texto, pré-op, genérico)
- "Exercícios de reabilitação pélvica" (vídeo, pós-op, genérico)

Pacotes seed:
- "Pacote Pré-op Vasectomia" (materiais específicos + genéricos de pré-op)
- "Pacote Pós-op Cirurgia de Próstata"

---

## Notas

- Nenhuma dependência externa nova (usa storage e edge functions existentes)
- A Fase 2 (WhatsApp) é opcional para o funcionamento da Fase 3 — o botão "Enviar WhatsApp" pode ficar desabilitado com tooltip "Disponível quando o WhatsApp for configurado"
- Reutiliza componentes de UI existentes: Dialog, Card, Badge, Button, Select, Tabs
- PDF de materiais: upload direto ao storage; preview via signed URL