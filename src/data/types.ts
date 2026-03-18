export const PIPELINE_STAGES = [
  'indication',
  'first_contact',
  'budget_preparation',
  'budget_sent',
  'decision_pending',
  'followup_negotiation',
  'preop_preparation',
  'surgery_scheduled',
  'surgery_completed',
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
};

export type DecisionStatus = 'waiting' | 'thinking' | 'negotiating' | 'confirmed';

export const DECISION_LABELS: Record<DecisionStatus, string> = {
  waiting: 'Aguardando',
  thinking: 'Pensando',
  negotiating: 'Negociando',
  confirmed: 'Confirmado',
};

export interface ContactRecord {
  id: string;
  date: string;
  type: 'phone' | 'whatsapp' | 'email' | 'in_person';
  note: string;
  by: string;
}

export interface Patient {
  id: string;
  name: string;
  procedure: string;
  surgeon: string;
  concierge: string;
  stage: PipelineStage;
  decisionStatus: DecisionStatus;
  estimatedValue: number | null;
  lastInteractionDate: string;
  nextAction: string;
  nextFollowUpDate: string | null;
  phone: string;
  email: string;
  contacts: ContactRecord[];
  createdAt: string;
}
