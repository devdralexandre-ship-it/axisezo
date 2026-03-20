import { Patient, DECISION_LABELS, DecisionStatus, STAGE_LABELS, OWNERS, Owner, PatientTask, getTaskUrgency, LOSS_REASON_LABELS, PreOpChecklistItem } from '@/data/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FollowUpTimeline } from './FollowUpTimeline';
import { PreOpChecklist } from './PreOpChecklist';
import { Calendar, UserRound, Stethoscope, DollarSign, Clock, Plus, CheckCircle2, Circle, Building2, CreditCard, MapPin, Flag } from 'lucide-react';

const decisionColors: Record<string, string> = {
  waiting: 'bg-muted text-muted-foreground',
  thinking: 'bg-pipeline-amber/15 text-pipeline-amber border-pipeline-amber/30',
  negotiating: 'bg-primary/10 text-primary border-primary/30',
  confirmed: 'bg-pipeline-green/15 text-pipeline-green border-pipeline-green/30',
};

const urgencyColors: Record<string, string> = {
  green: 'text-pipeline-green',
  yellow: 'text-pipeline-amber',
  red: 'text-destructive',
};

interface PatientPanelProps {
  patient: Patient | null;
  open: boolean;
  onClose: () => void;
  onUpdateDecision: (patientId: string, status: DecisionStatus) => void;
  onUpdateOwner: (patientId: string, owner: Owner) => void;
  onCompleteTask: (patientId: string, taskId: string) => void;
  onAddTask: (patientId: string) => void;
  onTogglePreOpItem: (patientId: string, item: PreOpChecklistItem) => void;
}

export function PatientPanel({ patient, open, onClose, onUpdateDecision, onUpdateOwner, onCompleteTask, onAddTask, onTogglePreOpItem }: PatientPanelProps) {
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

  const pendingTasks = patient.tasks.filter((t) => !t.completed).sort((a, b) => new Date(`${a.dueDate}T${a.dueTime}`).getTime() - new Date(`${b.dueDate}T${b.dueTime}`).getTime());
  const completedTasks = patient.tasks.filter((t) => t.completed);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-lg">{patient.name}</SheetTitle>
              <p className="text-sm text-muted-foreground mt-1">{patient.procedure}</p>
              {patient.procedureCategory && (
                <p className="text-xs text-muted-foreground">{patient.procedureCategory}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge variant="outline" className={`${decisionColors[patient.decisionStatus]}`}>
                {DECISION_LABELS[patient.decisionStatus]}
              </Badge>
              {patient.specialFlag && (
                <Badge variant="outline" className="bg-pipeline-amber/10 text-pipeline-amber border-pipeline-amber/30 text-[10px]">
                  <Flag className="h-2.5 w-2.5 mr-1" />{patient.specialFlag}
                </Badge>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Etapa: <span className="font-medium text-foreground">{STAGE_LABELS[patient.stage]}</span>
          </p>
          {patient.stage === 'lost' && patient.lossReason && (
            <p className="text-xs text-destructive mt-1">
              Motivo: {LOSS_REASON_LABELS[patient.lossReason]}
              {patient.lossReasonDetail && ` — ${patient.lossReasonDetail}`}
            </p>
          )}
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* Owner */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Responsável</label>
            <Select value={patient.owner} onValueChange={(v) => onUpdateOwner(patient.id, v as Owner)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OWNERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Decision Status */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status da Decisão</label>
            <Select value={patient.decisionStatus} onValueChange={(v) => onUpdateDecision(patient.id, v as DecisionStatus)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
            {patient.payer && <InfoItem icon={CreditCard} label="Convênio/Pagador" value={patient.payer} />}
            {patient.desiredHospital && <InfoItem icon={Building2} label="Hospital" value={patient.desiredHospital} />}
            {patient.indicationLocation && <InfoItem icon={MapPin} label="Origem" value={patient.indicationLocation} />}
          </div>

          {/* Notes */}
          {patient.notes && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações</label>
              <p className="text-sm text-foreground bg-muted/50 p-3 rounded-lg">{patient.notes}</p>
            </div>
          )}

          {/* Pre-op Checklist — only for preop_preparation stage */}
          {patient.stage === 'preop_preparation' && (
            <PreOpChecklist
              checklist={patient.preOpChecklist}
              onToggle={(item) => onTogglePreOpItem(patient.id, item)}
            />
          )}

          {/* Tasks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Tarefas ({pendingTasks.length} pendente{pendingTasks.length !== 1 ? 's' : ''})
              </label>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onAddTask(patient.id)}>
                <Plus className="h-3 w-3 mr-1" /> Nova
              </Button>
            </div>
            <div className="space-y-1.5">
              {pendingTasks.map((task) => {
                const urgency = getTaskUrgency(task);
                return (
                  <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 group">
                    <button onClick={() => onCompleteTask(patient.id, task.id)} className="shrink-0 hover:scale-110 transition-transform">
                      <Circle className={`h-4 w-4 ${urgencyColors[urgency]}`} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">{task.title}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(task.dueDate)} {task.dueTime} • {task.responsible}</p>
                    </div>
                  </div>
                );
              })}
              {completedTasks.length > 0 && (
                <div className="pt-2 space-y-1.5">
                  <p className="text-[11px] text-muted-foreground">Concluídas ({completedTasks.length})</p>
                  {completedTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg opacity-50">
                      <CheckCircle2 className="h-4 w-4 text-pipeline-green shrink-0" />
                      <p className="text-sm text-foreground line-through truncate">{task.title}</p>
                    </div>
                  ))}
                </div>
              )}
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
