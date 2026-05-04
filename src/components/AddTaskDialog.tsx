import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PatientTask, OWNERS, Owner } from '@/data/types';
import { TASK_PRESETS, TASK_PRESET_OTHER } from '@/data/taskPresets';

interface AddTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (task: PatientTask) => void;
  patientName: string;
  defaultResponsible?: Owner;
}

export function AddTaskDialog({ open, onClose, onAdd, patientName, defaultResponsible }: AddTaskDialogProps) {
  const [preset, setPreset] = useState<string>(TASK_PRESETS[0]);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('10:00');
  const [responsible, setResponsible] = useState<Owner>(defaultResponsible || OWNERS[0]);

  // Sync title when preset changes (unless user is on "Outro")
  useEffect(() => {
    if (preset !== TASK_PRESET_OTHER) setTitle(preset);
    else setTitle('');
  }, [preset]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setPreset(TASK_PRESETS[0]);
      setTitle(TASK_PRESETS[0]);
      setDueDate('');
      setDueTime('10:00');
      if (defaultResponsible) setResponsible(defaultResponsible);
    }
  }, [open, defaultResponsible]);

  const handleSubmit = () => {
    if (!title || !dueDate) return;
    const task: PatientTask = {
      id: crypto.randomUUID(),
      title,
      dueDate,
      dueTime,
      responsible,
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString().split('T')[0],
    };
    onAdd(task);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova ação — {patientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de ação</Label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TASK_PRESETS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                <SelectItem value={TASK_PRESET_OTHER}>{TASK_PRESET_OTHER}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={preset === TASK_PRESET_OTHER ? 'Descreva a ação' : ''}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prazo máximo *</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Horário</Label>
              <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select value={responsible} onValueChange={(v) => setResponsible(v as Owner)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OWNERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!title || !dueDate}>Criar ação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
