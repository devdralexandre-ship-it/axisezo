import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Patient, PIPELINE_STAGES, STAGE_LABELS } from '@/data/types';
import { PROCEDURES, SURGEONS, CONCIERGES, PAYERS, BILLING_TYPES, PATIENT_TYPE_LABELS, SURGICAL_APPROACHES, procedureNeedsApproach } from '@/data/constants';
import { Plus, X } from 'lucide-react';

interface AddPatientFormProps {
  open: boolean;
  onClose: () => void;
  onAdd: (patient: Partial<Patient> & { name: string; procedure: string; surgeon: string; initialTaskTitles?: string[] }) => void;
}

export function AddPatientForm({ open, onClose, onAdd }: AddPatientFormProps) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [patientType, setPatientType] = useState('adult');
  const [procedure, setProcedure] = useState('');
  const [surgicalApproach, setSurgicalApproach] = useState('');
  const [surgeon, setSurgeon] = useState('');
  const [concierge, setConcierge] = useState('');
  const [stage, setStage] = useState(PIPELINE_STAGES[0]);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [payer, setPayer] = useState('');
  const [payerOther, setPayerOther] = useState('');
  const [billingType, setBillingType] = useState('');
  const [medicalFees, setMedicalFees] = useState('');
  const [alerts, setAlerts] = useState('');
  const [initialTasks, setInitialTasks] = useState<{ id: string; title: string }[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const showApproach = procedureNeedsApproach(procedure);
  const showPayerOther = payer === 'Outros';
  const showMedicalFees = billingType === 'Particular';

  const addInitialTask = () => {
    if (!newTaskTitle.trim()) return;
    setInitialTasks([...initialTasks, { id: crypto.randomUUID(), title: newTaskTitle.trim() }]);
    setNewTaskTitle('');
  };

  const removeInitialTask = (id: string) => {
    setInitialTasks(initialTasks.filter((i) => i.id !== id));
  };

  const resetForm = () => {
    setName(''); setAge(''); setPatientType('adult'); setProcedure(''); setSurgicalApproach('');
    setSurgeon(''); setConcierge(''); setStage(PIPELINE_STAGES[0]);
    setPhone(''); setEmail(''); setPayer(''); setPayerOther(''); setBillingType('');
    setMedicalFees(''); setAlerts(''); setInitialTasks([]); setNewTaskTitle('');
  };

  const handleSubmit = () => {
    if (!name || !procedure || !surgeon) return;
    const today = new Date().toISOString().split('T')[0];
    const finalPayer = payer === 'Outros' ? payerOther : payer;

    onAdd({
      name,
      age: age ? parseInt(age) : null,
      patientType,
      procedure,
      procedureCategory: '',
      surgicalApproach: showApproach ? surgicalApproach || null : null,
      surgeon,
      concierge,
      owner: surgeon as any,
      stage,
      stageEnteredAt: today,
      decisionStatus: 'waiting',
      estimatedValue: null,
      lastInteractionDate: today,
      nextFollowUpDate: null,
      phone,
      email,
      initialTaskTitles: initialTasks.map(t => t.title),
      createdAt: today,
      indicationDate: today,
      indicationLocation: null,
      payer: finalPayer || null,
      billingType: billingType || null,
      medicalFees: showMedicalFees && medicalFees ? parseFloat(medicalFees) : null,
      contactReference: null,
      desiredHospital: null,
      notes: null,
      alerts: alerts || null,
      lossReason: null,
      lossReasonDetail: null,
      specialFlag: null,
    });
    resetForm();
    onClose();
  };

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
              <Select value={procedure} onValueChange={(v) => { setProcedure(v); if (!procedureNeedsApproach(v)) setSurgicalApproach(''); }}>
                <SelectTrigger className="focus:ring-offset-0"><SelectValue placeholder="Selecione o procedimento" /></SelectTrigger>
                <SelectContent>
                  {PROCEDURES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
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
              <Label>Tipo de Faturamento</Label>
              <Select value={billingType} onValueChange={setBillingType}>
                <SelectTrigger className="focus:ring-offset-0"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {BILLING_TYPES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              {showMedicalFees && (
                <div className="mt-2 space-y-1">
                  <Label className="text-xs">Honorários médicos (R$)</Label>
                  <Input type="number" value={medicalFees} onChange={(e) => setMedicalFees(e.target.value)} placeholder="0" className="focus-visible:ring-offset-0" />
                </div>
              )}
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

            {/* Contact */}
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

            {/* Alerts */}
            <div className="space-y-2">
              <Label>Alertas</Label>
              <Textarea value={alerts} onChange={(e) => setAlerts(e.target.value)} placeholder="Alergias, comorbidades, observações importantes..." rows={2} className="focus-visible:ring-offset-0" />
            </div>

            {/* Initial Tasks */}
            <div className="space-y-2">
              <Label>Ações Iniciais</Label>
              <div className="flex gap-2">
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Adicionar ação..."
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInitialTask())}
                  className="focus-visible:ring-offset-0"
                />
                <Button type="button" variant="outline" size="icon" onClick={addInitialTask} className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {initialTasks.length > 0 && (
                <div className="space-y-1 mt-2">
                  {initialTasks.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <span className="text-sm flex-1">{item.title}</span>
                      <button onClick={() => removeInitialTask(item.id)} className="text-muted-foreground hover:text-destructive">
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
          <Button onClick={handleSubmit} disabled={!name || !procedure || !surgeon}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
