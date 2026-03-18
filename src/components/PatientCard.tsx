import { Patient, DECISION_LABELS } from '@/data/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, UserRound, ArrowRight } from 'lucide-react';

const decisionColors: Record<string, string> = {
  waiting: 'bg-muted text-muted-foreground',
  thinking: 'bg-pipeline-amber/15 text-pipeline-amber border-pipeline-amber/30',
  negotiating: 'bg-primary/10 text-primary border-primary/30',
  confirmed: 'bg-pipeline-green/15 text-pipeline-green border-pipeline-green/30',
};

interface PatientCardProps {
  patient: Patient;
  onClick: (patient: Patient) => void;
}

export function PatientCard({ patient, onClick }: PatientCardProps) {
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
      className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 border-border/60"
      onClick={() => onClick(patient)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm text-foreground leading-tight truncate">{patient.name}</h4>
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

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{formatDate(patient.lastInteractionDate)}</span>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-pipeline-blue">
          <ArrowRight className="h-3 w-3" />
          <span className="truncate">{patient.nextAction}</span>
        </div>
      </CardContent>
    </Card>
  );
}
