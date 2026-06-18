// Urology CRM constants

export const PROCEDURES = [
  'Prostatectomia Radical',
  'Prostatectomia Transvesical (PTV)',
  'Nefrectomia Parcial',
  'Nefrectomia Radical',
  'Cistectomia Radical',
  'Pieloplastia',
  'RTU de bexiga',
  'RTU de próstata',
  'URS Flexível',
  'URS Rígida',
  'Nefrolitotripsia Percutânea',
  'Retirada de Duplo J',
  'Postectomia',
  'Orquidopexia',
  'Orquiectomia',
  'Herniorrafia Inguinal',
  'Hidrocelectomia',
  'Hipospádia',
  'Tratamento do Refluxo Vésico-ureteral',
  'Uretrotomia Interna',
  'Uretroplastia',
  'Sling Masculino',
  'Sling Feminino',
  'Colpoperineoplastia',
  'Implante de Esfíncter Artificial',
  'Implante de Prótese peniana',
  'Cistoscopia',
  'Varicocelectomia',
  'Vasectomia',
  'Reversão de Vasectomia',
] as const;

export const PROCEDURES_WITH_LATERALITY = [
  'Varicocelectomia',
  'Nefrectomia Parcial',
  'Nefrectomia Radical',
  'Pieloplastia',
  'URS Flexível',
  'URS Rígida',
  'Nefrolitotripsia Percutânea',
  'Orquidopexia',
  'Orquiectomia',
  'Herniorrafia Inguinal',
  'Hidrocelectomia',
  'Tratamento do Refluxo Vésico-ureteral',
] as const;
export const LATERALITY_OPTIONS = ['Direita', 'Esquerda', 'Bilateral'] as const;

export function procedureNeedsLaterality(procedure: string): boolean {
  return (PROCEDURES_WITH_LATERALITY as readonly string[]).includes(procedure);
}

export const PROCEDURES_WITH_APPROACH = [
  'Prostatectomia Radical',
  'Prostatectomia Transvesical (PTV)',
  'Nefrectomia Parcial',
  'Nefrectomia Radical',
  'Cistectomia Radical',
  'Pieloplastia',
] as const;

export const SURGICAL_APPROACHES = ['Convencional', 'Laparoscópica', 'Robótica'] as const;

export const SURGEONS = [
  'Dr Alexandre Ziomkowski',
  'Dr Evaristo Oliveira',
  'Dr João Estrela',
] as const;

export const CONCIERGES = ['Margô', 'Íris'] as const;

export const PAYERS = [
  'Bradesco',
  'Sulamérica',
  'Amil',
  'Cassi',
  'Cassi Vida',
  'Seguros Unimed',
  'Petrobras',
  'CNU',
  'Assefaz',
  'Saúde Caixa',
  'Planserv',
  'Select',
  'Não tem',
  'Outros',
] as const;

export const BILLING_TYPES = ['Cooperuro', 'Unicooper', 'Honorários Médicos Particulares', 'Custos Totais Particulares'] as const;

export const PATIENT_TYPES = ['adult', 'pediatric'] as const;

export const PATIENT_TYPE_LABELS: Record<string, string> = {
  adult: 'Adulto',
  pediatric: 'Pediátrico',
};

export const HOSPITALS = [
  'Hospital Mater Dei',
  'Hospital Aliança',
  'Hospital Santa Izabel',
  'Hospital Ferreira Filho',
  'Clínica Cliderma',
  'Hospital Português',
  'Hospital São Rafael',
  'Outro',
] as const;

export const INDICATION_SOURCES = [
  'Clínica Uro',
  'Uroclínica',
  'Centro Médico Mater Dei',
  'Itaigara Memorial',
  'Valença',
  'Serrinha',
  'Outro',
] as const;

export function procedureNeedsApproach(procedure: string): boolean {
  return (PROCEDURES_WITH_APPROACH as readonly string[]).includes(procedure);
}
