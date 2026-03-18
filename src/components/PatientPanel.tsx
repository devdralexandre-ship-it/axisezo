import { Patient, DECISION_LABELS, DecisionStatus, STAGE_LABELS } from '@/data/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FollowUpTimeline } from './FollowUpTimeline';
import { Calendar, UserRound, Stethoscope, DollarSign, ArrowRight, Clock } from 'lucide-react';

const decisionColors: Record<string, string> = {
  waiting: 'bg-muted text-muted-foreground',
  thinking: 'bg-pipeline-amber/15 text-pipeline-amber border-pipeline-amber/30',
  negotiating: 'bg-primary/10 text-primary border-primary/30',
  confirmed: 'bg-pipeline-green/15 text-pipeline-green border-pipeline-green/30',
};

interface PatientPanelProps {
  patient: Patient | null;
  open: boolean;
  onClose: () => void;
  onUpdateDecision: (patientId: string, status: DecisionStatus) => void;
}

export function PatientPanel({ patient, open, onClose, onUpdateDecision }: PatientPanelProps) {
  if (!patient) return null;

  const formatCurrency = (value: number | null) => {
    if (value === null) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-lg">{patient.name}</SheetTitle>
              <p className="text-sm text-muted-foreground mt-1">{patient.procedure}</p>
            </div>
            <Badge variant="outline" className={`shrink-0 ${decisionColors[patient.decisionStatus]}`}>
              {DECISION_LABELS[patient.decisionStatus]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Etapa: <span className="font-medium text-foreground">{STAGE_LABELS[patient.stage]}</span>
          </p>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* Decision Status */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status da Decisão</label>
            <Select
              value={patient.decisionStatus}
              onValueChange={(v) => onUpdateDecision(patient.id, v as DecisionStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DECISION_LABELS) as DecisionStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{DECISION_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <InfoItem icon={Stethoscope} label="Cirurgião" value={patient.surgeon} />
            <InfoItem icon={UserRound} label="Concierge" value={patient.concierge} />
            <InfoItem icon={DollarSign} label="Valor Estimado" value={formatCurrency(patient.estimatedValue)} />
            <InfoItem icon={Calendar} label="Última Interação" value={formatDate(patient.lastInteractionDate)} />
            <InfoItem icon={Clock} label="Próximo Follow-up" value={formatDate(patient.nextFollowUpDate)} />
          </div>

          {/* Next Action */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Próxima Ação</label>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <ArrowRight className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm text-foreground">{patient.nextAction}</span>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contato</label>
            <div className="text-sm text-foreground space-y-1">
              <p>{patient.phone}</p>
              <p className="text-muted-foreground">{patient.email}</p>
            </div>
          </div>

          {/* Follow-up History */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Histórico de Contatos ({patient.contacts.length})
            </label>
            <FollowUpTimeline contacts={patient.contacts} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
