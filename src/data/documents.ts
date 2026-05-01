export const DOCUMENT_TYPES = [
  'budget',
  'surgical_request',
  'medical_certificate',
  'report',
  'prescription',
] as const;
export type DocumentType = typeof DOCUMENT_TYPES[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  budget: 'Orçamento',
  surgical_request: 'Solicitação Cirúrgica',
  medical_certificate: 'Atestado',
  report: 'Relatório',
  prescription: 'Receita Médica',
};

export type TemplateMode = 'html' | 'pdf';
export type ContinuationStrategy = 'same_page' | 'second_page' | 'blank';

export interface PdfBox {
  /** Coordinates in PDF points, origin = bottom-left of page */
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  lineHeight?: number;
}

export interface DocumentTemplate {
  id: string;
  type: DocumentType;
  surgeon: string | null;
  title: string;
  body_html: string;
  header_html: string;
  footer_html: string;
  is_default: boolean;
  logo_path: string | null;
  default_data: Record<string, any>;
  /** PDF mode fields */
  mode: TemplateMode;
  pdf_template_path: string | null;
  content_box: PdfBox | null;
  signature_box: PdfBox | null;
  continuation_strategy: ContinuationStrategy;
  created_at: string;
  updated_at: string;
}

export interface PatientDocument {
  id: string;
  patient_id: string;
  template_id: string | null;
  type: DocumentType;
  title: string;
  body_html: string;
  pdf_path: string | null;
  sent_via_whatsapp_at: string | null;
  drive_file_id: string | null;
  drive_synced_at: string | null;
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/* ---------- Shared helpers ---------- */

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function escapeHtml(s: string): string {
  return (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

function formatBRL(v: number | null | undefined): string {
  if (v == null || isNaN(v as number)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v as number);
}

function formatDateBR(d: Date) {
  return d.toLocaleDateString('pt-BR');
}

function formatCityDate(city: string, d: Date) {
  return `${city}, ${d.getDate()} de ${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`;
}

function parseISODate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function signatureBlock(surgeon: string): string {
  return `<p>_________________________________<br/>${escapeHtml(surgeon)}</p>`;
}

/* ---------- Surgical Request structured form ---------- */

export interface CodeItem {
  code: string;
  label: string;
}

export interface OpmeItem {
  description: string;
  quantity: number;
}

export type AdmissionRegime = 'inpatient' | 'day_hospital';

export interface SurgicalRequestData {
  // A — Patient (overridable)
  patientName: string;
  patientAge: string;
  patientPhone: string;
  responsibleContact: string;
  payer: string;
  desiredHospital: string;

  // B — Procedure
  procedureName: string;
  mainCbhpm: CodeItem;
  extraCbhpm: CodeItem[];
  cid: CodeItem[];
  opme: OpmeItem[];
  surgicalDescription: string;

  // C — Regime + reservations
  regime: AdmissionRegime;
  icuReservation: boolean;
  bloodReservation: boolean;
  bloodUnits: number;

  // D — Billing
  billingType: string;

  // identification
  surgeon: string;
}

export function defaultSurgicalRequestData(patient: any, template?: DocumentTemplate | null): SurgicalRequestData {
  const seedDefaults = (template?.default_data ?? {}) as Partial<SurgicalRequestData>;
  const procedureFull = [
    patient?.procedure,
    patient?.surgicalApproach,
    patient?.laterality,
  ].filter(Boolean).join(' ');
  return {
    patientName: patient?.name ?? '',
    patientAge: patient?.age != null ? `${patient.age} anos` : '',
    patientPhone: patient?.phone ?? '',
    responsibleContact: patient?.responsibleContact ?? '',
    payer: patient?.payer ?? 'Particular',
    desiredHospital: patient?.desiredHospital ?? '',
    procedureName: procedureFull || patient?.procedure || '',
    mainCbhpm: { code: '', label: '' },
    extraCbhpm: [],
    cid: [],
    opme: [],
    surgicalDescription: seedDefaults.surgicalDescription ?? '',
    regime: (seedDefaults.regime as AdmissionRegime) ?? 'inpatient',
    icuReservation: seedDefaults.icuReservation ?? false,
    bloodReservation: seedDefaults.bloodReservation ?? false,
    bloodUnits: seedDefaults.bloodUnits ?? 0,
    billingType: patient?.billingType ?? '',
    surgeon: patient?.surgeon ?? '',
  };
}

const REGIME_LABEL: Record<AdmissionRegime, string> = {
  inpatient: 'Hospitalar',
  day_hospital: 'Hospital-dia',
};

export function buildSurgicalRequestHtml(data: SurgicalRequestData): string {
  const parts: string[] = [];
  parts.push(`<p>Solicito autorização para realização do procedimento abaixo:</p>`);

  parts.push(`<h3>Identificação</h3>`);
  parts.push(`<p><strong>Paciente:</strong> ${escapeHtml(data.patientName)}${data.patientAge ? ` (${escapeHtml(data.patientAge)})` : ''}</p>`);
  if (data.patientPhone) parts.push(`<p><strong>Telefone:</strong> ${escapeHtml(data.patientPhone)}</p>`);
  if (data.responsibleContact) parts.push(`<p><strong>Responsável:</strong> ${escapeHtml(data.responsibleContact)}</p>`);
  parts.push(`<p><strong>Convênio:</strong> ${escapeHtml(data.payer || 'Particular')}</p>`);
  if (data.desiredHospital) parts.push(`<p><strong>Hospital sugerido:</strong> ${escapeHtml(data.desiredHospital)}</p>`);

  parts.push(`<h3>Procedimento</h3>`);
  const mainLine = `${escapeHtml(data.procedureName)}${data.mainCbhpm.code ? ` <strong>[CBHPM ${escapeHtml(data.mainCbhpm.code)}]</strong>` : ''}`;
  parts.push(`<p>${mainLine}</p>`);
  if (data.extraCbhpm.length > 0) {
    parts.push(`<p><strong>Procedimentos complementares:</strong></p>`);
    parts.push(`<ul>${data.extraCbhpm.map((c) => `<li>${escapeHtml(c.label)}${c.code ? ` <strong>[CBHPM ${escapeHtml(c.code)}]</strong>` : ''}</li>`).join('')}</ul>`);
  }

  if (data.cid.length > 0) {
    parts.push(`<h3>CID</h3>`);
    parts.push(`<ul>${data.cid.map((c) => `<li><strong>${escapeHtml(c.code)}</strong> — ${escapeHtml(c.label)}</li>`).join('')}</ul>`);
  }

  if (data.opme.length > 0) {
    parts.push(`<h3>OPME / Materiais especiais</h3>`);
    parts.push(`<ul>${data.opme.map((o) => `<li>${escapeHtml(o.description)} — <strong>Qtd: ${o.quantity}</strong></li>`).join('')}</ul>`);
  }

  if (data.surgicalDescription && data.surgicalDescription.trim()) {
    parts.push(`<h3>Descrição cirúrgica</h3>`);
    const safeDesc = escapeHtml(data.surgicalDescription).replace(/\n/g, '<br/>');
    parts.push(`<p>${safeDesc}</p>`);
  }

  parts.push(`<h3>Regime e reservas</h3>`);
  parts.push(`<ul>`);
  parts.push(`<li><strong>Regime de internação:</strong> ${REGIME_LABEL[data.regime]}</li>`);
  parts.push(`<li><strong>Reserva de UTI:</strong> ${data.icuReservation ? 'Sim' : 'Não'}</li>`);
  parts.push(`<li><strong>Reserva de sangue:</strong> ${data.bloodReservation ? `Sim — ${data.bloodUnits} unidade(s)` : 'Não'}</li>`);
  parts.push(`</ul>`);

  parts.push(`<h3>Faturamento</h3>`);
  parts.push(`<p><strong>Forma de faturamento:</strong> ${escapeHtml(data.billingType || '—')}</p>`);

  parts.push(`<p>${formatCityDate('Salvador', new Date())}</p>`);
  parts.push(signatureBlock(data.surgeon));

  return parts.join('\n');
}

/* ---------- Prescription (Receita) ---------- */

export interface PrescriptionData {
  patientName: string;
  medications: string;       // free text
  date: string | null;       // ISO date or null
  showDate: boolean;
  city: string;
  surgeon: string;
}

export function defaultPrescriptionData(patient: any, _template?: DocumentTemplate | null): PrescriptionData {
  return {
    patientName: patient?.name ?? '',
    medications: '',
    date: todayISO(),
    showDate: true,
    city: 'Salvador',
    surgeon: patient?.surgeon ?? '',
  };
}

export function buildPrescriptionHtml(data: PrescriptionData): string {
  const parts: string[] = [];
  parts.push(`<div style="text-align:center;font-size:48px;font-family:Georgia,serif;line-height:1;margin:8px 0 4px;">℞</div>`);
  parts.push(`<p style="text-align:center;font-size:11px;letter-spacing:2px;color:#666;margin-top:0;">RECEITA MÉDICA</p>`);
  parts.push(`<p><strong>Paciente:</strong> ${escapeHtml(data.patientName)}</p>`);
  parts.push(`<h3>Prescrição</h3>`);
  const meds = escapeHtml(data.medications || '').replace(/\n/g, '<br/>');
  parts.push(`<p>${meds || '<em>—</em>'}</p>`);
  if (data.showDate && data.date) {
    const d = parseISODate(data.date);
    if (d) parts.push(`<p>${formatCityDate(data.city || 'Salvador', d)}</p>`);
  }
  parts.push(signatureBlock(data.surgeon));
  return parts.join('\n');
}

/* ---------- Medical Certificate (Atestado) ---------- */

export interface MedicalCertificateData {
  patientName: string;
  days: number;
  cid: CodeItem;
  date: string;              // ISO
  patientConsentsCid: boolean;
  city: string;
  surgeon: string;
}

export function defaultMedicalCertificateData(patient: any, _template?: DocumentTemplate | null): MedicalCertificateData {
  return {
    patientName: patient?.name ?? '',
    days: 1,
    cid: { code: '', label: '' },
    date: todayISO(),
    patientConsentsCid: false,
    city: 'Salvador',
    surgeon: patient?.surgeon ?? '',
  };
}

export function buildMedicalCertificateHtml(data: MedicalCertificateData): string {
  const parts: string[] = [];
  const days = data.days || 0;
  parts.push(`<p>Atesto, para os devidos fins, que o(a) paciente <strong>${escapeHtml(data.patientName)}</strong> esteve sob meus cuidados médicos nesta data, sendo necessário afastamento de suas atividades habituais por <strong>${days}</strong> dia(s).</p>`);
  if (data.patientConsentsCid && (data.cid.code || data.cid.label)) {
    parts.push(`<p><strong>CID:</strong> ${escapeHtml(data.cid.code)}${data.cid.label ? ` — ${escapeHtml(data.cid.label)}` : ''}</p>`);
    parts.push(`<p style="font-size:11px;color:#444;font-style:italic;">O paciente concorda com a inclusão do CID neste atestado.</p>`);
  } else if (data.cid.code || data.cid.label) {
    parts.push(`<p style="font-size:11px;color:#444;font-style:italic;">CID omitido a pedido do paciente.</p>`);
  }
  const d = parseISODate(data.date) ?? new Date();
  parts.push(`<p>${formatCityDate(data.city || 'Salvador', d)}</p>`);
  parts.push(signatureBlock(data.surgeon));
  return parts.join('\n');
}

/* ---------- Medical Report (Relatório) ---------- */

export interface ReportData {
  patientName: string;
  patientAge: string;
  reportText: string;
  date: string;
  city: string;
  surgeon: string;
}

export function defaultReportData(patient: any, _template?: DocumentTemplate | null): ReportData {
  return {
    patientName: patient?.name ?? '',
    patientAge: patient?.age != null ? `${patient.age} anos` : '',
    reportText: '',
    date: todayISO(),
    city: 'Salvador',
    surgeon: patient?.surgeon ?? '',
  };
}

export function buildReportHtml(data: ReportData): string {
  const parts: string[] = [];
  parts.push(`<p><strong>Paciente:</strong> ${escapeHtml(data.patientName)}${data.patientAge ? ` (${escapeHtml(data.patientAge)})` : ''}</p>`);
  parts.push(`<h3>Relatório Médico</h3>`);
  const text = escapeHtml(data.reportText || '').replace(/\n/g, '<br/>');
  parts.push(`<p>${text || '<em>—</em>'}</p>`);
  const d = parseISODate(data.date) ?? new Date();
  parts.push(`<p>${formatCityDate(data.city || 'Salvador', d)}</p>`);
  parts.push(signatureBlock(data.surgeon));
  return parts.join('\n');
}

/* ---------- Budget (Orçamento) ---------- */

export interface BudgetData {
  patientName: string;
  procedureName: string;
  hospital: string;
  payer: string;
  surgeonFee: number;
  includeFirstAssistant: boolean;
  firstAssistantFee: number;
  scrubNurseFee: number;       // instrumentador
  anesthesiaFee: number;
  hospitalBudget: number;
  materialsCost: number;
  validityDays: number;
  notes: string;
  date: string;
  city: string;
  surgeon: string;
}

export function defaultBudgetData(patient: any, _template?: DocumentTemplate | null): BudgetData {
  const procedureFull = [patient?.procedure, patient?.surgicalApproach, patient?.laterality]
    .filter(Boolean).join(' ');
  return {
    patientName: patient?.name ?? '',
    procedureName: procedureFull || patient?.procedure || '',
    hospital: patient?.desiredHospital ?? '',
    payer: patient?.payer ?? 'Particular',
    surgeonFee: Number(patient?.medicalFees ?? 0),
    includeFirstAssistant: false,
    firstAssistantFee: 0,
    scrubNurseFee: 0,
    anesthesiaFee: Number(patient?.anesthesiaFees ?? 0),
    hospitalBudget: Number(patient?.hospitalBudget ?? 0),
    materialsCost: Number(patient?.materialsCost ?? 0),
    validityDays: 30,
    notes: '',
    date: todayISO(),
    city: 'Salvador',
    surgeon: patient?.surgeon ?? '',
  };
}

export function budgetTotal(data: BudgetData): number {
  return (
    (data.surgeonFee || 0) +
    (data.includeFirstAssistant ? (data.firstAssistantFee || 0) : 0) +
    (data.scrubNurseFee || 0) +
    (data.anesthesiaFee || 0) +
    (data.hospitalBudget || 0) +
    (data.materialsCost || 0)
  );
}

export function buildBudgetHtml(data: BudgetData): string {
  const parts: string[] = [];
  parts.push(`<p><strong>Paciente:</strong> ${escapeHtml(data.patientName)}</p>`);
  parts.push(`<p><strong>Procedimento:</strong> ${escapeHtml(data.procedureName)}</p>`);
  parts.push(`<p><strong>Cirurgião:</strong> ${escapeHtml(data.surgeon)}</p>`);
  if (data.hospital) parts.push(`<p><strong>Hospital:</strong> ${escapeHtml(data.hospital)}</p>`);
  parts.push(`<p><strong>Convênio:</strong> ${escapeHtml(data.payer || 'Particular')}</p>`);

  parts.push(`<h3>Composição do orçamento</h3>`);
  parts.push(`<ul>`);
  parts.push(`<li>Honorários do cirurgião: <strong>${formatBRL(data.surgeonFee)}</strong></li>`);
  if (data.includeFirstAssistant) {
    parts.push(`<li>Honorários do 1º auxiliar: <strong>${formatBRL(data.firstAssistantFee)}</strong></li>`);
  }
  if (data.scrubNurseFee > 0) {
    parts.push(`<li>Honorários do instrumentador: <strong>${formatBRL(data.scrubNurseFee)}</strong></li>`);
  }
  parts.push(`<li>Honorários de anestesia: <strong>${formatBRL(data.anesthesiaFee)}</strong></li>`);
  parts.push(`<li>Orçamento hospitalar: <strong>${formatBRL(data.hospitalBudget)}</strong></li>`);
  parts.push(`<li>Materiais especiais: <strong>${formatBRL(data.materialsCost)}</strong></li>`);
  parts.push(`</ul>`);

  parts.push(`<p><strong>Valor total estimado:</strong> ${formatBRL(budgetTotal(data))}</p>`);
  parts.push(`<p>Validade do orçamento: ${data.validityDays || 30} dias.</p>`);
  if (data.notes && data.notes.trim()) {
    const safeNotes = escapeHtml(data.notes).replace(/\n/g, '<br/>');
    parts.push(`<h3>Observações</h3><p>${safeNotes}</p>`);
  }
  const d = parseISODate(data.date) ?? new Date();
  parts.push(`<p>${formatCityDate(data.city || 'Salvador', d)}</p>`);
  parts.push(signatureBlock(data.surgeon));
  return parts.join('\n');
}

/* ---------- Template variables (legacy free-form templates) ---------- */

/**
 * Available variables that can be used inside templates with {{variable}} syntax.
 */
export const TEMPLATE_VARIABLES: { key: string; label: string }[] = [
  { key: 'paciente.nome', label: 'Nome do paciente' },
  { key: 'paciente.idade', label: 'Idade' },
  { key: 'paciente.telefone', label: 'Telefone' },
  { key: 'paciente.email', label: 'Email' },
  { key: 'paciente.responsavel', label: 'Responsável' },
  { key: 'procedimento', label: 'Procedimento' },
  { key: 'via_cirurgica', label: 'Via cirúrgica' },
  { key: 'lateralidade', label: 'Lateralidade' },
  { key: 'cirurgiao', label: 'Cirurgião' },
  { key: 'hospital', label: 'Hospital desejado' },
  { key: 'convenio', label: 'Convênio' },
  { key: 'honorarios_medicos', label: 'Honorários médicos' },
  { key: 'honorarios_anestesia', label: 'Honorários anestesia' },
  { key: 'orcamento_hospitalar', label: 'Orçamento hospitalar' },
  { key: 'materiais', label: 'Materiais especiais' },
  { key: 'valor_total', label: 'Valor total estimado' },
  { key: 'data', label: 'Data atual (DD/MM/AAAA)' },
  { key: 'cidade_data', label: 'Salvador, DD de mês de AAAA' },
];

export function buildPatientVariables(patient: any): Record<string, string> {
  const total = (patient?.medicalFees || 0) + (patient?.anesthesiaFees || 0) + (patient?.hospitalBudget || 0) + (patient?.materialsCost || 0);
  const now = new Date();
  return {
    'paciente.nome': patient?.name ?? '',
    'paciente.idade': patient?.age != null ? `${patient.age} anos` : '—',
    'paciente.telefone': patient?.phone || '—',
    'paciente.email': patient?.email || '—',
    'paciente.responsavel': patient?.responsibleContact || '—',
    procedimento: patient?.procedure ?? '',
    via_cirurgica: patient?.surgicalApproach || '—',
    lateralidade: patient?.laterality || '—',
    cirurgiao: patient?.surgeon ?? '',
    hospital: patient?.desiredHospital || '—',
    convenio: patient?.payer || 'Particular',
    honorarios_medicos: formatBRL(patient?.medicalFees),
    honorarios_anestesia: formatBRL(patient?.anesthesiaFees),
    orcamento_hospitalar: formatBRL(patient?.hospitalBudget),
    materiais: formatBRL(patient?.materialsCost),
    valor_total: total > 0 ? formatBRL(total) : '—',
    data: formatDateBR(now),
    cidade_data: formatCityDate('Salvador', now),
  };
}

export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

export const DEFAULT_TEMPLATE_BODIES: Record<DocumentType, { title: string; body: string }> = {
  budget: {
    title: 'Orçamento — {{procedimento}}',
    body: `<p>Documento gerado a partir do formulário estruturado de Orçamento.</p>`,
  },
  surgical_request: {
    title: 'Solicitação Cirúrgica — {{paciente.nome}}',
    body: `<p>Documento gerado a partir do formulário estruturado.</p>`,
  },
  medical_certificate: {
    title: 'Atestado Médico — {{paciente.nome}}',
    body: `<p>Documento gerado a partir do formulário estruturado de Atestado.</p>`,
  },
  report: {
    title: 'Relatório Médico — {{paciente.nome}}',
    body: `<p>Documento gerado a partir do formulário estruturado de Relatório.</p>`,
  },
  prescription: {
    title: 'Receita Médica — {{paciente.nome}}',
    body: `<p>Documento gerado a partir do formulário estruturado de Receita.</p>`,
  },
};
