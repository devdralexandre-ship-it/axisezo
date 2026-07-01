import { useEffect, useMemo, useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Owner } from '@/data/types';
import { SURGEONS, CONCIERGES } from '@/data/constants';
import { useTaskTitleSuggestions } from '@/hooks/useTaskTitleSuggestions';
import { normalizeText } from '@/lib/utils';

export interface TaskDraft {
  /** Kept for backwards compatibility — no longer surfaced in UI */
  preset: string;
  title: string;
  dueDate: string;
  dueTime: string;
  responsible: Owner;
  /** "Tolerância" in hours — counted FROM the deadline (dueDate + dueTime) */
  slaHours: number;
  /** Fixed at 24h server-side; kept here for type compatibility */
  escalateAfterHours: number;
}

/** Responsibles available in the action form: surgeons + concierges. */
export const TASK_RESPONSIBLES: readonly string[] = [...SURGEONS, ...CONCIERGES];

/** Default deadline = now + 24h, rounded to next 30min for cleaner UX. */
function defaultDeadline(): { date: string; time: string } {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  // Round minutes up to next :00 or :30
  const m = d.getMinutes();
  if (m > 30) {
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
  } else if (m > 0) {
    d.setMinutes(30);
  }
  d.setSeconds(0); d.setMilliseconds(0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export const emptyTaskDraft = (defaultResponsible?: Owner): TaskDraft => {
  const dl = defaultDeadline();
  // Only fall back to the provided default; NEVER auto-pick the first surgeon.
  // If nothing is provided, leave the field blank so the user picks explicitly.
  const resp = (defaultResponsible && String(defaultResponsible).trim())
    ? (defaultResponsible as Owner)
    : ('' as Owner);
  return {
    preset: '',
    title: '',
    dueDate: dl.date,
    dueTime: dl.time,
    responsible: resp,
    slaHours: 24,
    escalateAfterHours: 24,
  };
};

interface Props {
  value: TaskDraft;
  onChange: (draft: TaskDraft) => void;
  /** Compact layout for use inside other forms */
  compact?: boolean;
}

export function TaskFormFields({ value, onChange, compact = false }: Props) {
  const set = <K extends keyof TaskDraft>(k: K, v: TaskDraft[K]) =>
    onChange({ ...value, [k]: v });

  const labelCls = compact ? 'text-[11px]' : '';
  const inputCls = compact ? 'h-8 text-sm' : '';

  // ---- Title autocomplete ----
  const { data: suggestions = [] } = useTaskTitleSuggestions();
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredSuggestions = useMemo(() => {
    const q = normalizeText(value.title);
    const list = q
      ? suggestions.filter((s) => { const n = normalizeText(s); return n.includes(q) && n !== q; })
      : suggestions;
    return list.slice(0, 8);
  }, [suggestions, value.title]);

  // ---- Responsible list: include legacy value if not in current list ----
  const responsibleOptions = useMemo(() => {
    const list = [...TASK_RESPONSIBLES];
    if (value.responsible && !list.includes(value.responsible as string)) {
      list.push(value.responsible as string);
    }
    return list;
  }, [value.responsible]);

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="space-y-2" ref={wrapRef}>
        <Label className={labelCls}>Título da ação *</Label>
        <div className="relative">
          <Input
            value={value.title}
            onChange={(e) => set('title', e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="Ex.: Ligar para o paciente"
            className={inputCls}
            autoComplete="off"
          />
          {focused && filteredSuggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-auto rounded-md border border-border bg-popover shadow-md">
              {filteredSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    set('title', s);
                    setFocused(false);
                  }}
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        {!focused && suggestions.length === 0 && value.title === '' && (
          <p className="text-[11px] text-muted-foreground">Conforme outras ações forem sendo criadas, aparecerão como sugestões aqui.</p>
        )}
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
        <Label className={labelCls}>Responsável *</Label>
        <Select value={value.responsible || undefined} onValueChange={(v) => set('responsible', v as Owner)}>
          <SelectTrigger className={inputCls}><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
          <SelectContent>
            {responsibleOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className={labelCls}>Tolerância (horas)</Label>
        <Input
          type="number"
          min={0}
          value={value.slaHours}
          onChange={(e) => set('slaHours', Math.max(0, parseInt(e.target.value) || 0))}
          className={inputCls}
        />
        <p className="text-[11px] text-muted-foreground leading-snug">
          Tempo de tolerância contado a partir do esgotamento do prazo máximo. Após esse período, a ação é escalada automaticamente (24h depois) e segue visível para a concierge responsável e para o cirurgião do caso.
        </p>
      </div>
    </div>
  );
}
