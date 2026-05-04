## Escopo deste ciclo

**Itens executados agora:** 1, 1.1, 2, 3, 6, 7, 8 (revisado — aprendizado incremental).
**Itens preparados/respondidos:** 4 (integração futura) e 5 (consentimentos automáticos).

---

### 1 + 1.1 — Notificações como pilar operacional

**Mudanças no `NotificationBell`:**
- Cabeçalho com data do dia + contador "X demandas para hoje".
- Lista agrupada e ordenada por prioridade fixa:
  1. **Atrasadas** (vermelho, com nº de dias de atraso)
  2. **Vencem hoje** (âmbar, ordenadas por horário)
  3. **Sem próxima ação definida** (cinza-vermelho — paciente parado)
  4. **Próximas 48h** (verde, colapsável)
- Cada item mostra: paciente, etapa, ação, responsável, prazo.
- Filtro "minhas / todas" por responsável.
- Auto-abertura do sino no primeiro login do dia (flag em `localStorage` por usuário+data).

**1.1** No `AddTaskDialog` o rótulo do campo de data passa a ser **"Prazo máximo"**.

---

### 2 — Ações com presets em dropdown

No `AddTaskDialog`, novo campo "Tipo de ação" (Select) com presets:
- Atualizar etapa no follow-up
- Checar documentos
- Emitir documentos
- Consultar convênio
- Consultar hospital
- Ligar para o paciente
- Confirmar agendamento
- Solicitar exames/laudos
- Outro (libera campo livre)

Ao escolher um preset, o "Título" é pré-preenchido e ainda editável. Presets vivem em `src/data/constants.ts` (`TASK_PRESETS`).

---

### 3 — Reordenar `PatientPanel`

Nova ordem:
1. Cabeçalho (já existe)
2. Alertas (já existe)
3. **Ações** (movido para cima)
4. Identificação / dados clínicos / financeiro
5. Pré-op checklist (quando aplicável)
6. Documentos
7. Observações

---

### 6 — Receita médica: assinatura + CRM/RQE

Em `PrescriptionForm` e `buildPrescriptionHtml`:
- Espaço maior entre data e assinatura (`margin-top: 56px`).
- Bloco de assinatura com 3 linhas: nome, **CRM**, **RQE** — puxados do perfil profissional.
- Mesmo tratamento aplicado a `buildSurgicalRequestHtml`, `buildMedicalCertificateHtml`, `buildReportHtml`, `buildBudgetHtml`.
- `signatureBlock` passa a aceitar `{ name, crm, crmUf, rqe }`.

---

### 7 — Perfil profissional do cirurgião / concierge

**Nova tabela `professional_profiles`:**
- `user_id` (FK auth.users, unique)
- `crm` (text), `crm_uf` (text)
- `rqe` (text)
- `signature_title` (text — ex.: "Urologista")
- `phone_professional`, `email_professional`
- RLS: usuário lê/edita o próprio; admin lê/edita todos.

**Nova rota `/perfil`** (item de menu visível para todos os papéis):
- Formulário com nome, CRM/UF, RQE, especialidade, telefone, e-mail profissional.
- Aviso: "Em breve: seus templates pessoais aparecerão aqui."

**Hook `useProfessionalProfile(userIdOrSurgeonName)`** consumido pelos formulários de documento.

---

### 8 (REVISADO) — Aprendizado incremental de CBHPM/OPME

**Sem seed manual.** A base de defaults é construída no uso real.

**Nova tabela `procedure_default_codes`:**
- `id` uuid pk
- `procedure` (text, nome canônico)
- `scope` ('surgeon' | 'concierge') — padronização por papel
- `scope_owner` (text — `surgeon_name` ou `concierge_name`)
- `kind` ('cbhpm_main' | 'cbhpm_extra' | 'cid' | 'opme')
- `code` (text, nullable para OPME)
- `label` (text)
- `quantity` (int, default 1 — usado por OPME)
- `position` (int)
- `created_by` (uuid)
- `updated_at` timestamp
- Único: `(procedure, scope, scope_owner, kind, code, label)` — evita duplicatas.

RLS: SELECT autenticado; INSERT/UPDATE/DELETE para admin/surgeon/concierge.

**Fluxo no `GenerateDocumentDialog` (apenas tipo `surgical_request`):**

1. Ao abrir o diálogo, chamar `useDefaultProcedureCodes(procedure, surgeon, concierge)` que busca defaults nesta ordem de precedência:
   - **Cirurgião** primeiro (mais específico clinicamente)
   - **Concierge** como fallback complementar
   - Se houver itens em ambos, fazer merge sem duplicar `(kind, code)`.
