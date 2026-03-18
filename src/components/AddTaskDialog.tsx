import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PatientTask, OWNERS, Owner } from '@/data/types';

interface AddTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (task: PatientTask) => void;
  patientName: string;
  defaultResponsible?: Owner;
}

export function AddTaskDialog({ open, onClose, onAdd, patientName, defaultResponsible }: AddTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('10:00');
  const [responsible, setResponsible] = useState<Owner>(defaultResponsible || OWNERS[0]);

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
    setTitle('');
    setDueDate('');
    setDueTime('10:00');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova Tarefa — {patientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Ligar para confirmar" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data *</Label>
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
          <Button onClick={handleSubmit} disabled={!title || !dueDate}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
