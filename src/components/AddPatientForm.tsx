import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Patient, PIPELINE_STAGES, STAGE_LABELS, OWNERS, Owner } from '@/data/types';
import { PROCEDURES, SURGEONS, CONCIERGES, PAYERS, BILLING_TYPES, PATIENT_TYPE_LABELS, SURGICAL_APPROACHES, procedureNeedsApproach, LATERALITY_OPTIONS, procedureNeedsLaterality } from '@/data/constants';
import { Plus, X } from 'lucide-react';

interface InitialTask {
  id: string;
  title: string;
  dueDate: string;
  dueTime: string;
  responsible: string;
}

interface AddPatientFormProps {
  open: boolean;
  onClose: () => void;
  onAdd: (patient: Partial<Patient> & { name: string; procedure: string; surgeon: string; initialTasks?: { title: string; dueDate: string; dueTime: string; responsible: string }[] }) => void;
}

const OTHER_PROCEDURE = '__outro__';

export function AddPatientForm({ open, onClose, onAdd }: AddPatientFormProps) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [patientType, setPatientType] = useState('adult');
  const [procedure, setProcedure] = useState('');
  const [customProcedure, setCustomProcedure] = useState('');
  const [surgicalApproach, setSurgicalApproach] = useState('');
  const [laterality, setLaterality] = useState('');
  const [surgeon, setSurgeon] = useState('');
  const [concierge, setConcierge] = useState('');
  const [stage, setStage] = useState(PIPELINE_STAGES[0]);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [responsibleContact, setResponsibleContact] = useState('');
  const [payer, setPayer] = useState('');
  const [payerOther, setPayerOther] = useState('');
  const [billingType, setBillingType] = useState('');
  const [medicalFees, setMedicalFees] = useState('');
  const [anesthesiaFees, setAnesthesiaFees] = useState('');
  const [hospitalBudget, setHospitalBudget] = useState('');
  const [materialsCost, setMaterialsCost] = useState('');
  const [desiredHospital, setDesiredHospital] = useState('');
  const [indicationLocation, setIndicationLocation] = useState('');
  const [alerts, setAlerts] = useState('');

  // Inline task creation
  const [initialTasks, setInitialTasks] = useState<InitialTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTaskTime, setNewTaskTime] = useState('10:00');
  const [newTaskResponsible, setNewTaskResponsible] = useState('');

  const isCustomProcedure = procedure === OTHER_PROCEDURE;
  const effectiveProcedure = isCustomProcedure ? customProcedure : procedure;
  const showApproach = procedureNeedsApproach(effectiveProcedure);
  const showLaterality = procedureNeedsLaterality(effectiveProcedure);
  const showPayerOther = payer === 'Outros';

  const showMedicalFees = billingType === 'Particular' || billingType === '100% Particular';
  const showFullFinancial = billingType === '100% Particular';

  const estimatedTotal = showFullFinancial
    ? (parseFloat(medicalFees) || 0) + (parseFloat(anesthesiaFees) || 0) + (parseFloat(hospitalBudget) || 0) + (parseFloat(materialsCost) || 0)
    : 0;

  const hasValidTask = initialTasks.length > 0 && initialTasks.every(t => t.title.trim() && t.dueDate);

  const addInitialTask = () => {
    if (!newTaskTitle.trim() || !newTaskDate) return;
    setInitialTasks([...initialTasks, {
      id: crypto.randomUUID(),
      title: newTaskTitle.trim(),
      dueDate: newTaskDate,
      dueTime: newTaskTime || '10:00',
      responsible: newTaskResponsible || concierge || 'Margô',
    }]);
    setNewTaskTitle('');
    setNewTaskDate(new Date().toISOString().split('T')[0]);
    setNewTaskTime('10:00');
    setNewTaskResponsible('');
  };

  const removeInitialTask = (id: string) => {
    setInitialTasks(initialTasks.filter((i) => i.id !== id));
  };

  const resetForm = () => {
    setName(''); setAge(''); setPatientType('adult'); setProcedure(''); setCustomProcedure('');
    setSurgicalApproach(''); setLaterality(''); setSurgeon(''); setConcierge(''); setStage(PIPELINE_STAGES[0]);
    setPhone(''); setEmail(''); setResponsibleContact(''); setPayer(''); setPayerOther('');
    setBillingType(''); setMedicalFees(''); setAnesthesiaFees(''); setHospitalBudget('');
    setMaterialsCost(''); setDesiredHospital(''); setIndicationLocation('');
    setAlerts(''); setInitialTasks([]); setNewTaskTitle('');
    setNewTaskDate(new Date().toISOString().split('T')[0]); setNewTaskTime('10:00');
    setNewTaskResponsible('');
  };

  const handleSubmit = () => {
    if (!name || !effectiveProcedure || !surgeon || !hasValidTask) return;
    const today = new Date().toISOString().split('T')[0];
    const finalPayer = payer === 'Outros' ? payerOther : payer;

    const computedEstimatedValue = showFullFinancial && estimatedTotal > 0 ? estimatedTotal
      : showMedicalFees && medicalFees ? parseFloat(medicalFees)
      : null;

    onAdd({
      name,
      age: age ? parseInt(age) : null,
      patientType,
      procedure: effectiveProcedure,
      procedureCategory: '',
      surgicalApproach: showApproach ? surgicalApproach || null : null,
      laterality: showLaterality ? laterality || null : null,
      surgeon,
      concierge,
      owner: surgeon as any,
      stage,
      stageEnteredAt: today,
      decisionStatus: 'waiting',
      estimatedValue: computedEstimatedValue,
      lastInteractionDate: today,
      nextFollowUpDate: null,
      phone,
      email,
      initialTasks: initialTasks.map(t => ({ title: t.title, dueDate: t.dueDate, dueTime: t.dueTime, responsible: t.responsible })),
      createdAt: today,
      indicationDate: today,
      indicationLocation: indicationLocation || null,
      payer: finalPayer || null,
      billingType: billingType || null,
      medicalFees: showMedicalFees && medicalFees ? parseFloat(medicalFees) : null,
      anesthesiaFees: showFullFinancial && anesthesiaFees ? parseFloat(anesthesiaFees) : null,
      hospitalBudget: showFullFinancial && hospitalBudget ? parseFloat(hospitalBudget) : null,
      materialsCost: showFullFinancial && materialsCost ? parseFloat(materialsCost) : null,
      responsibleContact: responsibleContact || null,
      desiredHospital: desiredHospital || null,
      notes: null,
      alerts: alerts || null,
      lossReason: null,
      lossReasonDetail: null,
    });
    resetForm();
    onClose();
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle>Novo Paciente</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-4 pb-4">
            {/* Name & Age */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label>Nome *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" className="focus-visible:ring-offset-0" />
              </div>
              <div className="space-y-2">
                <Label>Idade</Label>
                <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="0" className="focus-visible:ring-offset-0" />
              </div>
            </div>

            {/* Patient Type */}
            <div className="space-y-2">
              <Label>Tipo de Paciente</Label>
              <Select value={patientType} onValueChange={setPatientType}>
                <SelectTrigger className="focus:ring-offset-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="adult">{PATIENT_TYPE_LABELS.adult}</SelectItem>
                  <SelectItem value="pediatric">{PATIENT_TYPE_LABELS.pediatric}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Procedure */}
            <div className="space-y-2">
              <Label>Procedimento *</Label>
              <Select value={procedure} onValueChange={(v) => { setProcedure(v); if (v !== OTHER_PROCEDURE && !procedureNeedsApproach(v)) setSurgicalApproach(''); }}>
                <SelectTrigger className="focus:ring-offset-0"><SelectValue placeholder="Selecione o procedimento" /></SelectTrigger>
                <SelectContent>
                  {PROCEDURES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  <SelectItem value={OTHER_PROCEDURE}>Outro...</SelectItem>
                </SelectContent>
              </Select>
              {isCustomProcedure && (
                <Input value={customProcedure} onChange={(e) => setCustomProcedure(e.target.value)} placeholder="Informe o procedimento" className="mt-2 focus-visible:ring-offset-0" />
              )}
            </div>

            {/* Surgical Approach */}
            {showApproach && (
              <div className="space-y-2">
                <Label>Via / Plataforma Cirúrgica</Label>
                <Select value={surgicalApproach} onValueChange={setSurgicalApproach}>
                  <SelectTrigger className="focus:ring-offset-0"><SelectValue placeholder="Selecione a via" /></SelectTrigger>
                  <SelectContent>
                    {SURGICAL_APPROACHES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Laterality */}
            {showLaterality && (
              <div className="space-y-2">
                <Label>Lateralidade</Label>
                <Select value={laterality} onValueChange={setLaterality}>
                  <SelectTrigger className="focus:ring-offset-0"><SelectValue placeholder="Selecione a lateralidade" /></SelectTrigger>
                  <SelectContent>
                    {LATERALITY_OPTIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Surgeon & Concierge */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cirurgião *</Label>
                <Select value={surgeon} onValueChange={setSurgeon}>
                  <SelectTrigger className="focus:ring-offset-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {SURGEONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Concierge</Label>
                <Select value={concierge} onValueChange={setConcierge}>
                  <SelectTrigger className="focus:ring-offset-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {CONCIERGES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Phone & Email */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-0000" className="focus-visible:ring-offset-0" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@email.com" className="focus-visible:ring-offset-0" />
              </div>
            </div>

            {/* Responsible Contact */}
            <div className="space-y-2">
              <Label>Responsável pelo Paciente</Label>
              <Input value={responsibleContact} onChange={(e) => setResponsibleContact(e.target.value)} placeholder="Nome/contato do responsável ou cuidador" className="focus-visible:ring-offset-0" />
            </div>

            {/* Payer */}
            <div className="space-y-2">
              <Label>Convênio</Label>
              <Select value={payer} onValueChange={setPayer}>
                <SelectTrigger className="focus:ring-offset-0"><SelectValue placeholder="Selecione o convênio" /></SelectTrigger>
                <SelectContent>
                  {PAYERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              {showPayerOther && (
                <Input value={payerOther} onChange={(e) => setPayerOther(e.target.value)} placeholder="Informe o convênio" className="mt-2 focus-visible:ring-offset-0" />
              )}
            </div>

            {/* Billing Type */}
            <div className="space-y-2">
              <Label>Tipo de Faturamento dos Honorários</Label>
              <Select value={billingType} onValueChange={(v) => { setBillingType(v); if (v !== 'Particular' && v !== '100% Particular') { setMedicalFees(''); setAnesthesiaFees(''); setHospitalBudget(''); setMaterialsCost(''); } }}>
                <SelectTrigger className="focus:ring-offset-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {BILLING_TYPES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Conditional Financial Fields */}
            {showMedicalFees && (
              <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border">
                <div className="space-y-1">
                  <Label className="text-xs">Honorários Médicos (R$)</Label>
                  <Input type="number" value={medicalFees} onChange={(e) => setMedicalFees(e.target.value)} placeholder="0" className="focus-visible:ring-offset-0" />
                </div>
                {showFullFinancial && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Honorários Anestesia (R$)</Label>
                      <Input type="number" value={anesthesiaFees} onChange={(e) => setAnesthesiaFees(e.target.value)} placeholder="0" className="focus-visible:ring-offset-0" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Orçamento Hospitalar (R$)</Label>
                      <Input type="number" value={hospitalBudget} onChange={(e) => setHospitalBudget(e.target.value)} placeholder="0" className="focus-visible:ring-offset-0" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Materiais Especiais (R$)</Label>
                      <Input type="number" value={materialsCost} onChange={(e) => setMaterialsCost(e.target.value)} placeholder="0" className="focus-visible:ring-offset-0" />
                    </div>
                    {estimatedTotal > 0 && (
                      <div className="pt-2 border-t border-border flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Total Estimado</span>
                        <span className="text-sm font-bold text-foreground">{formatCurrency(estimatedTotal)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Desired Hospital */}
            <div className="space-y-2">
              <Label>Hospital Desejado</Label>
              <Input value={desiredHospital} onChange={(e) => setDesiredHospital(e.target.value)} placeholder="Hospital" className="focus-visible:ring-offset-0" />
            </div>

            {/* Indication Source */}
            <div className="space-y-2">
              <Label>Origem / Indicação</Label>
              <Input value={indicationLocation} onChange={(e) => setIndicationLocation(e.target.value)} placeholder="Origem da indicação" className="focus-visible:ring-offset-0" />
            </div>

            {/* Alerts */}
            <div className="space-y-2">
              <Label>Alertas</Label>
              <Textarea value={alerts} onChange={(e) => setAlerts(e.target.value)} placeholder="Alergias, comorbidades, observações importantes..." rows={2} className="focus-visible:ring-offset-0" />
            </div>

            {/* Stage */}
            <div className="space-y-2">
              <Label>Etapa Inicial</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as typeof stage)}>
                <SelectTrigger className="focus:ring-offset-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Inline Actions */}
            <div className="space-y-2">
              <Label>Ações Iniciais *</Label>
              <p className="text-[11px] text-muted-foreground">Mínimo 1 ação obrigatória</p>
              <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Título da ação *"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInitialTask())} className="focus-visible:ring-offset-0 text-sm" />
                  </div>
                  <Input type="date" value={newTaskDate} onChange={(e) => setNewTaskDate(e.target.value)} className="focus-visible:ring-offset-0 text-sm" />
                  <Input type="time" value={newTaskTime} onChange={(e) => setNewTaskTime(e.target.value)} className="focus-visible:ring-offset-0 text-sm" />
                </div>
                <div className="flex gap-2">
                  <Select value={newTaskResponsible} onValueChange={setNewTaskResponsible}>
                    <SelectTrigger className="focus:ring-offset-0 text-sm flex-1"><SelectValue placeholder={concierge || 'Responsável'} /></SelectTrigger>
                    <SelectContent>
                      {OWNERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={addInitialTask} className="shrink-0" disabled={!newTaskTitle.trim() || !newTaskDate}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {initialTasks.length > 0 && (
                <div className="space-y-1 mt-2">
                  {initialTasks.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{item.title}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(item.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')} {item.dueTime} • {item.responsible}
                        </span>
                      </div>
                      <button onClick={() => removeInitialTask(item.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!name || !effectiveProcedure || !surgeon || !hasValidTask}>Criar paciente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