2. Pré-preencher `mainCbhpm`, `extraCbhpm`, `cid`, `opme` em `defaultSurgicalRequestData`.
3. Usuário edita normalmente (incluir/remover/alterar).
4. **Ao clicar em "Gerar PDF"**, abrir um pequeno diálogo de confirmação **somente se houver pelo menos um código preenchido**:

   ```
   ┌─────────────────────────────────────────────┐
   │ Salvar como padrão para próximas solicitações?│
   │                                              │
   │ Procedimento: Prostatectomia Radical         │
   │                                              │
   │ ☑ Salvar para o cirurgião (Dr Alexandre…)   │
   │ ☐ Salvar para a concierge (Margô)            │
   │                                              │
   │ Itens que serão salvos:                      │
   │  • CBHPM principal: 31309127 — Prost. radical│
   │  • CBHPM extra: …                            │
   │  • CID: N40                                  │
   │  • OPME: 2× Pinça…                           │
   │                                              │
   │      [Não salvar]    [Gerar e salvar]        │
   └─────────────────────────────────────────────┘
   ```

   - Cada checkbox é opcional; se nenhuma marcada → apenas gera o PDF.
   - "Não salvar" e "Gerar e salvar" sempre geram o PDF — só a persistência dos defaults muda.
   - Marcar uma escolha faz **upsert idempotente** em `procedure_default_codes` para todos os itens preenchidos do formulário (o upsert garante que repetir o mesmo código não cria duplicata; só atualiza `position` e `updated_at`).
5. Toggle "Não perguntar novamente para este procedimento + papel" (preferência salva em `localStorage`) para o usuário maduro que já validou seus padrões.

**Gerenciamento dos defaults:**
- Pequena seção na rota `/perfil` ("Meus códigos padrão") listando, por procedimento, os defaults salvos com botão de remover individual. Isso permite limpar erros sem precisar de admin.

**Resultado prático:** você não preenche nada manualmente agora; conforme cada cirurgião emite a primeira solicitação de cada procedimento, a base se popula sozinha e os próximos pacientes já vêm pré-preenchidos.

---

### Itens não-execução

**Item 4 — Integração futura com banco de leads:** **Sim, viável.** Caminho:
- Adicionar `patients.external_lead_id` (text, unique nullable) + `source` ('manual' | 'call_center' | 'crm_externo') quando você sinalizar.
- Edge function `ingest-lead` (POST com API key) faz upsert por `external_lead_id`, cria paciente em `indication`.
- Edge function `export-patient-update` notifica webhook externo nas mudanças de etapa.
- Não criado neste ciclo.

**Item 5 — Consentimentos automáticos:** Próximo ciclo dedicado. Esboço:
- Tipo `'consent'` em `DOCUMENT_TYPES`.
- `PdfTemplateEditor` ganha N caixas customizadas com `{ key, label, source }` (`paciente.nome | procedimento | cirurgiao | data | livre`).
- Trigger `auto_generate_consent: true` por procedimento → cria `patient_documents` automaticamente ao cadastrar o paciente.
- **Vou precisar do PDF do termo de Postectomia atual + lista de procedimentos com termo padronizado** para abrir esse ciclo.

---

### Resumo técnico

**Migrations:**
- `professional_profiles` + RLS
- `procedure_default_codes` + RLS + índice único
- `tasks.preset` (text nullable, opcional, para analytics futura)

**Front-end novo:**
- `src/data/constants.ts` — `TASK_PRESETS`
- `src/hooks/useProfessionalProfile.ts`
- `src/hooks/useDefaultProcedureCodes.ts`
- `src/pages/Profile.tsx` (rota `/perfil`)
- `src/components/SaveDefaultsDialog.tsx` — diálogo de confirmação do item 8

**Front-end alterado:**
- `AddTaskDialog.tsx` — preset dropdown + label "Prazo máximo"
- `NotificationBell.tsx` — agrupamento por prioridade, contador, filtro
- `PipelineDashboard.tsx` — auto-abrir sino + nova lógica de notificações (sem-ação, próximas 48h)
- `PatientPanel.tsx` — reordenar seções
- `PrescriptionForm.tsx` + `documents.ts` — `signatureBlock` com CRM/RQE; espaçamento
- `SurgicalRequestForm.tsx` — consumir defaults do hook
- `GenerateDocumentDialog.tsx` — disparar `SaveDefaultsDialog` no submit de `surgical_request`
- `App.tsx` — registrar rota `/perfil`

**Não muda:** PDFs (estilo neutro), RLS de pacientes, fluxo de auth, edge functions.

---

Confirma? Se sim, implemento na próxima passada.