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
import { Calendar, UserRound, Stethoscope, DollarSign, Clock, Plus, CheckCircle2, Circle, Building2, CreditCard, MapPin, Pencil, Save, X, AlertTriangle, Baby, User, Phone, Mail, FileText, Contact } from 'lucide-react';

const OTHER_PROCEDURE = '__outro__';

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

function getFinancialVisibility(billingType: string | null) {
  const showMedicalFees = billingType === 'Particular' || billingType === '100% Particular';
  const showFullFinancial = billingType === '100% Particular';
  return { showMedicalFees, showFullFinancial };
}

function computeEstimatedTotal(medicalFees: number | null, anesthesiaFees: number | null, hospitalBudget: number | null, materialsCost: number | null) {
  return (medicalFees || 0) + (anesthesiaFees || 0) + (hospitalBudget || 0) + (materialsCost || 0);
}

export function PatientPanel({ patient, open, onClose, onUpdateDecision, onUpdateOwner, onCompleteTask, onAddTask, onTogglePreOpItem, onUpdateFields }: PatientPanelProps) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});

  if (!patient) return null;

  const isCustomProcedure = editing && !PROCEDURES.includes(editData.procedure_name as any);
  const editProcedureSelectValue = editing
    ? (PROCEDURES.includes(editData.procedure_name as any) ? editData.procedure_name : OTHER_PROCEDURE)
    : '';

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
      responsible_contact: patient.responsibleContact || '',
      payer: patient.payer || '',
      billing_type: patient.billingType || '',
      medical_fees: patient.medicalFees,
      anesthesia_fees: patient.anesthesiaFees,
      hospital_budget: patient.hospitalBudget,
      materials_cost: patient.materialsCost,
      desired_hospital: patient.desiredHospital || '',
      indication_location: patient.indicationLocation || '',
      notes: patient.notes || '',
      alerts: patient.alerts || '',
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
    if (value === null || value === undefined) return '—';
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

  const viewFinancial = getFinancialVisibility(patient.billingType);
  const editFinancial = getFinancialVisibility(editing ? editData.billing_type : null);

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
                <Select
                  value={editProcedureSelectValue}
                  onValueChange={(v) => {
                    if (v === OTHER_PROCEDURE) {
                      setEditData({ ...editData, procedure_name: '', surgical_approach: null });
                    } else {
                      setEditData({ ...editData, procedure_name: v, surgical_approach: procedureNeedsApproach(v) ? editData.surgical_approach : null });
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROCEDURES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    <SelectItem value={OTHER_PROCEDURE}>Outro...</SelectItem>
                  </SelectContent>
                </Select>
                {isCustomProcedure && (
                  <Input value={editData.procedure_name} onChange={(e) => setEditData({ ...editData, procedure_name: e.target.value })} placeholder="Informe o procedimento" className="mt-2 h-8 text-sm" />
                )}
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
              <EditField label="Responsável pelo Paciente" value={editData.responsible_contact} onChange={(v) => setEditData({ ...editData, responsible_contact: v })} />
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
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Faturamento</label>
                <Select value={editData.billing_type || 'none'} onValueChange={(v) => {
                  const newBt = v === 'none' ? '' : v;
                  const updates: Record<string, any> = { billing_type: newBt };
                  if (newBt !== 'Particular' && newBt !== '100% Particular') {
                    updates.medical_fees = null;
                    updates.anesthesia_fees = null;
                    updates.hospital_budget = null;
                    updates.materials_cost = null;
                  }
                  if (newBt === 'Particular') {
                    updates.anesthesia_fees = null;
                    updates.hospital_budget = null;
                    updates.materials_cost = null;
                  }
                  setEditData({ ...editData, ...updates });
                }}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {BILLING_TYPES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {editFinancial.showMedicalFees && (
                <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <EditField label="Honorários Médicos (R$)" type="number" value={editData.medical_fees || ''} onChange={(v) => setEditData({ ...editData, medical_fees: v ? parseFloat(v) : null })} />
                  {editFinancial.showFullFinancial && (
                    <>
                      <EditField label="Honorários Anestesia (R$)" type="number" value={editData.anesthesia_fees || ''} onChange={(v) => setEditData({ ...editData, anesthesia_fees: v ? parseFloat(v) : null })} />
                      <EditField label="Orçamento Hospitalar (R$)" type="number" value={editData.hospital_budget || ''} onChange={(v) => setEditData({ ...editData, hospital_budget: v ? parseFloat(v) : null })} />
                      <EditField label="Materiais Especiais (R$)" type="number" value={editData.materials_cost || ''} onChange={(v) => setEditData({ ...editData, materials_cost: v ? parseFloat(v) : null })} />
                      {computeEstimatedTotal(editData.medical_fees, editData.anesthesia_fees, editData.hospital_budget, editData.materials_cost) > 0 && (
                        <div className="pt-2 border-t border-border flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground">Total Estimado</span>
                          <span className="text-sm font-bold text-foreground">{formatCurrency(computeEstimatedTotal(editData.medical_fees, editData.anesthesia_fees, editData.hospital_budget, editData.materials_cost))}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              <EditField label="Hospital" value={editData.desired_hospital} onChange={(v) => setEditData({ ...editData, desired_hospital: v })} />
              <EditField label="Origem / Indicação" value={editData.indication_location} onChange={(v) => setEditData({ ...editData, indication_location: v })} />
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
                <InfoItem icon={Phone} label="Telefone" value={patient.phone || '—'} />
                <InfoItem icon={Mail} label="Email" value={patient.email || '—'} />
                <InfoItem icon={Contact} label="Responsável pelo Paciente" value={patient.responsibleContact || '—'} />
                <InfoItem icon={CreditCard} label="Convênio" value={patient.payer || '—'} />
                <InfoItem icon={CreditCard} label="Faturamento" value={patient.billingType || '—'} />
                <InfoItem icon={Building2} label="Hospital" value={patient.desiredHospital || '—'} />
                <InfoItem icon={MapPin} label="Origem" value={patient.indicationLocation || '—'} />
                <InfoItem icon={Calendar} label="Última Interação" value={formatDate(patient.lastInteractionDate)} />
                <InfoItem icon={Clock} label="Próximo Follow-up" value={formatDate(patient.nextFollowUpDate)} />
              </div>

              {/* Conditional Financial Display */}
              {viewFinancial.showMedicalFees && (
                <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Financeiro</label>
                  <div className="grid grid-cols-2 gap-3">
                    <InfoItem icon={DollarSign} label="Honorários Médicos" value={formatCurrency(patient.medicalFees)} />
                    {viewFinancial.showFullFinancial && (
                      <>
                        <InfoItem icon={DollarSign} label="Honorários Anestesia" value={formatCurrency(patient.anesthesiaFees)} />
                        <InfoItem icon={DollarSign} label="Orçamento Hospitalar" value={formatCurrency(patient.hospitalBudget)} />
                        <InfoItem icon={DollarSign} label="Materiais Especiais" value={formatCurrency(patient.materialsCost)} />
                      </>
                    )}
                  </div>
                  {viewFinancial.showFullFinancial && (
                    <div className="pt-2 border-t border-border flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Total Estimado</span>
                      <span className="text-sm font-bold text-foreground">{formatCurrency(computeEstimatedTotal(patient.medicalFees, patient.anesthesiaFees, patient.hospitalBudget, patient.materialsCost))}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações</label>
                <p className="text-sm text-foreground bg-muted/50 p-3 rounded-lg">{patient.notes || '—'}</p>
              </div>
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
                <Plus className="h-3 w-3 mr-1" /> Nova ação
              </Button>
            </div>
            <div className="space-y-1.5">
              {pendingTasks.length === 0 && completedTasks.length === 0 && (
                <p className="text-sm text-muted-foreground py-3 text-center">
                  Nenhuma ação definida. Defina o próximo passo para avançar este paciente.
                </p>
              )}
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
