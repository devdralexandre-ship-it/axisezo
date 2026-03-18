import { Patient, DECISION_LABELS, OWNER_INITIALS, OWNER_COLORS, getNextPendingTask, getTaskUrgency, getDaysInStage } from '@/data/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, UserRound, Clock, CheckCircle2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const decisionColors: Record<string, string> = {
  waiting: 'bg-muted text-muted-foreground',
  thinking: 'bg-pipeline-amber/15 text-pipeline-amber border-pipeline-amber/30',
  negotiating: 'bg-primary/10 text-primary border-primary/30',
  confirmed: 'bg-pipeline-green/15 text-pipeline-green border-pipeline-green/30',
};

const urgencyBorder: Record<string, string> = {
  green: 'border-l-pipeline-green',
  yellow: 'border-l-pipeline-amber',
  red: 'border-l-destructive',
};

interface PatientCardProps {
  patient: Patient;
  onClick: (patient: Patient) => void;
  onCompleteTask: (patientId: string, taskId: string) => void;
}

export function PatientCard({ patient, onClick, onCompleteTask }: PatientCardProps) {
  const nextTask = getNextPendingTask(patient);
  const urgency = getTaskUrgency(nextTask);
  const daysInStage = getDaysInStage(patient.stageEnteredAt);

  const formatCurrency = (value: number | null) => {
    if (value === null) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 border-border/60 border-l-[3px] ${urgencyBorder[urgency]}`}
      onClick={() => onClick(patient)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarFallback className={`text-[9px] font-bold ${OWNER_COLORS[patient.owner]}`}>
                {OWNER_INITIALS[patient.owner]}
              </AvatarFallback>
            </Avatar>
            <h4 className="font-semibold text-sm text-foreground leading-tight truncate">{patient.name}</h4>
          </div>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${decisionColors[patient.decisionStatus]}`}>
            {DECISION_LABELS[patient.decisionStatus]}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground truncate">{patient.procedure}</p>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <UserRound className="h-3 w-3" />
            {patient.surgeon}
          </span>
          {patient.estimatedValue !== null && (
            <span className="font-medium text-foreground">{formatCurrency(patient.estimatedValue)}</span>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(patient.lastInteractionDate)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {daysInStage}d na etapa
          </span>
        </div>

        {/* Next pending task */}
        {nextTask ? (
          <div
            className={`flex items-center gap-1.5 text-[11px] p-1.5 rounded ${
              urgency === 'red' ? 'bg-destructive/10 text-destructive' :
              urgency === 'yellow' ? 'bg-pipeline-amber/10 text-pipeline-amber' :
              'bg-pipeline-green/10 text-pipeline-green'
            }`}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onCompleteTask(patient.id, nextTask.id); }}
              className="shrink-0 hover:scale-110 transition-transform"
              title="Marcar como concluída"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
            <span className="truncate">{nextTask.title}</span>
            <span className="shrink-0 ml-auto">{formatDate(nextTask.dueDate)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] p-1.5 rounded bg-destructive/10 text-destructive">
            <span>⚠ Sem tarefa pendente</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
