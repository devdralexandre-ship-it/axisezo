import { PreOpChecklist as PreOpChecklistType, PREOP_CHECKLIST_ITEMS, PREOP_CHECKLIST_LABELS, PreOpChecklistItem, getPreOpProgress } from '@/data/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ClipboardCheck } from 'lucide-react';

interface PreOpChecklistProps {
  checklist: PreOpChecklistType;
  onToggle: (item: PreOpChecklistItem) => void;
}

export function PreOpChecklist({ checklist, onToggle }: PreOpChecklistProps) {
  const { done, total } = getPreOpProgress(checklist);
  const pct = Math.round((done / total) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <ClipboardCheck className="h-3.5 w-3.5" />
          Checklist Pré-operatório
        </label>
        <span className="text-xs font-medium text-foreground">{done}/{total}</span>
      </div>
      <Progress value={pct} className="h-2" />
      <div className="space-y-1">
        {PREOP_CHECKLIST_ITEMS.map((item) => (
          <label
            key={item}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <Checkbox
              checked={checklist[item]}
              onCheckedChange={() => onToggle(item)}
            />
            <span className={`text-sm ${checklist[item] ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
              {PREOP_CHECKLIST_LABELS[item]}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
