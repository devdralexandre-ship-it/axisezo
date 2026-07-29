import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Patient, getNextPendingTask, getTaskUrgency } from '@/data/types';

export type SortKey = 'stage_days' | 'urgency' | 'value' | 'indication';
export type SortDir = 'asc' | 'desc';

export const SORT_LABELS: Record<SortKey, string> = {
  stage_days: 'Dias no estágio',
  urgency: 'Urgência da ação',
  value: 'Valor estimado',
  indication: 'Data de indicação',
};

interface Props {
  sortKey: SortKey;
  sortDir: SortDir;
  onKeyChange: (k: SortKey) => void;
  onDirChange: (d: SortDir) => void;
  compact?: boolean;
}

export function SortControl({ sortKey, sortDir, onKeyChange, onDirChange, compact }: Props) {
  return (
    <div className="flex items-center gap-1">
      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
      <Select value={sortKey} onValueChange={(v) => onKeyChange(v as SortKey)}>
        <SelectTrigger className={compact ? 'h-8 w-[150px] text-xs' : 'h-9 w-[170px]'}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        className={compact ? 'h-8 w-8' : 'h-9 w-9'}
        onClick={() => onDirChange(sortDir === 'asc' ? 'desc' : 'asc')}
        title={sortDir === 'asc' ? 'Crescente' : 'Decrescente'}
      >
        {sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

const URGENCY_RANK: Record<string, number> = { red: 0, yellow: 1, green: 2 };

export function sortPatients(patients: Patient[], key: SortKey, dir: SortDir): Patient[] {
  const mult = dir === 'asc' ? 1 : -1;
  const sorted = [...patients].sort((a, b) => {
    switch (key) {
      case 'stage_days': {
        const da = new Date(a.stageEnteredAt + 'T00:00:00').getTime();
        const db = new Date(b.stageEnteredAt + 'T00:00:00').getTime();
        return (da - db) * mult;
      }
      case 'urgency': {
        const ua = URGENCY_RANK[getTaskUrgency(getNextPendingTask(a))];
        const ub = URGENCY_RANK[getTaskUrgency(getNextPendingTask(b))];
        return (ua - ub) * mult;
      }
      case 'value': {
        const va = (a.medicalFees ?? 0) + (a.anesthesiaFees ?? 0) + (a.hospitalBudget ?? 0) + (a.materialsCost ?? 0);
        const vb = (b.medicalFees ?? 0) + (b.anesthesiaFees ?? 0) + (b.hospitalBudget ?? 0) + (b.materialsCost ?? 0);
        return (va - vb) * mult;
      }
      case 'indication': {
        const da = new Date((a.indicationDate || a.createdAt || '9999-12-31') + 'T00:00:00').getTime();
        const db = new Date((b.indicationDate || b.createdAt || '9999-12-31') + 'T00:00:00').getTime();
        return (da - db) * mult;
      }
    }
  });
  return sorted;
}
