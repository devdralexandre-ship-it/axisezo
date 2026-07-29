import { useMemo, useState } from 'react';
import { Patient, STAGE_LABELS, DECISION_LABELS, getDaysSinceIndication, getNextPendingTask, getTaskUrgency, LOSS_REASON_LABELS } from '@/data/types';
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  patients: Patient[];
  onPatientClick: (p: Patient) => void;
  canSeeFinancials?: boolean;
}

type ColKey =
  | 'name' | 'stage' | 'decision' | 'procedure' | 'surgeon' | 'concierge'
  | 'patientType' | 'billingType' | 'payer' | 'hospital' | 'indicationDate'
  | 'daysSinceIndication' | 'age' | 'phone' | 'email' | 'estimatedValue'
  | 'medicalFees' | 'surgeryDate' | 'nextTask' | 'nextTaskDue' | 'lossReason'
  | 'flags' | 'createdAt';

interface Col {
  key: ColKey;
  label: string;
  financial?: boolean;
  width?: string;
  align?: 'left' | 'right' | 'center';
  get: (p: Patient) => string | number | null;
  render?: (p: Patient) => React.ReactNode;
}

const currency = (v: number | null | undefined) =>
  v == null ? '' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = iso.length > 10 ? new Date(iso) : new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
};

const ageLabel = (p: Patient) => {
  const parts: string[] = [];
  if (p.age != null) parts.push(`${p.age}a`);
  if (p.ageMonths) parts.push(`${p.ageMonths}m`);
  return parts.join(' ');
};

const COLUMNS: Col[] = [
  { key: 'name', label: 'Paciente', width: 'w-56', get: (p) => p.name },
  { key: 'stage', label: 'Etapa', width: 'w-40', get: (p) => STAGE_LABELS[p.stage] },
  { key: 'decision', label: 'Decisão', width: 'w-28', get: (p) => DECISION_LABELS[p.decisionStatus] },
  { key: 'procedure', label: 'Procedimento', width: 'w-48', get: (p) => p.procedure },
  { key: 'surgeon', label: 'Cirurgião', width: 'w-40', get: (p) => p.surgeon },
  { key: 'concierge', label: 'Concierge', width: 'w-32', get: (p) => p.concierge },
  { key: 'patientType', label: 'Tipo', width: 'w-24', get: (p) => p.patientType || '' },
  { key: 'billingType', label: 'Faturamento', width: 'w-32', get: (p) => p.billingType || '' },
  { key: 'payer', label: 'Convênio', width: 'w-36', get: (p) => p.payer || '' },
  { key: 'hospital', label: 'Hospital', width: 'w-40', get: (p) => p.desiredHospital || '' },
  { key: 'indicationDate', label: 'Indicação', width: 'w-28', get: (p) => p.indicationDate || '', render: (p) => fmtDate(p.indicationDate) },
  { key: 'daysSinceIndication', label: 'Dias', width: 'w-16', align: 'right', get: (p) => getDaysSinceIndication(p) },
  { key: 'age', label: 'Idade', width: 'w-20', get: () => '', render: ageLabel },
  { key: 'phone', label: 'Telefone', width: 'w-32', get: (p) => p.phone || '' },
  { key: 'email', label: 'Email', width: 'w-48', get: (p) => p.email || '' },
  { key: 'estimatedValue', label: 'Ticket est.', width: 'w-28', align: 'right', financial: true, get: (p) => p.estimatedValue ?? 0, render: (p) => currency(p.estimatedValue) },
  { key: 'medicalFees', label: 'Honorários', width: 'w-28', align: 'right', financial: true, get: (p) => p.medicalFees ?? 0, render: (p) => currency(p.medicalFees) },
  { key: 'surgeryDate', label: 'Cirurgia', width: 'w-28', get: (p) => p.surgeryDate || '', render: (p) => fmtDate(p.surgeryDate) },
  { key: 'nextTask', label: 'Próxima ação', width: 'w-56', get: (p) => getNextPendingTask(p)?.title || '' },
  { key: 'nextTaskDue', label: 'Vence', width: 'w-24', get: (p) => getNextPendingTask(p)?.dueDate || '', render: (p) => fmtDate(getNextPendingTask(p)?.dueDate) },
  { key: 'lossReason', label: 'Motivo perda', width: 'w-40', get: (p) => (p.lossReason ? LOSS_REASON_LABELS[p.lossReason] : '') },
  { key: 'flags', label: 'Sinais', width: 'w-20', get: (p) => `${p.clinicallySensitive ? 1 : 0}${p.highRisk ? 1 : 0}${p.highTicket ? 1 : 0}`, render: (p) => (
      <span className="inline-flex gap-1 text-xs">
        {p.clinicallySensitive && <span title="Clinicamente sensível" className="text-pipeline-amber">*</span>}
        {p.highRisk && <span title="Altíssimo risco" className="text-destructive font-bold">**</span>}
        {p.highTicket && <span title="Alto ticket" className="text-pipeline-green">★</span>}
      </span>
  ) },
  { key: 'createdAt', label: 'Criado em', width: 'w-28', get: (p) => p.createdAt, render: (p) => fmtDate(p.createdAt) },
];

