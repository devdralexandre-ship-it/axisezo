import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PatientTask, Owner } from '@/data/types';
import { TaskFormFields, TaskDraft, emptyTaskDraft, taskDraftIsValid } from './TaskFormFields';
import { useTaskTypes } from '@/hooks/useTaskTypes';

interface AddTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (task: PatientTask) => void;
  patientName: string;
  defaultResponsible?: Owner;
}

export function AddTaskDialog({ open, onClose, onAdd, patientName, defaultResponsible }: AddTaskDialogProps) {
  const [draft, setDraft] = useState<TaskDraft>(emptyTaskDraft(defaultResponsible));
  const { data: taskTypes = [] } = useTaskTypes();

  useEffect(() => {
    if (open) setDraft(emptyTaskDraft(defaultResponsible));
  }, [open, defaultResponsible]);

  const valid = taskDraftIsValid(draft, taskTypes);

  const handleSubmit = () => {
    if (!valid) return;
    onAdd({
      id: crypto.randomUUID(),
      title: draft.title,
      dueDate: draft.dueDate,
      dueTime: draft.dueTime,
      responsible: draft.responsible,
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString().split('T')[0],
      taskTypeId: draft.taskTypeId,
      deadlineOverrideReason: draft.deadlineOverrideReason.trim() || null,
      slaHours: draft.slaHours,
      escalateAfterHours: draft.escalateAfterHours,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova ação — {patientName}</DialogTitle>
        </DialogHeader>
        <TaskFormFields value={draft} onChange={setDraft} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!valid}>Criar ação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
