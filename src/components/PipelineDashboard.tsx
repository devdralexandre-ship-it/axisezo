import { useState, useMemo, useCallback, useEffect } from 'react';
import { Patient, PIPELINE_STAGES, PipelineStage, DecisionStatus, Owner, Notification, PatientTask, PreOpChecklistItem, getNextPendingTask, getTaskUrgency, STAGE_LABELS, LossReason } from '@/data/types';
import { usePatients, useUpdatePatientStage, useUpdatePatientField, useCompleteTask, useAddTask, useTogglePreOpItem, useAddPatient } from '@/hooks/usePatients';
import { PipelineColumn } from './PipelineColumn';
import { PatientPanel } from './PatientPanel';
import { FilterBar } from './FilterBar';
import { AddPatientForm } from './AddPatientForm';
import { AddTaskDialog } from './AddTaskDialog';
import { NotificationBell } from './NotificationBell';
import { LossReasonDialog } from './LossReasonDialog';
import { Button } from '@/components/ui/button';
import { Plus, Users, DollarSign, TrendingUp, LogOut } from 'lucide-react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

const ACTIVE_STAGES = PIPELINE_STAGES.filter((s) => s !== 'lost') as PipelineStage[];

export function PipelineDashboard() {
  const { data: patients = [], isLoading } = usePatients();
  const updateStage = useUpdatePatientStage();
  const updateField = useUpdatePatientField();
  const completeTaskMutation = useCompleteTask();
  const addTaskMutation = useAddTask();
  const togglePreOp = useTogglePreOpItem();
  const addPatientMutation = useAddPatient();
  const { signOut, user } = useAuth();

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [taskPatientId, setTaskPatientId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [surgeonFilter, setSurgeonFilter] = useState('all');
  const [conciergeFilter, setConciergeFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());

  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const [pendingLossDrag, setPendingLossDrag] = useState<{ patientId: string; fromStage: PipelineStage } | null>(null);

  const surgeons = useMemo(() => [...new Set(patients.map((p) => p.surgeon))], [patients]);
  const concierges = useMemo(() => [...new Set(patients.map((p) => p.concierge))], [patients]);

  // Keep selected patient in sync with data
  useEffect(() => {
    if (selectedPatient) {
      const updated = patients.find((p) => p.id === selectedPatient.id);
      if (updated) setSelectedPatient(updated);
    }
  }, [patients]);

  // Generate notifications
  useEffect(() => {
    const notifs: Notification[] = [];
    patients.forEach((p) => {
      if (p.stage === 'lost') return;
      const nextTask = getNextPendingTask(p);
      const urgency = getTaskUrgency(nextTask);
      if (urgency === 'red' && nextTask) {
        notifs.push({ id: `overdue-${p.id}-${nextTask.id}`, message: `Tarefa atrasada: "${nextTask.title}"`, patientId: p.id, patientName: p.name, type: 'task_overdue', read: false, createdAt: new Date().toISOString() });
      } else if (urgency === 'red' && !nextTask) {
        notifs.push({ id: `no-task-${p.id}`, message: 'Paciente sem tarefa pendente', patientId: p.id, patientName: p.name, type: 'task_overdue', read: false, createdAt: new Date().toISOString() });
      } else if (urgency === 'yellow' && nextTask) {
        notifs.push({ id: `today-${p.id}-${nextTask.id}`, message: `Tarefa vence hoje: "${nextTask.title}"`, patientId: p.id, patientName: p.name, type: 'task_due_today', read: false, createdAt: new Date().toISOString() });
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

    if (newStage === 'lost') {
      setPendingLossDrag({ patientId: draggableId, fromStage: oldStage });
      setLossDialogOpen(true);
      return;
    }

    updateStage.mutate({ id: draggableId, stage: newStage });
  }, [updateStage]);

  const handleLossConfirm = useCallback((reason: LossReason, detail: string | null) => {
    if (!pendingLossDrag) return;
    updateStage.mutate({
      id: pendingLossDrag.patientId,
      stage: 'lost',
      lossReason: reason,
      lossReasonDetail: detail,
    });
    const patient = patients.find((p) => p.id === pendingLossDrag.patientId);
    if (patient) toast.info(`${patient.name} marcado como perdido`);
    setLossDialogOpen(false);
    setPendingLossDrag(null);
  }, [pendingLossDrag, patients, updateStage]);

  const handleLossCancel = useCallback(() => {
    setLossDialogOpen(false);
    setPendingLossDrag(null);
  }, []);

  const handleUpdateDecision = useCallback((patientId: string, status: DecisionStatus) => {
    updateField.mutate({ id: patientId, field: 'decision_status', value: status });
  }, [updateField]);

  const handleUpdateOwner = useCallback((patientId: string, owner: Owner) => {
    updateField.mutate({ id: patientId, field: 'owner', value: owner });
  }, [updateField]);

  const handleCompleteTask = useCallback((patientId: string, taskId: string) => {
    completeTaskMutation.mutate(taskId, {
      onSuccess: () => {
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
      },
    });
  }, [completeTaskMutation]);

  const handleAddTask = useCallback((patientId: string) => {
    setTaskPatientId(patientId);
    setAddTaskOpen(true);
  }, []);

  const handleTaskCreated = useCallback((task: PatientTask) => {
    if (!taskPatientId) return;
    addTaskMutation.mutate({ patientId: taskPatientId, task });
  }, [taskPatientId, addTaskMutation]);

  const handleTogglePreOpItem = useCallback((patientId: string, item: PreOpChecklistItem) => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return;
    const currentValue = patient.preOpChecklist[item];
    togglePreOp.mutate({ patientId, itemKey: item, checked: !currentValue });
  }, [patients, togglePreOp]);

  const handleAddPatient = useCallback((patient: Patient) => {
    addPatientMutation.mutate(patient);
  }, [addPatientMutation]);

  const handleMarkNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleNotificationClick = useCallback((patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
    if (patient) { setSelectedPatient(patient); setPanelOpen(true); }
  }, [patients]);

  const taskPatient = taskPatientId ? patients.find((p) => p.id === taskPatientId) : null;
  const lossDialogPatient = pendingLossDrag ? patients.find((p) => p.id === pendingLossDrag.patientId) : null;

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background p-6 gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-8 w-full" />
        <div className="flex gap-4 flex-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="w-[260px] h-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Pipeline Cirúrgico</h1>
            <p className="text-sm text-muted-foreground">Gestão de conversão de pacientes</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
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
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

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
          search={search} onSearchChange={setSearch}
          surgeon={surgeonFilter} onSurgeonChange={setSurgeonFilter}
          concierge={conciergeFilter} onConciergeChange={setConciergeFilter}
          owner={ownerFilter} onOwnerChange={setOwnerFilter}
          surgeons={surgeons} concierges={concierges}
        />
      </header>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-4 p-6 h-full min-w-max">
            {ACTIVE_STAGES.map((stage) => (
              <PipelineColumn key={stage} stage={stage} patients={filtered.filter((p) => p.stage === stage)} onPatientClick={handlePatientClick} onCompleteTask={handleCompleteTask} />
            ))}
            <PipelineColumn key="lost" stage="lost" patients={filtered.filter((p) => p.stage === 'lost')} onPatientClick={handlePatientClick} onCompleteTask={handleCompleteTask} variant="lost" />
          </div>
        </div>
      </DragDropContext>

      <PatientPanel patient={selectedPatient} open={panelOpen} onClose={() => setPanelOpen(false)} onUpdateDecision={handleUpdateDecision} onUpdateOwner={handleUpdateOwner} onCompleteTask={handleCompleteTask} onAddTask={handleAddTask} onTogglePreOpItem={handleTogglePreOpItem} />
      <AddPatientForm open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAddPatient} surgeons={surgeons} concierges={concierges} />
      <AddTaskDialog open={addTaskOpen} onClose={() => setAddTaskOpen(false)} onAdd={handleTaskCreated} patientName={taskPatient?.name || ''} defaultResponsible={taskPatient?.owner} />
      <LossReasonDialog open={lossDialogOpen} patientName={lossDialogPatient?.name || ''} onConfirm={handleLossConfirm} onCancel={handleLossCancel} />
    </div>
  );
}