export function PatientsTable({ patients, onPatientClick, canSeeFinancials = true }: Props) {
  const [sortKey, setSortKey] = useState<ColKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const visibleCols = useMemo(
    () => COLUMNS.filter((c) => (c.financial ? canSeeFinancials : true)),
    [canSeeFinancials],
  );

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey);
    if (!col) return patients;
    const arr = [...patients];
    arr.sort((a, b) => {
      const va = col.get(a);
      const vb = col.get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      return sortDir === 'asc' ? sa.localeCompare(sb, 'pt-BR') : sb.localeCompare(sa, 'pt-BR');
    });
    return arr;
  }, [patients, sortKey, sortDir]);

  const toggleSort = (k: ColKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  };

  const exportCsv = () => {
    const headers = visibleCols.map((c) => c.label);
    const rows = sorted.map((p) =>
      visibleCols.map((c) => {
        const raw = c.get(p);
        const str = raw == null ? '' : String(raw);
        return `"${str.replace(/"/g, '""')}"`;
      }).join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pacientes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <span className="text-xs text-muted-foreground">
          {sorted.length} paciente{sorted.length === 1 ? '' : 's'}
        </span>
        <Button size="sm" variant="outline" onClick={exportCsv} className="h-7 text-xs">
          <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar CSV
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="text-xs border-collapse min-w-max">
          <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_hsl(var(--border))]">
            <tr>
              {visibleCols.map((c, i) => (
                <th
                  key={c.key}
                  className={`text-left font-medium px-2 py-2 border-b border-border select-none cursor-pointer hover:bg-muted/50 ${c.width || ''} ${
                    i === 0 ? 'sticky left-0 z-20 bg-background' : ''
                  } ${c.align === 'right' ? 'text-right' : ''}`}
                  onClick={() => toggleSort(c.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {sortKey === c.key ? (
                      sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr
                key={p.id}
                className="border-b border-border hover:bg-muted/40 cursor-pointer"
                onClick={() => onPatientClick(p)}
              >
                {visibleCols.map((c, i) => {
                  const content = c.render ? c.render(p) : (c.get(p) ?? '');
                  const nextUrgent = c.key === 'nextTask' ? getTaskUrgency(getNextPendingTask(p)) : undefined;
                  return (
                    <td
                      key={c.key}
                      className={`px-2 py-1.5 truncate max-w-[300px] ${c.width || ''} ${
                        i === 0 ? 'sticky left-0 z-10 bg-background font-medium' : ''
                      } ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${
                        nextUrgent === 'red' ? 'text-destructive' : nextUrgent === 'yellow' ? 'text-pipeline-amber' : ''
                      }`}
                      title={typeof content === 'string' || typeof content === 'number' ? String(content) : undefined}
                    >
                      {content as any}
                    </td>
                  );
                })}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={visibleCols.length} className="text-center text-muted-foreground py-8">
                  Nenhum paciente encontrado com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
