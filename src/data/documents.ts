export const DOCUMENT_TYPES = ['budget', 'surgical_request', 'medical_certificate', 'report'] as const;
export type DocumentType = typeof DOCUMENT_TYPES[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  budget: 'Orçamento',
  surgical_request: 'Solicitação Cirúrgica',
  medical_certificate: 'Atestado',
  report: 'Relatório',
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

function escapeHtml(s: string): string {
  return (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

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

  const now = new Date();
  const months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  parts.push(`<p>Salvador, ${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}</p>`);
  parts.push(`<p>_________________________________<br/>${escapeHtml(data.surgeon)}</p>`);

  return parts.join('\n');
}

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

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function formatBRL(v: number | null | undefined): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function formatDateBR(d: Date) {
  return d.toLocaleDateString('pt-BR');
}

function formatCityDate(d: Date) {
  return `Salvador, ${d.getDate()} de ${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`;
}

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
    cidade_data: formatCityDate(now),
  };
}

export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

export const DEFAULT_TEMPLATE_BODIES: Record<DocumentType, { title: string; body: string }> = {
  budget: {
    title: 'Orçamento — {{procedimento}}',
    body: `<p><strong>Paciente:</strong> {{paciente.nome}} ({{paciente.idade}})</p>
<p><strong>Procedimento:</strong> {{procedimento}} {{via_cirurgica}} {{lateralidade}}</p>
<p><strong>Cirurgião:</strong> {{cirurgiao}}</p>
<p><strong>Hospital:</strong> {{hospital}}</p>
<p><strong>Convênio:</strong> {{convenio}}</p>
<h3>Composição do orçamento</h3>
<ul>
  <li>Honorários médicos: {{honorarios_medicos}}</li>
  <li>Honorários anestesia: {{honorarios_anestesia}}</li>
  <li>Orçamento hospitalar: {{orcamento_hospitalar}}</li>
  <li>Materiais especiais: {{materiais}}</li>
</ul>
<p><strong>Valor total estimado:</strong> {{valor_total}}</p>
<p>Validade: 30 dias.</p>
<p>{{cidade_data}}</p>`,
  },
  surgical_request: {
    title: 'Solicitação Cirúrgica — {{paciente.nome}}',
    body: `<p>Este documento é gerado a partir do formulário estruturado.</p>`,
  },
  medical_certificate: {
    title: 'Atestado Médico — {{paciente.nome}}',
    body: `<p>Atesto, para os devidos fins, que o(a) paciente <strong>{{paciente.nome}}</strong> esteve sob meus cuidados médicos nesta data, sendo necessário afastamento de suas atividades habituais por _____ dias.</p>
<p>CID: ______</p>
<p>{{cidade_data}}</p>
<p>_________________________________<br/>{{cirurgiao}}</p>`,
  },
  report: {
    title: 'Relatório Médico — {{paciente.nome}}',
    body: `<p><strong>Paciente:</strong> {{paciente.nome}} ({{paciente.idade}})</p>
<p><strong>Procedimento realizado:</strong> {{procedimento}} {{via_cirurgica}} {{lateralidade}}</p>
<p><strong>Cirurgião:</strong> {{cirurgiao}}</p>
<p><strong>Hospital:</strong> {{hospital}}</p>
<p><strong>Histórico clínico:</strong> ____________________________________________</p>
<p><strong>Conduta / Observações:</strong> ____________________________________________</p>
<p>{{cidade_data}}</p>
<p>_________________________________<br/>{{cirurgiao}}</p>`,
  },
};
