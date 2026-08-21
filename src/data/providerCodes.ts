import { normalizeText } from '@/lib/utils';

export interface ProviderCodeRule {
  /** Canonical payer label */
  payer: string;
  /** Alternative spellings that should match */
  aliases?: string[];
  /** Provider code / identification used by Cooperuro */
  code: string;
  /** Applicability note shown to the user */
  note?: string;
}

const COOPERURO_CNPJ = 'CNPJ 05.027.686/0001-28';

export const COOPERURO_PROVIDER_CODES: ProviderCodeRule[] = [
  { payer: 'Amil', code: '45418691', note: 'Contrato regular COOPERURO' },
  { payer: 'ASFEB', code: COOPERURO_CNPJ, note: 'O manual usa o CNPJ como identificação do prestador' },
  { payer: 'Golden Cross', code: COOPERURO_CNPJ },
  {
    payer: 'Seguros Unimed',
    code: '009990976023',
    note: 'Somente nas áreas: Alagoinhas, Camaçari, Candeias, Catu, Ipiaú, Jequié, Lauro de Freitas, Salvador e Santo Amaro',
  },
  { payer: 'ASSEFAZ', code: COOPERURO_CNPJ },
  { payer: 'GEAP', code: '4043758', note: 'Contrato regular COOPERURO' },
  { payer: 'CAMED', code: COOPERURO_CNPJ },
  { payer: 'Luminar', aliases: ['Luminar / antiga FACHESF', 'FACHESF'], code: COOPERURO_CNPJ, note: 'Mesmo padrão da CAMED' },
  {
    payer: 'Unimed Central Nacional – CNU',
    aliases: ['Unimed CNU', 'CNU', 'Unimed Central Nacional'],
    code: '97510411',
    note: 'Exclusivamente no Hospital Mater Dei, para carteiras iniciadas em 865 ou 067, além de intercâmbios com cobertura no Mater Dei',
  },
];

/** Finds the Cooperuro provider code rule for a given payer name (tolerant matching). */
export function findProviderCodeRule(payer: string | null | undefined): ProviderCodeRule | null {
  const q = normalizeText(payer ?? '');
  if (!q) return null;
  for (const rule of COOPERURO_PROVIDER_CODES) {
    const candidates = [rule.payer, ...(rule.aliases ?? [])].map(normalizeText);
    if (candidates.some((c) => c && (q === c || q.includes(c) || c.includes(q)))) return rule;
  }
  return null;
}
