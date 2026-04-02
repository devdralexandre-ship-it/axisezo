export const PIPELINE_STAGES = [
  'indication',
  'first_contact',
  'budget_preparation',
  'budget_sent',
  'awaiting_authorization',
  'decision_pending',
  'followup_negotiation',
  'preop_preparation',
  'surgery_scheduled',
  'surgery_completed',
  'lost',
] as const;

export type PipelineStage = typeof PIPELINE_STAGES[number];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  indication: 'Indicação',
  first_contact: 'Primeiro Contato',
  budget_preparation: 'Preparo de Orçamento',
  budget_sent: 'Orçamento Enviado',
  decision_pending: 'Decisão Pendente',
  followup_negotiation: 'Follow-up / Negociação',
  preop_preparation: 'Preparo Pré-operatório',
  surgery_scheduled: 'Cirurgia Agendada',
  surgery_completed: 'Cirurgia Realizada',
  lost: 'Perdido / Não Procedeu',
};

export type DecisionStatus = 'waiting' | 'thinking' | 'negotiating' | 'confirmed';

export const DECISION_LABELS: Record<DecisionStatus, string> = {
  waiting: 'Aguardando',
  thinking: 'Pensando',
  negotiating: 'Negociando',
  confirmed: 'Confirmado',
};

export const LOSS_REASONS = [
  'price',
  'delay',
  'clinical_contraindication',
  'chose_another',
  'other',
] as const;

export type LossReason = typeof LOSS_REASONS[number];

export const LOSS_REASON_LABELS: Record<LossReason, string> = {
  price: 'Preço',
  delay: 'Demora / Falta de urgência',
  clinical_contraindication: 'Contraindicação clínica',
  chose_another: 'Escolheu outro prestador',
  other: 'Outro',
};

export const PREOP_CHECKLIST_ITEMS = [
  'preop_labs',
  'cardiology_clearance',
  'preanesthesia',
  'surgical_request',
  'authorization',
  'surgery_scheduling',
] as const;

export type PreOpChecklistItem = typeof PREOP_CHECKLIST_ITEMS[number];

export const PREOP_CHECKLIST_LABELS: Record<PreOpChecklistItem, string> = {
  preop_labs: 'Exames pré-operatórios',
  cardiology_clearance: 'Risco cirúrgico / Parecer especialista',
  preanesthesia: 'Consulta pré-anestésica',
  surgical_request: 'Pedido cirúrgico',
  authorization: 'Autorização',
  surgery_scheduling: 'Agendamento da cirurgia',
};

export const OWNERS = [
  'Dr Alexandre Ziomkowski',
  'Dr João Estrela',
  'Dr Evaristo Oliveira',
  'Margô',
  'Call Center',
] as const;

export type Owner = typeof OWNERS[number];

export const OWNER_INITIALS: Record<Owner, string> = {
  'Dr Alexandre Ziomkowski': 'AZ',
  'Dr João Estrela': 'JE',
  'Dr Evaristo Oliveira': 'EO',
  'Margô': 'MG',
  'Call Center': 'CC',
};

export const OWNER_COLORS: Record<Owner, string> = {
  'Dr Alexandre Ziomkowski': 'bg-primary/15 text-primary',
  'Dr João Estrela': 'bg-pipeline-green/15 text-pipeline-green',
  'Dr Evaristo Oliveira': 'bg-pipeline-amber/15 text-pipeline-amber',
  'Margô': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Call Center': 'bg-muted text-muted-foreground',
};

export interface PendingItem {
  id: string;
  title: string;
  checked: boolean;
}

export interface PatientTask {
  id: string;
  title: string;
  dueDate: string;
  dueTime: string;
  responsible: Owner;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
}

export type UrgencyLevel = 'green' | 'yellow' | 'red';

export interface ContactRecord {
  id: string;
  date: string;
  type: 'phone' | 'whatsapp' | 'email' | 'in_person';
  note: string;
  by: string;
}

export interface Notification {
  id: string;
  message: string;
  patientId: string;
  patientName: string;
  type: 'task_overdue' | 'task_due_today' | 'stage_changed' | 'task_completed';
  read: boolean;
  createdAt: string;
}

export type PreOpChecklist = Record<PreOpChecklistItem, boolean>;

export const DEFAULT_PREOP_CHECKLIST: PreOpChecklist = {
  preop_labs: false,
  cardiology_clearance: false,
  preanesthesia: false,
  surgical_request: false,
  authorization: false,
  surgery_scheduling: false,
};

export interface Patient {
  id: string;
  name: string;
  age: number | null;
  patientType: string; // 'adult' | 'pediatric'
  procedure: string;
  procedureCategory: string;
  surgicalApproach: string | null;
  surgeon: string;
  concierge: string;
  owner: Owner;
  stage: PipelineStage;
  stageEnteredAt: string;
  decisionStatus: DecisionStatus;
  estimatedValue: number | null;
  lastInteractionDate: string;
  nextFollowUpDate: string | null;
  phone: string;
  email: string;
  contacts: ContactRecord[];
  tasks: PatientTask[];
  pendingItems: PendingItem[];
  createdAt: string;

  indicationDate: string | null;
  indicationLocation: string | null;
  payer: string | null;
  billingType: string | null;
  medicalFees: number | null;
  responsibleContact: string | null;
  desiredHospital: string | null;
  notes: string | null;
  alerts: string | null;
  lossReason: LossReason | null;
  lossReasonDetail: string | null;
  anesthesiaFees: number | null;
  hospitalBudget: number | null;
  materialsCost: number | null;
  preOpChecklist: PreOpChecklist;
}

export function getNextPendingTask(patient: Patient): PatientTask | undefined {
  return patient.tasks
    .filter((t) => !t.completed)
    .sort((a, b) => {
      const da = new Date(`${a.dueDate}T${a.dueTime}`).getTime();
      const db = new Date(`${b.dueDate}T${b.dueTime}`).getTime();
      return da - db;
    })[0];
}

export function getTaskUrgency(task: PatientTask | undefined): UrgencyLevel {
  if (!task) return 'red';
  const now = new Date();
  const due = new Date(`${task.dueDate}T${task.dueTime}`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  if (dueDay < today) return 'red';
  if (dueDay.getTime() === today.getTime()) return 'yellow';
  return 'green';
}

export function getDaysInStage(stageEnteredAt: string): number {
  const entered = new Date(stageEnteredAt + 'T00:00:00');
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24)));
}

export function getPreOpProgress(checklist: PreOpChecklist): { done: number; total: number } {
  const total = PREOP_CHECKLIST_ITEMS.length;
  const done = PREOP_CHECKLIST_ITEMS.filter((k) => checklist[k]).length;
  return { done, total };
}
