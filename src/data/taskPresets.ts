export const TASK_PRESETS = [
  'Atualizar etapa no follow-up',
  'Checar documentos',
  'Emitir documentos',
  'Consultar convênio',
  'Consultar hospital',
  'Ligar para o paciente',
  'Confirmar agendamento',
  'Solicitar exames / laudos',
] as const;

export const TASK_PRESET_OTHER = 'Outro (escrever livremente)';

export type TaskPreset = typeof TASK_PRESETS[number];
