import { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OWNERS, Owner } from '@/data/types';
import { TASK_PRESETS, TASK_PRESET_OTHER } from '@/data/taskPresets';

export interface TaskDraft {
  preset: string;
  title: string;
  dueDate: string;
  dueTime: string;
  responsible: Owner;
  slaHours: number;
  escalateAfterHours: number;
}

export const emptyTaskDraft = (defaultResponsible?: Owner): TaskDraft => ({
  preset: TASK_PRESETS[0],
  title: TASK_PRESETS[0],
  dueDate: '',
  dueTime: '10:00',
  responsible: defaultResponsible || OWNERS[0],
  slaHours: 24,
  escalateAfterHours: 24,
});

interface Props {
  value: TaskDraft;
  onChange: (draft: TaskDraft) => void;
  /** Compact layout for use inside other forms */
  compact?: boolean;
}

export function TaskFormFields({ value, onChange, compact = false }: Props) {
  // Sync title with preset
  useEffect(() => {
    if (value.preset !== TASK_PRESET_OTHER && value.title !== value.preset) {
      onChange({ ...value, title: value.preset });
    }
    if (value.preset === TASK_PRESET_OTHER && value.title === TASK_PRESETS[0]) {
      onChange({ ...value, title: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.preset]);

  const set = <K extends keyof TaskDraft>(k: K, v: TaskDraft[K]) =>
    onChange({ ...value, [k]: v });

  const labelCls = compact ? 'text-[11px]' : '';
  const inputCls = compact ? 'h-8 text-sm' : '';

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="space-y-2">
        <Label className={labelCls}>Tipo de ação</Label>
        <Select value={value.preset} onValueChange={(v) => set('preset', v)}>
          <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
          <SelectContent>
            {TASK_PRESETS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            <SelectItem value={TASK_PRESET_OTHER}>{TASK_PRESET_OTHER}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className={labelCls}>Título *</Label>
        <Input
          value={value.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder={value.preset === TASK_PRESET_OTHER ? 'Descreva a ação' : ''}
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className={labelCls}>Prazo máximo *</Label>
          <Input type="date" value={value.dueDate} onChange={(e) => set('dueDate', e.target.value)} className={inputCls} />
        </div>
        <div className="space-y-2">
          <Label className={labelCls}>Horário</Label>
          <Input type="time" value={value.dueTime} onChange={(e) => set('dueTime', e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="space-y-2">
        <Label className={labelCls}>Responsável</Label>
        <Select value={value.responsible} onValueChange={(v) => set('responsible', v as Owner)}>
          <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
          <SelectContent>
            {OWNERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className={labelCls}>SLA (horas)</Label>
          <Input
            type="number"
            min={1}
            value={value.slaHours}
            onChange={(e) => set('slaHours', Math.max(1, parseInt(e.target.value) || 24))}
            className={inputCls}
          />
        </div>
        <div className="space-y-2">
          <Label className={labelCls}>Escalar após (h)</Label>
          <Input
            type="number"
            min={1}
            value={value.escalateAfterHours}
            onChange={(e) => set('escalateAfterHours', Math.max(1, parseInt(e.target.value) || 24))}
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
}
