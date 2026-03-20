import { useState, useMemo, useCallback, useEffect } from 'react';
import { Patient, PIPELINE_STAGES, PipelineStage, DecisionStatus, Owner, Notification, PatientTask, PreOpChecklistItem, getNextPendingTask, getTaskUrgency, STAGE_LABELS, LossReason } from '@/data/types';
import { mockPatients } from '@/data/mockPatients';
import { PipelineColumn } from './PipelineColumn';
import { PatientPanel } from './PatientPanel';
import { FilterBar } from './FilterBar';
import { AddPatientForm } from './AddPatientForm';
import { AddTaskDialog } from './AddTaskDialog';
import { NotificationBell } from './NotificationBell';
import { LossReasonDialog } from './LossReasonDialog';
import { Button } from '@/components/ui/button';
import { Plus, Users, DollarSign, TrendingUp } from 'lucide-react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';

// Active pipeline stages (exclude 'lost' from main columns — shown as a separate column at end)
const ACTIVE_STAGES = PIPELINE_STAGES.filter((s) => s !== 'lost') as PipelineStage[];

export function PipelineDashboard() {
  const [patients, setPatients] = useState<Patient[]>(mockPatients);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [taskPatientId, setTaskPatientId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [surgeonFilter, setSurgeonFilter] = useState('all');
  const [conciergeFilter, setConciergeFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Loss reason dialog state
  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const [pendingLossDrag, setPendingLossDrag] = useState<{ patientId: string; fromStage: PipelineStage } | null>(null);

  const surgeons = useMemo(() => [...new Set(patients.map((p) => p.surgeon))], [patients]);
  const concierges = useMemo(() => [...new Set(patients.map((p) => p.concierge))], [patients]);

  // Generate notifications for overdue/due-today tasks
  useEffect(() => {
    const notifs: Notification[] = [];
    patients.forEach((p) => {
      if (p.stage === 'lost') return; // skip lost patients
      const nextTask = getNextPendingTask(p);
      const urgency = getTaskUrgency(nextTask);
      if (urgency === 'red' && nextTask) {
        notifs.push({
          id: `overdue-${p.id}-${nextTask.id}`,
          message: `Tarefa atrasada: "${nextTask.title}"`,
          patientId: p.id,
          patientName: p.name,
          type: 'task_overdue',
          read: false,
          createdAt: new Date().toISOString(),
        });
      } else if (urgency === 'red' && !nextTask) {
        notifs.push({
          id: `no-task-${p.id}`,
          message: 'Paciente sem tarefa pendente',
          patientId: p.id,
          patientName: p.name,
          type: 'task_overdue',
          read: false,
          createdAt: new Date().toISOString(),
        });
      } else if (urgency === 'yellow' && nextTask) {
        notifs.push({
          id: `today-${p.id}-${nextTask.id}`,
          message: `Tarefa vence hoje: "${nextTask.title}"`,
          patientId: p.id,
          patientName: p.name,
          type: 'task_due_today',
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    });
    setNotifications((prev) => {
      const readMap = new Map(prev.map((n) => [n.id, n.read]));
      return notifs.map((n) => ({ ...n, read: readMap.get(n.id) ?? false }));
    });
  }, [patients]);

  const filtered = useMemo(() => {
    return patients.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.procedure.toLowerCase().includes(search.toLowerCase())) return false;
      if (surgeonFilter !== 'all' && p.surgeon !== surgeonFilter) return false;
      if (conciergeFilter !== 'all' && p.concierge !== conciergeFilter) return false;
      if (ownerFilter !== 'all' && p.owner !== ownerFilter) return false;
      return true;
    });
  }, [patients, search, surgeonFilter, conciergeFilter, ownerFilter]);

  const activeFiltered = filtered.filter((p) => p.stage !== 'lost');
  const totalValue = useMemo(() => activeFiltered.reduce((s, p) => s + (p.estimatedValue || 0), 0), [activeFiltered]);
  const completedCount = activeFiltered.filter((p) => p.stage === 'surgery_completed').length;
  const lostCount = filtered.filter((p) => p.stage === 'lost').length;
  const conversionRate = (activeFiltered.length + lostCount) > 0 ? Math.round((completedCount / (activeFiltered.length + lostCount)) * 100) : 0;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  const handlePatientClick = useCallback((patient: Patient) => {
    setSelectedPatient(patient);
    setPanelOpen(true);
  }, []);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination, source } = result;
    const newStage = destination.droppableId as PipelineStage;
    const oldStage = source.droppableId as PipelineStage;

    if (oldStage === newStage) return;

    // If moving to "lost", open the loss reason dialog
    if (newStage === 'lost') {
      setPendingLossDrag({ patientId: draggableId, fromStage: oldStage });
      setLossDialogOpen(true);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    setPatients((prev) =>
      prev.map((p) =>
        p.id === draggableId
          ? { ...p, stage: newStage, stageEnteredAt: today, lossReason: null, lossReasonDetail: null }
          : p
      )
    );
    setSelectedPatient((prev) =>
      prev && prev.id === draggableId ? { ...prev, stage: newStage, stageEnteredAt: today } : prev
    );

    const patient = patients.find((p) => p.id === draggableId);
    if (patient) {
      setNotifications((prev) => [
        {
          id: `stage-${draggableId}-${Date.now()}`,
          message: `Movido para "${STAGE_LABELS[newStage]}"`,
          patientId: draggableId,
          patientName: patient.name,
          type: 'stage_changed',
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
  }, [patients]);

  const handleLossConfirm = useCallback((reason: LossReason, detail: string | null) => {
    if (!pendingLossDrag) return;
    const today = new Date().toISOString().split('T')[0];
    const { patientId } = pendingLossDrag;

    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? { ...p, stage: 'lost' as PipelineStage, stageEnteredAt: today, lossReason: reason, lossReasonDetail: detail }
          : p
      )
    );
    setSelectedPatient((prev) =>
      prev && prev.id === patientId ? { ...prev, stage: 'lost' as PipelineStage, stageEnteredAt: today, lossReason: reason, lossReasonDetail: detail } : prev
    );

    const patient = patients.find((p) => p.id === patientId);
    if (patient) {
      toast.info(`${patient.name} marcado como perdido`);
    }

    setLossDialogOpen(false);
    setPendingLossDrag(null);
  }, [pendingLossDrag, patients]);

  const handleLossCancel = useCallback(() => {
    setLossDialogOpen(false);
    setPendingLossDrag(null);
  }, []);

  const handleUpdateDecision = useCallback((patientId: string, status: DecisionStatus) => {
    setPatients((prev) => prev.map((p) => (p.id === patientId ? { ...p, decisionStatus: status } : p)));
    setSelectedPatient((prev) => (prev && prev.id === patientId ? { ...prev, decisionStatus: status } : prev));
  }, []);

  const handleUpdateOwner = useCallback((patientId: string, owner: Owner) => {
    setPatients((prev) => prev.map((p) => (p.id === patientId ? { ...p, owner } : p)));
    setSelectedPatient((prev) => (prev && prev.id === patientId ? { ...prev, owner } : prev));
  }, []);

  const handleCompleteTask = useCallback((patientId: string, taskId: string) => {
    const now = new Date().toISOString().split('T')[0];
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, completed: true, completedAt: now } : t)) }
          : p
      )
    );
    setSelectedPatient((prev) =>
      prev && prev.id === patientId
        ? { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, completed: true, completedAt: now } : t)) }
        : prev
    );

    toast.success('Tarefa concluída!', {
      description: 'Deseja criar a próxima tarefa?',
      action: {
        label: 'Criar tarefa',
        onClick: () => {
          setTaskPatientId(patientId);
          setAddTaskOpen(true);
        },
      },
    });
  }, []);

  const handleAddTask = useCallback((patientId: string) => {
    setTaskPatientId(patientId);
    setAddTaskOpen(true);
  }, []);

  const handleTaskCreated = useCallback((task: PatientTask) => {
    if (!taskPatientId) return;
    setPatients((prev) =>
      prev.map((p) => (p.id === taskPatientId ? { ...p, tasks: [...p.tasks, task] } : p))
    );
    setSelectedPatient((prev) =>
      prev && prev.id === taskPatientId ? { ...prev, tasks: [...prev.tasks, task] } : prev
    );
  }, [taskPatientId]);

  const handleTogglePreOpItem = useCallback((patientId: string, item: PreOpChecklistItem) => {
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? { ...p, preOpChecklist: { ...p.preOpChecklist, [item]: !p.preOpChecklist[item] } }
          : p
      )
    );
    setSelectedPatient((prev) =>
      prev && prev.id === patientId
        ? { ...prev, preOpChecklist: { ...prev.preOpChecklist, [item]: !prev.preOpChecklist[item] } }
        : prev
    );
  }, []);

  const handleAddPatient = useCallback((patient: Patient) => {
    setPatients((prev) => [...prev, patient]);
  }, []);

  const handleMarkNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleNotificationClick = useCallback((patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
    if (patient) {
      setSelectedPatient(patient);
      setPanelOpen(true);
    }
  }, [patients]);

  const taskPatient = taskPatientId ? patients.find((p) => p.id === taskPatientId) : null;
  const lossDialogPatient = pendingLossDrag ? patients.find((p) => p.id === pendingLossDrag.patientId) : null;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Pipeline Cirúrgico</h1>
            <p className="text-sm text-muted-foreground">Gestão de conversão de pacientes</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell
              notifications={notifications}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllRead}
              onClickNotification={handleNotificationClick}
            />
            <Button onClick={() => setAddOpen(true)} size="sm">
              <Plus className="h-4 w-4" />
              Novo Paciente
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Ativos:</span>
            <span className="font-semibold text-foreground">{activeFiltered.length}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Pipeline:</span>
            <span className="font-semibold text-foreground">{formatCurrency(totalValue)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Conversão:</span>
            <span className="font-semibold text-foreground">{conversionRate}%</span>
          </div>
          {lostCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Perdidos:</span>
              <span className="font-semibold text-destructive">{lostCount}</span>
            </div>
          )}
        </div>

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          surgeon={surgeonFilter}
          onSurgeonChange={setSurgeonFilter}
          concierge={conciergeFilter}
          onConciergeChange={setConciergeFilter}
          owner={ownerFilter}
          onOwnerChange={setOwnerFilter}
          surgeons={surgeons}
          concierges={concierges}
        />
      </header>

      {/* Kanban */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-4 p-6 h-full min-w-max">
            {ACTIVE_STAGES.map((stage) => (
              <PipelineColumn
                key={stage}
                stage={stage}
                patients={filtered.filter((p) => p.stage === stage)}
                onPatientClick={handlePatientClick}
                onCompleteTask={handleCompleteTask}
              />
            ))}
            {/* Lost column — visually distinct */}
            <PipelineColumn
              key="lost"
              stage="lost"
              patients={filtered.filter((p) => p.stage === 'lost')}
              onPatientClick={handlePatientClick}
              onCompleteTask={handleCompleteTask}
              variant="lost"
            />
          </div>
        </div>
      </DragDropContext>

      {/* Patient Panel */}
      <PatientPanel
        patient={selectedPatient}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onUpdateDecision={handleUpdateDecision}
        onUpdateOwner={handleUpdateOwner}
        onCompleteTask={handleCompleteTask}
        onAddTask={handleAddTask}
        onTogglePreOpItem={handleTogglePreOpItem}
      />

      {/* Add Patient Dialog */}
      <AddPatientForm
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAddPatient}
        surgeons={surgeons}
        concierges={concierges}
      />

      {/* Add Task Dialog */}
      <AddTaskDialog
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        onAdd={handleTaskCreated}
        patientName={taskPatient?.name || ''}
        defaultResponsible={taskPatient?.owner}
      />

      {/* Loss Reason Dialog */}
      <LossReasonDialog
        open={lossDialogOpen}
        patientName={lossDialogPatient?.name || ''}
        onConfirm={handleLossConfirm}
        onCancel={handleLossCancel}
      />
    </div>
  );
}
