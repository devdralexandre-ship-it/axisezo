import { useState } from 'react';
import { Patient, DECISION_LABELS, DecisionStatus, STAGE_LABELS, OWNERS, Owner, PatientTask, getTaskUrgency, LOSS_REASON_LABELS, PreOpChecklistItem } from '@/data/types';
import { PROCEDURES, SURGEONS, CONCIERGES, PAYERS, BILLING_TYPES, SURGICAL_APPROACHES, PATIENT_TYPE_LABELS, procedureNeedsApproach } from '@/data/constants';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FollowUpTimeline } from './FollowUpTimeline';
import { PreOpChecklist } from './PreOpChecklist';
import { Calendar, UserRound, Stethoscope, DollarSign, Clock, Plus, CheckCircle2, Circle, Building2, CreditCard, MapPin, Flag, Pencil, Save, X, AlertTriangle, Baby, User } from 'lucide-react';

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
  onUpdateFields: (patientId: string, fields: Record<string, any>) => void;
}

export function PatientPanel({ patient, open, onClose, onUpdateDecision, onUpdateOwner, onCompleteTask, onAddTask, onTogglePreOpItem, onUpdateFields }: PatientPanelProps) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});

  if (!patient) return null;

  const startEditing = () => {
    setEditData({
      name: patient.name,
      age: patient.age,
      patient_type: patient.patientType,
      procedure_name: patient.procedure,
      surgical_approach: patient.surgicalApproach,
      surgeon: patient.surgeon,
      concierge: patient.concierge,
      phone: patient.phone,
      email: patient.email,
      payer: patient.payer || '',
      billing_type: patient.billingType || '',
      medical_fees: patient.medicalFees,
      estimated_value: patient.estimatedValue,
      desired_hospital: patient.desiredHospital || '',
      indication_location: patient.indicationLocation || '',
      contact_reference: patient.contactReference || '',
      notes: patient.notes || '',
      alerts: patient.alerts || '',
      special_flag: patient.specialFlag || '',
    });
    setEditing(true);
  };

  const saveEditing = () => {
    const fields: Record<string, any> = {};
    for (const [key, val] of Object.entries(editData)) {
      fields[key] = val === '' ? null : val;
    }
    onUpdateFields(patient.id, fields);
    setEditing(false);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditData({});
  };

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
  const showApproach = procedureNeedsApproach(editing ? editData.procedure_name : patient.procedure);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[500px] overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-lg">{patient.name}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground">{patient.procedure}</p>
                {patient.surgicalApproach && (
                  <Badge variant="outline" className="text-[10px]">{patient.surgicalApproach}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {patient.age && <span className="text-xs text-muted-foreground">{patient.age} anos</span>}
                <Badge variant="outline" className="text-[10px]">
                  {patient.patientType === 'pediatric' ? <><Baby className="h-2.5 w-2.5 mr-1" />Pediátrico</> : <><User className="h-2.5 w-2.5 mr-1" />Adulto</>}
                </Badge>
              </div>
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
          {/* Alerts */}
          {patient.alerts && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive mb-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Alertas
              </div>
              <p className="text-sm text-destructive">{patient.alerts}</p>
            </div>
          )}

          {/* Edit toggle */}
          <div className="flex justify-end">
            {editing ? (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEditing}>
                  <X className="h-3 w-3 mr-1" />Cancelar
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={saveEditing}>
                  <Save className="h-3 w-3 mr-1" />Salvar
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={startEditing}>
                <Pencil className="h-3 w-3 mr-1" />Editar
              </Button>
            )}
          </div>

          {editing ? (
            <div className="space-y-4">
              <EditField label="Nome" value={editData.name} onChange={(v) => setEditData({ ...editData, name: v })} />
              <div className="grid grid-cols-2 gap-3">
                <EditField label="Idade" type="number" value={editData.age || ''} onChange={(v) => setEditData({ ...editData, age: v ? parseInt(v) : null })} />
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Tipo</label>
                  <Select value={editData.patient_type} onValueChange={(v) => setEditData({ ...editData, patient_type: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adult">{PATIENT_TYPE_LABELS.adult}</SelectItem>
                      <SelectItem value="pediatric">{PATIENT_TYPE_LABELS.pediatric}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Procedimento</label>
                <Select value={editData.procedure_name} onValueChange={(v) => setEditData({ ...editData, procedure_name: v, surgical_approach: procedureNeedsApproach(v) ? editData.surgical_approach : null })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROCEDURES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {showApproach && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Via Cirúrgica</label>
                  <Select value={editData.surgical_approach || ''} onValueChange={(v) => setEditData({ ...editData, surgical_approach: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {SURGICAL_APPROACHES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Cirurgião</label>
                  <Select value={editData.surgeon} onValueChange={(v) => setEditData({ ...editData, surgeon: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SURGEONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Concierge</label>
                  <Select value={editData.concierge} onValueChange={(v) => setEditData({ ...editData, concierge: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONCIERGES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <EditField label="Telefone" value={editData.phone} onChange={(v) => setEditData({ ...editData, phone: v })} />
                <EditField label="Email" value={editData.email} onChange={(v) => setEditData({ ...editData, email: v })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Convênio</label>
                <Select value={editData.payer || 'none'} onValueChange={(v) => setEditData({ ...editData, payer: v === 'none' ? '' : v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {PAYERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Faturamento</label>
                  <Select value={editData.billing_type || 'none'} onValueChange={(v) => setEditData({ ...editData, billing_type: v === 'none' ? '' : v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {BILLING_TYPES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <EditField label="Honorários (R$)" type="number" value={editData.medical_fees || ''} onChange={(v) => setEditData({ ...editData, medical_fees: v ? parseFloat(v) : null })} />
              </div>
              <EditField label="Valor Estimado (R$)" type="number" value={editData.estimated_value || ''} onChange={(v) => setEditData({ ...editData, estimated_value: v ? parseFloat(v) : null })} />
              <EditField label="Hospital" value={editData.desired_hospital} onChange={(v) => setEditData({ ...editData, desired_hospital: v })} />
              <EditField label="Origem / Indicação" value={editData.indication_location} onChange={(v) => setEditData({ ...editData, indication_location: v })} />
              <EditField label="Referência de Contato" value={editData.contact_reference} onChange={(v) => setEditData({ ...editData, contact_reference: v })} />
              <EditField label="Flag Especial" value={editData.special_flag} onChange={(v) => setEditData({ ...editData, special_flag: v })} />
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Alertas</label>
                <Textarea value={editData.alerts} onChange={(e) => setEditData({ ...editData, alerts: e.target.value })} rows={2} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Observações</label>
                <Textarea value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} rows={3} />
              </div>
            </div>
          ) : (
            <>
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
                <InfoItem icon={UserRound} label="Concierge" value={patient.concierge || '—'} />
                <InfoItem icon={DollarSign} label="Valor Estimado" value={formatCurrency(patient.estimatedValue)} />
                <InfoItem icon={Calendar} label="Última Interação" value={formatDate(patient.lastInteractionDate)} />
                <InfoItem icon={Clock} label="Próximo Follow-up" value={formatDate(patient.nextFollowUpDate)} />
                {patient.payer && <InfoItem icon={CreditCard} label="Convênio" value={patient.payer} />}
                {patient.billingType && <InfoItem icon={CreditCard} label="Faturamento" value={patient.billingType} />}
                {patient.medicalFees && <InfoItem icon={DollarSign} label="Honorários" value={formatCurrency(patient.medicalFees)} />}
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
            </>
          )}

          {/* Pre-op Checklist */}
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
                Ações ({pendingTasks.length} pendente{pendingTasks.length !== 1 ? 's' : ''})
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
              <p>{patient.phone || '—'}</p>
              <p className="text-muted-foreground">{patient.email || '—'}</p>
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

function EditField({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <Input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
    </div>
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
