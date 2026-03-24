import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Patient, PIPELINE_STAGES, STAGE_LABELS, OWNERS, Owner } from '@/data/types';

interface AddPatientFormProps {
  open: boolean;
  onClose: () => void;
  onAdd: (patient: Patient) => void;
  surgeons: string[];
  concierges: string[];
}

export function AddPatientForm({ open, onClose, onAdd, surgeons, concierges }: AddPatientFormProps) {
  const [name, setName] = useState('');
  const [procedure, setProcedure] = useState('');
  const [surgeon, setSurgeon] = useState('');
  const [concierge, setConcierge] = useState('');
  const [owner, setOwner] = useState<Owner>(OWNERS[0]);
  const [stage, setStage] = useState(PIPELINE_STAGES[0]);
  const [value, setValue] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = () => {
    if (!name || !procedure || !surgeon) return;
    const today = new Date().toISOString().split('T')[0];
    const patient: Patient = {
      id: crypto.randomUUID(),
      name,
      procedure,
      procedureCategory: '',
      surgeon,
      concierge,
      owner,
      stage,
      stageEnteredAt: today,
      decisionStatus: 'waiting',
      estimatedValue: value ? parseFloat(value) : null,
      lastInteractionDate: today,
      nextFollowUpDate: null,
      phone,
      email,
      contacts: [
        { id: crypto.randomUUID(), date: today, type: 'phone', note: 'Cadastro inicial no sistema.', by: concierge },
      ],
      tasks: [],
      createdAt: today,
      indicationDate: today,
      indicationLocation: null,
      payer: null,
      contactReference: null,
      desiredHospital: null,
      notes: null,
      lossReason: null,
      lossReasonDetail: null,
      specialFlag: null,
      preOpChecklist: { preop_labs: false, cardiology_clearance: false, preanesthesia: false, surgical_request: false, authorization: false, surgery_scheduling: false },
    };
    onAdd(patient);
    setName(''); setProcedure(''); setSurgeon(''); setConcierge(''); setValue(''); setPhone(''); setEmail('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Paciente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div className="space-y-2">
            <Label>Procedimento *</Label>
            <Input value={procedure} onChange={(e) => setProcedure(e.target.value)} placeholder="Ex: Prostatectomia" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Cirurgião *</Label>
              <Input value={surgeon} onChange={(e) => setSurgeon(e.target.value)} placeholder="Nome do cirurgião" list="surgeon-list" />
              {surgeons.length > 0 && (
                <datalist id="surgeon-list">
                  {surgeons.map((s) => <option key={s} value={s} />)}
                </datalist>
              )}
            </div>
            <div className="space-y-2">
              <Label>Concierge</Label>
              <Input value={concierge} onChange={(e) => setConcierge(e.target.value)} placeholder="Nome do concierge" list="concierge-list" />
              {concierges.length > 0 && (
                <datalist id="concierge-list">
                  {concierges.map((c) => <option key={c} value={c} />)}
                </datalist>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select value={owner} onValueChange={(v) => setOwner(v as Owner)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OWNERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Etapa Inicial</Label>
            <Select value={stage} onValueChange={(v) => setStage(v as typeof stage)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor Estimado (R$)</Label>
            <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-0000" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@email.com" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!name || !procedure || !surgeon}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
