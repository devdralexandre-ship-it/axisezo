# Otimizar "Novo Documento" com formulários estruturados

Hoje, somente **Solicitação Cirúrgica** tem formulário. Os demais tipos caem num editor HTML cru. Vou estruturar os 4 tipos restantes (incluindo um novo: **Receita Médica**) com formulários amigáveis, mantendo a arquitetura atual (preview lado a lado + geração via `useGenerateDocument`).

## 1. Novo tipo de documento: Receita Médica

**Banco** (migração):
- Adicionar `'prescription'` ao enum `public.document_type` (`ALTER TYPE ... ADD VALUE 'prescription'`).

**Código** (`src/data/documents.ts`):
- Adicionar `'prescription'` em `DOCUMENT_TYPES` e label `'Receita Médica'`.
- Incluir `DEFAULT_TEMPLATE_BODIES.prescription` (placeholder, não será usado no fluxo estruturado).

A `Templates.tsx` já itera sobre `DOCUMENT_TYPES`, então **Receita** aparece automaticamente nas opções de templates.

## 2. Estrutura de dados por tipo

Adicionar em `src/data/documents.ts`:

```ts
export interface PrescriptionData {
  patientName: string;
  medications: string;        // texto livre
  date: string | null;        // ISO ou null = "sem data"
  city: string;               // default "Salvador"
  surgeon: string;
}

export interface MedicalCertificateData {
  patientName: string;
  days: number;
  cid: { code: string; label: string };
  date: string;               // ISO
  patientConsentsCid: boolean; // checkbox
  city: string;
  surgeon: string;
}

export interface ReportData {
  patientName: string;
  patientAge: string;
  reportText: string;         // textarea grande (futuro: AI)
  date: string;
  city: string;
  surgeon: string;
}

export interface BudgetData {
  patientName: string;
  procedureName: string;
  hospital: string;
  payer: string;
  surgeonFee: number;          // pré: patient.medicalFees
  firstAssistantFee: number;   // novo, opcional (default 0)
  scrubNurseFee: number;       // instrumentador (novo)
  anesthesiaFee: number;       // pré: patient.anesthesiaFees
  hospitalBudget: number;      // pré: patient.hospitalBudget
  materialsCost: number;       // pré: patient.materialsCost
  includeFirstAssistant: boolean; // controla exibição "quando se aplicar"
  validityDays: number;        // default 30
  notes: string;
  city: string;
  surgeon: string;
}
```

E builders HTML correspondentes (`buildPrescriptionHtml`, `buildMedicalCertificateHtml`, `buildReportHtml`, `buildBudgetHtml`) + `default*Data(patient, template)` que pré-preenchem dos campos do paciente.

**Honorários do 1º auxiliar e instrumentador**: como hoje o paciente não tem esses campos no DB, ficam editáveis no formulário com default `0` e checkbox "incluir 1º auxiliar". Total recalculado em tempo real. (Se desejar persistir esses valores no paciente, fica para próxima iteração.)

## 3. Componentes de formulário

Criar 4 componentes em `src/components/`:
- `PrescriptionForm.tsx` — nome (read-only com toggle edit), textarea grande "Medicações" com placeholder estilo "Rx", checkbox "sem data" + DatePicker, cidade.
- `MedicalCertificateForm.tsx` — nº de dias (input number), CID via `CodeAutocomplete` (kind="cid"), DatePicker, checkbox "Paciente concorda com a divulgação do CID neste documento".
- `ReportForm.tsx` — textarea grande para o relatório (placeholder explicando que IA virá depois), DatePicker. Botão "Sugerir com IA" desabilitado/`coming soon`.
- `BudgetForm.tsx` — campos numéricos formatados em BRL para cada honorário, switch "Incluir 1º auxiliar" (esconde/mostra campo), Select de hospital (com lista conhecida do paciente + datalist livre), validade (dias), notas. Mostra **Total estimado** ao vivo no rodapé.

Todos seguem o padrão visual já estabelecido em `SurgicalRequestForm.tsx` (seções A/B/C, labels `text-[11px] font-semibold uppercase`, inputs `h-8 text-sm`).

**Símbolo Rx na receita**: header decorativo `<div class="text-4xl font-serif">℞</div>` no preview e no HTML gerado.

## 4. Atualizar `GenerateDocumentDialog.tsx`

- Trocar a flag `isStructured` (atualmente `type === 'surgical_request'`) por um **dispatcher**: todos os 5 tipos agora são estruturados.
- Manter o layout 2 colunas (form à esquerda, preview à direita).
- Estado por tipo (union discriminada) — ao trocar o tipo, inicializar com o `default*Data(patient, template)` apropriado.
- O preview chama o `build*Html` correspondente.
- Remover completamente o ramo "modo simples HTML" (caixa `Textarea` de corpo HTML). O editor HTML cru permanece disponível em **Templates** para quem quiser editar templates avançados, mas no fluxo de geração de documento por paciente sempre usamos o formulário estruturado.

## 5. Atualizar `useGenerateDocument`

Em `src/hooks/useDocuments.ts`, trocar `structuredData?: SurgicalRequestData` por uma união:

```ts
structuredData?:
  | { kind: 'surgical_request'; data: SurgicalRequestData }
  | { kind: 'prescription'; data: PrescriptionData }
  | { kind: 'medical_certificate'; data: MedicalCertificateData }
  | { kind: 'report'; data: ReportData }
  | { kind: 'budget'; data: BudgetData };
```

E despachar para o `build*Html` correto. Persistir o objeto cru em `patient_documents.data` (já existe a coluna `jsonb`), permitindo regenerar/editar no futuro.

## 6. Telas de Templates

`Templates.tsx` já aceita qualquer `DocumentType`. Sem mudanças necessárias além de Receita aparecer na lista. O editor HTML do template continua válido (templates definem cabeçalho, rodapé, logo, default_data — não o corpo gerado pelo formulário estruturado).

## Arquivos afetados

**Novos**:
- `supabase/migrations/<timestamp>_add_prescription_doc_type.sql`
- `src/components/PrescriptionForm.tsx`
- `src/components/MedicalCertificateForm.tsx`
- `src/components/ReportForm.tsx`
- `src/components/BudgetForm.tsx`

**Modificados**:
- `src/data/documents.ts` — novos tipos, builders, defaults, label/enum.
- `src/components/GenerateDocumentDialog.tsx` — dispatcher de formulários, remover modo HTML cru.
- `src/hooks/useDocuments.ts` — union discriminada em `GenerateInput`.

## Notas técnicas

- DatePicker: `Popover + Calendar` shadcn com `pointer-events-auto`.
- Honorários 1º aux./instrumentador: vivem só no `BudgetData`; **não** vou criar colunas no `patients` agora (evita migração maior). Fácil promover depois se quiser persistir por paciente.
- Migração do enum: `ALTER TYPE` em transação — compatível com dados existentes.
- `patient_documents.data` já é `jsonb` — sem migração extra para os novos payloads estruturados.
