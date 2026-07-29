import { useState, useMemo, useCallback, useEffect } from 'react';
import { Patient, PIPELINE_STAGES, PipelineStage, DecisionStatus, Owner, Notification, PatientTask, PreOpChecklistItem, getNextPendingTask, getTaskUrgency, STAGE_LABELS, LossReason, getTaskSlaState } from '@/data/types';
import { usePatients, useUpdatePatientStage, useUpdatePatientFields, useCompleteTask, useAddTask, useTogglePreOpItem, useAddPatient, useDeletePatient, useImportPatients } from '@/hooks/usePatients';
import { PipelineColumn } from './PipelineColumn';
import { PatientPanel } from './PatientPanel';
import { FilterBar } from './FilterBar';
import { AddPatientForm } from './AddPatientForm';
import { AddTaskDialog } from './AddTaskDialog';
import { NotificationBell } from './NotificationBell';
import { LossReasonDialog } from './LossReasonDialog';
import { SurgeryDateDialog } from './SurgeryDateDialog';
import { DeletePatientDialog } from './DeletePatientDialog';
import { CsvImporter } from './CsvImporter';
import { Button } from '@/components/ui/button';
import { Plus, Users, DollarSign, TrendingUp, LogOut, Upload, FileText, Shield, UserCircle, BookOpen, Menu, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { Link } from 'react-router-dom';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { normalizeText } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useRealtimePatients } from '@/hooks/useRealtimePatients';
import { ConciergeLoginBriefing, useConciergeBriefing } from './ConciergeLoginBriefing';
import { useIsMobile } from '@/hooks/use-mobile';
import { AlertTriangle, ChevronLeft, ChevronRight, ListTodo, BarChart3, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { SortControl, SortKey, SortDir, sortPatients } from './SortControl';
import { FilterSheet } from './FilterSheet';
import { PatientsTable } from './PatientsTable';

const ACTIVE_STAGES = PIPELINE_STAGES.filter((s) => s !== 'lost') as PipelineStage[];

function ViewToggle({ mode, onChange }: { mode: 'kanban' | 'table'; onChange: (m: 'kanban' | 'table') => void }) {
  return (
    <div className="inline-flex items-center rounded-md border border-input bg-background overflow-hidden h-8">
      <button
        type="button"
        onClick={() => onChange('kanban')}
        className={`px-2 h-full flex items-center gap-1 text-xs ${mode === 'kanban' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
        title="Visualizar como Kanban"
      >
        <LayoutGrid className="h-3.5 w-3.5" /> Kanban
      </button>
      <button
        type="button"
        onClick={() => onChange('table')}
        className={`px-2 h-full flex items-center gap-1 text-xs border-l border-input ${mode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
        title="Visualizar como planilha"
      >
        <TableIcon className="h-3.5 w-3.5" /> Planilha
      </button>
    </div>
  );
}

export function PipelineDashboard() {
  useRealtimePatients();
  const { data: patients = [], isLoading } = usePatients();
  const updateStage = useUpdatePatientStage();
  const updateFields = useUpdatePatientFields();
  const completeTaskMutation = useCompleteTask();
  const addTaskMutation = useAddTask();
  const togglePreOp = useTogglePreOpItem();
  const addPatientMutation = useAddPatient();
  const deletePatientMutation = useDeletePatient();
  const importPatientsMutation = useImportPatients();
  const { signOut, user } = useAuth();
  const { isAdmin, canSeeFinancials, can, isConcierge, conciergeName } = useUserRole();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const briefing = useConciergeBriefing(user?.id, conciergeName, patients);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [taskPatientId, setTaskPatientId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [surgeonFilter, setSurgeonFilter] = useState('all');
  const [conciergeFilter, setConciergeFilter] = useState('all');
  const [procedureFilter, setProcedureFilter] = useState('all');
  const [patientTypeFilter, setPatientTypeFilter] = useState('all');
  const [surgicalApproachFilter, setSurgicalApproachFilter] = useState('all');
  const [payerFilter, setPayerFilter] = useState('all');
  const [billingTypeFilter, setBillingTypeFilter] = useState('all');
  const [hospitalFilter, setHospitalFilter] = useState('all');
  const [indicationSourceFilter, setIndicationSourceFilter] = useState('all');
  const [indicationFrom, setIndicationFrom] = useState('');
  const [indicationTo, setIndicationTo] = useState('');
  const [slaFilter, setSlaFilter] = useState<'all' | 'breached' | 'escalated'>('all');

  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());

  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const [pendingLossDrag, setPendingLossDrag] = useState<{ patientId: string; fromStage: PipelineStage } | null>(null);

  const [surgeryDialogOpen, setSurgeryDialogOpen] = useState(false);
  const [pendingSurgeryDrag, setPendingSurgeryDrag] = useState<{ patientId: string; fromStage: PipelineStage } | null>(null);
  const [editingSurgeryPatientId, setEditingSurgeryPatientId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePatientId, setDeletePatientId] = useState<string | null>(null);
  const [csvImporterOpen, setCsvImporterOpen] = useState(false);

  const isMobile = useIsMobile();
  const ALL_STAGES = useMemo<PipelineStage[]>(() => [...ACTIVE_STAGES, 'lost'], []);
  const [mobileStage, setMobileStage] = useState<PipelineStage>(ACTIVE_STAGES[0]);
  const [sortKey, setSortKey] = useState<SortKey>(() => (localStorage.getItem('kanban_sort_key') as SortKey) || 'indication');
  const [sortDir, setSortDir] = useState<SortDir>(() => (localStorage.getItem('kanban_sort_dir') as SortDir) || 'asc');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>(() => (localStorage.getItem('view_mode') as any) || 'kanban');
  useEffect(() => { localStorage.setItem('kanban_sort_key', sortKey); }, [sortKey]);
  useEffect(() => { localStorage.setItem('kanban_sort_dir', sortDir); }, [sortDir]);
  useEffect(() => { localStorage.setItem('view_mode', viewMode); }, [viewMode]);



  const surgeons = useMemo(() => [...new Set(patients.map((p) => p.surgeon).filter(Boolean))], [patients]);
  const concierges = useMemo(() => [...new Set(patients.map((p) => p.concierge).filter(Boolean))], [patients]);

  // Keep selected patient in sync with data
  const selectedPatientId = selectedPatient?.id;
  useEffect(() => {
    if (selectedPatientId) {
      const updated = patients.find((p) => p.id === selectedPatientId);
      if (updated) setSelectedPatient(updated);
    }
  }, [patients, selectedPatientId]);


  // Generate notifications as derived state
  const notifications = useMemo(() => {
    const notifs: Notification[] = [];
    patients.forEach((p) => {
      if (p.stage === 'lost') return;
      const nextTask = getNextPendingTask(p);
      const urgency = getTaskUrgency(nextTask);
      if (urgency === 'red' && nextTask) {
        notifs.push({ id: `overdue-${p.id}-${nextTask.id}`, message: `Ação atrasada: "${nextTask.title}"`, patientId: p.id, patientName: p.name, type: 'task_overdue', read: readNotifications.has(`overdue-${p.id}-${nextTask.id}`), createdAt: new Date().toISOString() });
      } else if (urgency === 'red' && !nextTask) {
        notifs.push({ id: `no-task-${p.id}`, message: 'Paciente sem próxima ação definida', patientId: p.id, patientName: p.name, type: 'task_overdue', read: readNotifications.has(`no-task-${p.id}`), createdAt: new Date().toISOString() });
      } else if (urgency === 'yellow' && nextTask) {
        notifs.push({ id: `today-${p.id}-${nextTask.id}`, message: `Ação vence hoje: "${nextTask.title}"`, patientId: p.id, patientName: p.name, type: 'task_due_today', read: readNotifications.has(`today-${p.id}-${nextTask.id}`), createdAt: new Date().toISOString() });
      }
    });
    return notifs;
  }, [patients, readNotifications]);

  const filtered = useMemo(() => {
    return patients.filter((p) => {
      if (search) {
        const q = normalizeText(search);
        if (!normalizeText(p.name).includes(q) && !normalizeText(p.procedure).includes(q)) return false;
      }
      if (surgeonFilter !== 'all' && p.surgeon !== surgeonFilter) return false;
      if (conciergeFilter !== 'all' && p.concierge !== conciergeFilter) return false;
      if (procedureFilter !== 'all' && p.procedure !== procedureFilter) return false;
      if (patientTypeFilter !== 'all' && p.patientType !== patientTypeFilter) return false;
      if (surgicalApproachFilter !== 'all' && p.surgicalApproach !== surgicalApproachFilter) return false;
      if (payerFilter !== 'all' && p.payer !== payerFilter) return false;
      if (billingTypeFilter !== 'all' && p.billingType !== billingTypeFilter) return false;
      if (hospitalFilter !== 'all' && p.desiredHospital !== hospitalFilter) return false;
      if (indicationSourceFilter !== 'all' && p.indicationLocation !== indicationSourceFilter) return false;
      if (indicationFrom || indicationTo) {
        const ref = p.indicationDate || p.createdAt;
        if (!ref) return false;
        if (indicationFrom && ref < indicationFrom) return false;
        if (indicationTo && ref > indicationTo) return false;
      }
      if (slaFilter !== 'all') {
        const states = p.tasks.filter(t => !t.completed).map(getTaskSlaState);
        if (slaFilter === 'breached' && !states.some(s => s === 'breached' || s === 'escalated')) return false;
        if (slaFilter === 'escalated' && !states.includes('escalated')) return false;
      }
      return true;
    });
  }, [patients, search, surgeonFilter, conciergeFilter, procedureFilter, patientTypeFilter, surgicalApproachFilter, payerFilter, billingTypeFilter, hospitalFilter, indicationSourceFilter, indicationFrom, indicationTo, slaFilter]);


  const activeFiltered = filtered.filter((p) => p.stage !== 'lost');
  // Metrics exclude 'surgical_potential' (acompanhamento — não entra em KPIs).
  const metricPatients = filtered.filter((p) => p.stage !== 'lost' && p.stage !== 'surgical_potential');
  const totalValue = useMemo(() => metricPatients.reduce((s, p) => s + (p.estimatedValue ?? p.medicalFees ?? 0), 0), [metricPatients]);
  const completedCount = metricPatients.filter((p) => p.stage === 'surgery_completed').length;
  const lostCount = filtered.filter((p) => p.stage === 'lost').length;
  const conversionRate = (metricPatients.length + lostCount) > 0 ? Math.round((completedCount / (metricPatients.length + lostCount)) * 100) : 0;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  const handlePatientClick = useCallback((patient: Patient) => {
    setSelectedPatient(patient);
    setPanelOpen(true);
  }, []);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!can('move_pipeline')) {
      toast.error('Você não tem permissão para mover pacientes.');
      return;
    }
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

    if (newStage === 'surgery_scheduled') {
      setPendingSurgeryDrag({ patientId: draggableId, fromStage: oldStage });
      setSurgeryDialogOpen(true);
      return;
    }

    // Optimistic update
    queryClient.setQueryData<Patient[]>(['patients'], (old) => {
      if (!old) return old;
      return old.map((p) =>
        p.id === draggableId
          ? { ...p, stage: newStage, stageEnteredAt: new Date().toISOString().split('T')[0] }
          : p
      );
    });

    updateStage.mutate({ id: draggableId, stage: newStage }, {
      onError: () => {
        queryClient.setQueryData<Patient[]>(['patients'], (old) => {
          if (!old) return old;
          return old.map((p) =>
            p.id === draggableId
              ? { ...p, stage: oldStage }
              : p
          );
        });
        toast.error('Erro ao mover paciente. Tente novamente.');
      },
      onSuccess: () => {
        // Refetch to ensure consistency after successful save
        queryClient.invalidateQueries({ queryKey: ['patients'] });
      },
    });
  }, [updateStage, queryClient]);

  // Programmatic stage change used by the PatientPanel dropdown (mobile-first,
  // since drag-and-drop is disabled on touch). Reuses the same guardrails as
  // handleDragEnd (permission check, loss reason, surgery date).
  const changeStageManual = useCallback((patientId: string, newStage: PipelineStage) => {
    if (!can('move_pipeline')) {
      toast.error('Você não tem permissão para mover pacientes.');
      return;
    }
    const current = patients.find((p) => p.id === patientId);
    if (!current || current.stage === newStage) return;
    const oldStage = current.stage;
    if (newStage === 'lost') {
      setPendingLossDrag({ patientId, fromStage: oldStage });
      setLossDialogOpen(true);
      return;
    }
    if (newStage === 'surgery_scheduled') {
      setPendingSurgeryDrag({ patientId, fromStage: oldStage });
      setSurgeryDialogOpen(true);
      return;
    }
    queryClient.setQueryData<Patient[]>(['patients'], (old) =>
      old?.map((p) => p.id === patientId ? { ...p, stage: newStage, stageEnteredAt: new Date().toISOString().split('T')[0] } : p)
    );
    updateStage.mutate({ id: patientId, stage: newStage }, {
      onError: () => {
        queryClient.setQueryData<Patient[]>(['patients'], (old) =>
          old?.map((p) => p.id === patientId ? { ...p, stage: oldStage } : p)
        );
        toast.error('Erro ao mover paciente. Tente novamente.');
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patients'] }),
    });
  }, [can, patients, updateStage, queryClient]);

  const handleLossConfirm = useCallback((reason: LossReason, detail: string | null) => {
    if (!pendingLossDrag) return;

    queryClient.setQueryData<Patient[]>(['patients'], (old) => {
      if (!old) return old;
      return old.map((p) =>
        p.id === pendingLossDrag.patientId
          ? { ...p, stage: 'lost' as PipelineStage, lossReason: reason, lossReasonDetail: detail }
          : p
      );
    });

    updateStage.mutate({
      id: pendingLossDrag.patientId,
      stage: 'lost',
      lossReason: reason,
      lossReasonDetail: detail,
    }, {
      onError: () => {
        queryClient.setQueryData<Patient[]>(['patients'], (old) => {
          if (!old) return old;
          return old.map((p) =>
            p.id === pendingLossDrag.patientId
              ? { ...p, stage: pendingLossDrag.fromStage, lossReason: null, lossReasonDetail: null }
              : p
          );
        });
        toast.error('Erro ao marcar como perdido. Tente novamente.');
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['patients'] });
      },
    });

    const patient = patients.find((p) => p.id === pendingLossDrag.patientId);
    if (patient) toast.info(`${patient.name} marcado como perdido`);
    setLossDialogOpen(false);
    setPendingLossDrag(null);
  }, [pendingLossDrag, patients, updateStage, queryClient]);

  const handleLossCancel = useCallback(() => {
    setLossDialogOpen(false);
    setPendingLossDrag(null);
  }, []);

  const handleSurgeryDateConfirm = useCallback((dateIso: string, timeIso: string | null) => {
    // Edit-only flow (from panel) — doesn't change stage
    if (editingSurgeryPatientId) {
      const id = editingSurgeryPatientId;
      queryClient.setQueryData<Patient[]>(['patients'], (old) => {
        if (!old) return old;
        return old.map((p) => p.id === id
          ? { ...p, surgeryDate: dateIso, surgeryTime: timeIso ? timeIso.substring(0, 5) : null }
          : p);
      });
      updateFields.mutate(
        { id, fields: { surgery_date: dateIso, surgery_time: timeIso } },
        {
          onError: () => {
            toast.error('Erro ao salvar a data da cirurgia.');
            queryClient.invalidateQueries({ queryKey: ['patients'] });
          },
          onSuccess: () => toast.success('Data da cirurgia atualizada'),
        },
      );
      setSurgeryDialogOpen(false);
      setEditingSurgeryPatientId(null);
      return;
    }

    if (!pendingSurgeryDrag) return;
    const { patientId, fromStage } = pendingSurgeryDrag;
    const today = new Date().toISOString().split('T')[0];

    queryClient.setQueryData<Patient[]>(['patients'], (old) => {
      if (!old) return old;
      return old.map((p) => p.id === patientId
        ? {
            ...p,
            stage: 'surgery_scheduled' as PipelineStage,
            stageEnteredAt: today,
            surgeryDate: dateIso,
            surgeryTime: timeIso ? timeIso.substring(0, 5) : null,
          }
        : p);
    });

    updateStage.mutate(
      { id: patientId, stage: 'surgery_scheduled', surgeryDate: dateIso, surgeryTime: timeIso },
      {
        onError: () => {
          queryClient.setQueryData<Patient[]>(['patients'], (old) => {
            if (!old) return old;
            return old.map((p) => p.id === patientId ? { ...p, stage: fromStage } : p);
          });
          toast.error('Erro ao agendar cirurgia. Tente novamente.');
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['patients'] });
          toast.success('Cirurgia agendada');
        },
      },
    );

    setSurgeryDialogOpen(false);
    setPendingSurgeryDrag(null);
  }, [pendingSurgeryDrag, editingSurgeryPatientId, updateStage, updateFields, queryClient]);

  const handleSurgeryDateCancel = useCallback(() => {
    setSurgeryDialogOpen(false);
    setPendingSurgeryDrag(null);
    setEditingSurgeryPatientId(null);
  }, []);

  const handleEditSurgeryDate = useCallback((patientId: string) => {
    setEditingSurgeryPatientId(patientId);
    setSurgeryDialogOpen(true);
  }, []);


  const handleUpdateDecision = useCallback((patientId: string, status: DecisionStatus) => {
    updateFields.mutate({ id: patientId, fields: { decision_status: status } });
  }, [updateFields]);

  const handleUpdateOwner = useCallback((patientId: string, owner: Owner) => {
    updateFields.mutate({ id: patientId, fields: { owner } });
  }, [updateFields]);

  const handleUpdateFields = useCallback((patientId: string, fields: Record<string, any>) => {
    updateFields.mutate({ id: patientId, fields });
  }, [updateFields]);

  const handleCompleteTask = useCallback((patientId: string, taskId: string) => {
    completeTaskMutation.mutate(taskId, {
      onSuccess: () => {
        toast.success('Ação concluída!', {
          description: 'Deseja criar a próxima ação?',
          action: {
            label: 'Nova ação',
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

  const handleAddPatient = useCallback(async (patient: Partial<Patient> & { name: string; procedure: string; surgeon: string; initialTasks?: { title: string; dueDate: string; dueTime: string; responsible: string }[] }) => {
    const created = await addPatientMutation.mutateAsync(patient);
    return created as { id: string };
  }, [addPatientMutation]);

  const handleDeletePatient = useCallback((patientId: string) => {
    setDeletePatientId(patientId);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deletePatientId) return;
    // Close panel if this patient is selected
    if (selectedPatient?.id === deletePatientId) {
      setPanelOpen(false);
      setSelectedPatient(null);
    }
    deletePatientMutation.mutate(deletePatientId);
    setDeleteDialogOpen(false);
    setDeletePatientId(null);
  }, [deletePatientId, deletePatientMutation, selectedPatient]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteDialogOpen(false);
    setDeletePatientId(null);
  }, []);

  const handleMarkNotificationRead = useCallback((id: string) => {
    setReadNotifications((prev) => new Set(prev).add(id));
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setReadNotifications(new Set(notifications.map((n) => n.id)));
  }, [notifications]);

  const handleNotificationClick = useCallback((patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
    if (patient) { setSelectedPatient(patient); setPanelOpen(true); }
  }, [patients]);

  const taskPatient = taskPatientId ? patients.find((p) => p.id === taskPatientId) : null;
  const lossDialogPatient = pendingLossDrag ? patients.find((p) => p.id === pendingLossDrag.patientId) : null;
  const surgeryDialogPatientId = pendingSurgeryDrag?.patientId || editingSurgeryPatientId || null;
  const surgeryDialogPatient = surgeryDialogPatientId ? patients.find((p) => p.id === surgeryDialogPatientId) : null;
  const deleteDialogPatient = deletePatientId ? patients.find((p) => p.id === deletePatientId) : null;

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
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="border-b border-border px-4 md:px-6 py-2 md:py-3 shrink-0 bg-background">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="min-w-0">
            <h1 className="leading-none flex items-baseline">
              <span className="font-serif text-xl font-semibold text-primary tracking-wide">EZO</span>
              <span className="ml-2 font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Urologia</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 hidden md:block">Pipeline de decisão cirúrgica</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground hidden xl:inline">{user?.email}</span>
            <NotificationBell
              notifications={notifications}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllRead}
              onClickNotification={handleNotificationClick}
              autoOpenKey={user?.id}
            />
            {/* Desktop primary buttons */}
            <Button asChild variant="outline" size="sm" className="hidden md:inline-flex h-8 text-xs px-2.5">
              <Link to="/pendencias"><ListTodo className="h-3.5 w-3.5 mr-1" />Pendências</Link>
            </Button>
            <Button onClick={() => setAddOpen(true)} size="sm" className="h-8 text-xs px-2.5">
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Novo Paciente</span>
              <span className="sm:hidden">Novo</span>
            </Button>
            {/* Desktop "More" menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="hidden md:inline-flex">
                <Button variant="outline" size="sm" className="h-8 text-xs px-2.5" aria-label="Mais opções">
                  <Menu className="h-3.5 w-3.5 mr-1" />Mais
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-background z-50">
                {user?.email && (
                  <>
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground truncate">
                      {user.email}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => navigate('/relatorios')}>
                  <BarChart3 className="h-4 w-4 mr-2" />Relatórios
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/perfil')}>
                  <UserCircle className="h-4 w-4 mr-2" />Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/templates')}>
                  <FileText className="h-4 w-4 mr-2" />Templates
                </DropdownMenuItem>
                {can('manage_library') && (
                  <DropdownMenuItem onClick={() => navigate('/library')}>
                    <BookOpen className="h-4 w-4 mr-2" />Biblioteca
                  </DropdownMenuItem>
                )}
                {(isAdmin || can('manage_users')) && (
                  <DropdownMenuItem onClick={() => navigate('/admin/users')}>
                    <Shield className="h-4 w-4 mr-2" />Usuários
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate('/admin/duplicates')}>
                    <Shield className="h-4 w-4 mr-2" />Duplicatas
                  </DropdownMenuItem>
                )}
                {can('import_csv') && (
                  <DropdownMenuItem onClick={() => setCsvImporterOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />Importar CSV
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" />Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Mobile-only hamburger */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="md:hidden">
                <Button variant="outline" size="icon" aria-label="Menu" className="h-8 w-8">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-background z-50">
                {user?.email && (
                  <>
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground truncate">
                      {user.email}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => navigate('/pendencias')}>
                  <ListTodo className="h-4 w-4 mr-2" />Pendências
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/relatorios')}>
                  <BarChart3 className="h-4 w-4 mr-2" />Relatórios
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/perfil')}>
                  <UserCircle className="h-4 w-4 mr-2" />Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/templates')}>
                  <FileText className="h-4 w-4 mr-2" />Templates
                </DropdownMenuItem>
                {can('manage_library') && (
                  <DropdownMenuItem onClick={() => navigate('/library')}>
                    <BookOpen className="h-4 w-4 mr-2" />Biblioteca
                  </DropdownMenuItem>
                )}
                {(isAdmin || can('manage_users')) && (
                  <DropdownMenuItem onClick={() => navigate('/admin/users')}>
                    <Shield className="h-4 w-4 mr-2" />Usuários
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate('/admin/duplicates')}>
                    <Shield className="h-4 w-4 mr-2" />Duplicatas
                  </DropdownMenuItem>
                )}
                {can('import_csv') && (
                  <DropdownMenuItem onClick={() => setCsvImporterOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />Importar CSV
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" />Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-x-5 gap-y-1.5 flex-wrap mb-2">
          <div className="flex items-center gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Ativos:</span>
            <span className="font-semibold text-foreground">{activeFiltered.length}</span>
          </div>
          {canSeeFinancials && (
            <div className="hidden md:flex items-center gap-1.5 text-xs">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Pipeline:</span>
              <span className="font-semibold text-foreground">{formatCurrency(totalValue)}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Conversão:</span>
            <span className="font-semibold text-foreground">{conversionRate}%</span>
          </div>
          {lostCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Perdidos:</span>
              <span className="font-semibold text-destructive">{lostCount}</span>
            </div>
          )}
        </div>

        {(() => {
          const filterProps = {
            search, onSearchChange: setSearch,
            surgeon: surgeonFilter, onSurgeonChange: setSurgeonFilter,
            concierge: conciergeFilter, onConciergeChange: setConciergeFilter,
            procedure: procedureFilter, onProcedureChange: setProcedureFilter,
            patientType: patientTypeFilter, onPatientTypeChange: setPatientTypeFilter,
            surgicalApproach: surgicalApproachFilter, onSurgicalApproachChange: setSurgicalApproachFilter,
            payer: payerFilter, onPayerChange: setPayerFilter,
            billingType: billingTypeFilter, onBillingTypeChange: setBillingTypeFilter,
            hospital: hospitalFilter, onHospitalChange: setHospitalFilter,
            indicationSource: indicationSourceFilter, onIndicationSourceChange: setIndicationSourceFilter,
            indicationFrom, onIndicationFromChange: setIndicationFrom,
            indicationTo, onIndicationToChange: setIndicationTo,
            hasActiveFilters:
              !!search || surgeonFilter !== 'all' || conciergeFilter !== 'all' || procedureFilter !== 'all' ||
              patientTypeFilter !== 'all' || surgicalApproachFilter !== 'all' || payerFilter !== 'all' ||
              billingTypeFilter !== 'all' || hospitalFilter !== 'all' || indicationSourceFilter !== 'all' ||
              !!indicationFrom || !!indicationTo,
            onClearAll: () => {
              setSearch(''); setSurgeonFilter('all'); setConciergeFilter('all'); setProcedureFilter('all');
              setPatientTypeFilter('all'); setSurgicalApproachFilter('all'); setPayerFilter('all');
              setBillingTypeFilter('all'); setHospitalFilter('all'); setIndicationSourceFilter('all');
              setIndicationFrom(''); setIndicationTo('');
            },
          };
          return isMobile ? (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[160px]">
                <input
                  placeholder="Buscar paciente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <FilterSheet {...filterProps} />
              <ViewToggle mode={viewMode} onChange={setViewMode} />
              <SortControl sortKey={sortKey} sortDir={sortDir} onKeyChange={setSortKey} onDirChange={setSortDir} compact />
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <FilterBar {...filterProps} />
              </div>
              <div className="flex flex-col gap-1.5 shrink-0 pt-0.5">
                <ViewToggle mode={viewMode} onChange={setViewMode} />
                <SortControl sortKey={sortKey} sortDir={sortDir} onKeyChange={setSortKey} onDirChange={setSortDir} />
              </div>
            </div>
          );
        })()}


      </header>

      {/* Mobile briefing banner — replaces the auto-open dialog on phones */}
      {isMobile && isConcierge && conciergeName && (() => {
        const since = briefing.lastSeenAt ? new Date(briefing.lastSeenAt).getTime() : 0;
        const newCount = patients.filter(
          (p) => p.concierge === conciergeName && p.stage !== 'lost' && new Date(p.createdAt).getTime() > since,
        ).length;
        let breachedCount = 0;
        patients.forEach((p) => {
          if (p.stage === 'lost') return;
          const isMine = p.concierge === conciergeName;
          p.tasks.forEach((t) => {
            if (t.completed) return;
            const state = getTaskSlaState(t);
            if (state !== 'breached' && state !== 'escalated') return;
            if (t.responsible === conciergeName || isMine) breachedCount++;
          });
        });
        if (newCount === 0 && breachedCount === 0) return null;
        return (
          <button
            onClick={briefing.openManually}
            className="mx-3 mt-2 mb-1 shrink-0 flex items-center gap-2 rounded-md border border-pipeline-amber/40 bg-pipeline-amber/10 px-3 py-2 text-left text-xs text-pipeline-amber active:bg-pipeline-amber/20"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">
              {newCount > 0 && <><strong>{newCount}</strong> novo{newCount > 1 ? 's' : ''}</>}
              {newCount > 0 && breachedCount > 0 && ' · '}
              {breachedCount > 0 && <><strong>{breachedCount}</strong> tolerância{breachedCount > 1 ? 's' : ''} estourada{breachedCount > 1 ? 's' : ''}</>}
            </span>
            <span className="text-[10px] opacity-70">Ver detalhes →</span>
          </button>
        );
      })()}

      {viewMode === 'table' ? (
        <PatientsTable patients={filtered} onPatientClick={handlePatientClick} canSeeFinancials={canSeeFinancials} />
      ) : isMobile ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Stage tabs */}
          <div className="shrink-0 border-b border-border bg-background">
            <div className="flex items-center gap-1 px-2 overflow-x-auto no-scrollbar">
              {ALL_STAGES.map((stage) => {
                const count = filtered.filter((p) => p.stage === stage).length;
                const active = mobileStage === stage;
                const isLost = stage === 'lost';
                return (
                  <button
                    key={stage}
                    onClick={() => setMobileStage(stage)}
                    className={`shrink-0 px-2.5 py-2 text-[11px] font-medium uppercase tracking-wide border-b-2 transition-colors ${
                      active
                        ? isLost ? 'border-destructive text-destructive' : 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground'
                    }`}
                  >
                    {STAGE_LABELS[stage]}
                    <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] px-1 ${
                      active
                        ? isLost ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prev/Next quick nav */}
          <div className="shrink-0 flex items-center justify-between px-3 py-1.5 text-[11px] text-muted-foreground">
            <button
              className="flex items-center gap-1 disabled:opacity-30"
              disabled={ALL_STAGES.indexOf(mobileStage) === 0}
              onClick={() => {
                const i = ALL_STAGES.indexOf(mobileStage);
                if (i > 0) setMobileStage(ALL_STAGES[i - 1]);
              }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {ALL_STAGES.indexOf(mobileStage) > 0 ? STAGE_LABELS[ALL_STAGES[ALL_STAGES.indexOf(mobileStage) - 1]] : ''}
            </button>
            <button
              className="flex items-center gap-1 disabled:opacity-30"
              disabled={ALL_STAGES.indexOf(mobileStage) === ALL_STAGES.length - 1}
              onClick={() => {
                const i = ALL_STAGES.indexOf(mobileStage);
                if (i < ALL_STAGES.length - 1) setMobileStage(ALL_STAGES[i + 1]);
              }}
            >
              {ALL_STAGES.indexOf(mobileStage) < ALL_STAGES.length - 1 ? STAGE_LABELS[ALL_STAGES[ALL_STAGES.indexOf(mobileStage) + 1]] : ''}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Single column */}
          <div className="flex-1 overflow-y-auto px-3 pb-4">
            {(() => {
              const stagePatients = sortPatients(filtered.filter((p) => p.stage === mobileStage), sortKey, sortDir);
              return (
                <PipelineColumn
                  stage={mobileStage}
                  patients={stagePatients}
                  onPatientClick={handlePatientClick}
                  onCompleteTask={handleCompleteTask}
                  onDeletePatient={can('delete_patients') ? handleDeletePatient : undefined}
                  variant={mobileStage === 'lost' ? 'lost' : 'default'}
                  newSinceIso={briefing.lastSeenAt}
                  disableDnd
                  hideHeader
                  fullWidth
                />
              );
            })()}
          </div>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-auto">
            <div className="flex gap-4 p-6 min-h-full min-w-max">
              {ACTIVE_STAGES.map((stage) => {
                const stagePatients = sortPatients(filtered.filter((p) => p.stage === stage), sortKey, sortDir);
                return <PipelineColumn key={stage} stage={stage} patients={stagePatients} onPatientClick={handlePatientClick} onCompleteTask={handleCompleteTask} onDeletePatient={can('delete_patients') ? handleDeletePatient : undefined} newSinceIso={briefing.lastSeenAt} />;
              })}
              <PipelineColumn key="lost" stage="lost" patients={sortPatients(filtered.filter((p) => p.stage === 'lost'), sortKey, sortDir)} onPatientClick={handlePatientClick} onCompleteTask={handleCompleteTask} onDeletePatient={can('delete_patients') ? handleDeletePatient : undefined} variant="lost" newSinceIso={briefing.lastSeenAt} />
            </div>
          </div>
        </DragDropContext>
      )}

      <PatientPanel
        patient={selectedPatient}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onCompleteTask={handleCompleteTask}
        onAddTask={handleAddTask}
        onTogglePreOpItem={handleTogglePreOpItem}
        onUpdateFields={handleUpdateFields}
        onEditSurgeryDate={handleEditSurgeryDate}
        onChangeStage={changeStageManual}
      />
      <AddPatientForm open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAddPatient} />
      <AddTaskDialog open={addTaskOpen} onClose={() => setAddTaskOpen(false)} onAdd={handleTaskCreated} patientName={taskPatient?.name || ''} defaultResponsible={(taskPatient?.concierge || undefined) as any} />
      <LossReasonDialog open={lossDialogOpen} patientName={lossDialogPatient?.name || ''} onConfirm={handleLossConfirm} onCancel={handleLossCancel} />
      <SurgeryDateDialog
        open={surgeryDialogOpen}
        patientName={surgeryDialogPatient?.name || ''}
        initialDate={surgeryDialogPatient?.surgeryDate}
        initialTime={surgeryDialogPatient?.surgeryTime}
        title={editingSurgeryPatientId ? 'Alterar data da cirurgia' : 'Agendar cirurgia'}
        onConfirm={handleSurgeryDateConfirm}
        onCancel={handleSurgeryDateCancel}
      />
      <DeletePatientDialog open={deleteDialogOpen} patientName={deleteDialogPatient?.name || ''} onConfirm={handleDeleteConfirm} onCancel={handleDeleteCancel} />
      {isConcierge && conciergeName && (
        <ConciergeLoginBriefing
          open={briefing.open}
          onClose={briefing.close}
          conciergeName={conciergeName}
          patients={patients}
          lastSeenAt={briefing.lastSeenAt}
          onOpenPatient={handleNotificationClick}
        />
      )}
      <CsvImporter
        open={csvImporterOpen}
        onClose={() => setCsvImporterOpen(false)}
        existingPatientNames={patients.map(p => p.name)}
        onImport={async (patientsToImport, defaultSurgeon) => {
          await importPatientsMutation.mutateAsync({ patients: patientsToImport, defaultSurgeon });
        }}
      />
    </div>
  );
}
