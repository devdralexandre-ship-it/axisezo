export const DOCUMENT_TYPES = ['budget', 'surgical_request', 'medical_certificate', 'report'] as const;
export type DocumentType = typeof DOCUMENT_TYPES[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  budget: 'Orçamento',
  surgical_request: 'Solicitação Cirúrgica',
  medical_certificate: 'Atestado',
  report: 'Relatório',
};

export interface DocumentTemplate {
  id: string;
  type: DocumentType;
  surgeon: string | null;
  title: string;
  body_html: string;
  header_html: string;
  footer_html: string;
  is_default: boolean;
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
  created_at: string;
  updated_at: string;
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

/**
 * Build the variable map from a Patient. Kept loose-typed to avoid a hard
 * dependency cycle with src/data/types.ts.
 */
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

/**
 * Replace {{variable}} placeholders in a template string.
 */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

/**
 * Default seed templates used when no template exists yet for a (type, surgeon) pair.
 * The user can edit / override these in /templates.
 */
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
    body: `<p>Solicito autorização para realização do procedimento abaixo:</p>
<p><strong>Paciente:</strong> {{paciente.nome}} ({{paciente.idade}})</p>
<p><strong>Procedimento:</strong> {{procedimento}} {{via_cirurgica}} {{lateralidade}}</p>
<p><strong>Cirurgião responsável:</strong> {{cirurgiao}}</p>
<p><strong>Hospital sugerido:</strong> {{hospital}}</p>
<p><strong>Convênio:</strong> {{convenio}}</p>
<p><strong>Indicação clínica:</strong> ____________________________________________</p>
<p>{{cidade_data}}</p>
<p>_________________________________<br/>{{cirurgiao}}</p>`,
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
