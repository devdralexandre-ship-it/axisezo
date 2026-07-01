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
import { Plus, Users, DollarSign, TrendingUp, LogOut, Upload, FileText, Shield, UserCircle, BookOpen, Menu } from 'lucide-react';
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
import { useQueryClient } from '@tanstack/react-query';
import { useRealtimePatients } from '@/hooks/useRealtimePatients';
import { ConciergeLoginBriefing, useConciergeBriefing } from './ConciergeLoginBriefing';
import { useIsMobile } from '@/hooks/use-mobile';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

const ACTIVE_STAGES = PIPELINE_STAGES.filter((s) => s !== 'lost') as PipelineStage[];

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
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.procedure.toLowerCase().includes(search.toLowerCase())) return false;
      if (surgeonFilter !== 'all' && p.surgeon !== surgeonFilter) return false;
      if (conciergeFilter !== 'all' && p.concierge !== conciergeFilter) return false;
      if (procedureFilter !== 'all' && p.procedure !== procedureFilter) return false;
      if (patientTypeFilter !== 'all' && p.patientType !== patientTypeFilter) return false;
      if (surgicalApproachFilter !== 'all' && p.surgicalApproach !== surgicalApproachFilter) return false;
      if (slaFilter !== 'all') {
        const states = p.tasks.filter(t => !t.completed).map(getTaskSlaState);
        if (slaFilter === 'breached' && !states.some(s => s === 'breached' || s === 'escalated')) return false;
        if (slaFilter === 'escalated' && !states.includes('escalated')) return false;
      }
      return true;
    });
  }, [patients, search, surgeonFilter, conciergeFilter, procedureFilter, patientTypeFilter, surgicalApproachFilter, slaFilter]);

  const activeFiltered = filtered.filter((p) => p.stage !== 'lost');
  // BUG 1 FIX: Use estimatedValue OR medicalFees as fallback for pipeline total
  const totalValue = useMemo(() => activeFiltered.reduce((s, p) => s + (p.estimatedValue ?? p.medicalFees ?? 0), 0), [activeFiltered]);
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
      <header className="border-b border-border px-4 md:px-6 py-3 md:py-4 shrink-0 bg-background">
        <div className="flex items-center justify-between gap-2 mb-3 md:mb-4">
          <div className="min-w-0">
            <h1 className="leading-none flex items-baseline">
              <span className="font-serif text-2xl font-semibold text-primary tracking-wide">EZO</span>
              <span className="ml-2 font-sans text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Urologia</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 hidden md:block">Pipeline de decisão cirúrgica</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden lg:inline">{user?.email}</span>
            <NotificationBell
              notifications={notifications}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllRead}
              onClickNotification={handleNotificationClick}
              autoOpenKey={user?.id}
            />
            {/* Desktop-only buttons */}
            <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
              <Link to="/perfil"><UserCircle className="h-4 w-4" />Perfil</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
              <Link to="/templates"><FileText className="h-4 w-4" />Templates</Link>
            </Button>
            {can('manage_library') && (
              <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
                <Link to="/library"><BookOpen className="h-4 w-4" />Biblioteca</Link>
              </Button>
            )}
            {(isAdmin || can('manage_users')) && (
              <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
                <Link to="/admin/users"><Shield className="h-4 w-4" />Usuários</Link>
              </Button>
            )}
            {can('import_csv') && (
              <Button variant="outline" size="sm" onClick={() => setCsvImporterOpen(true)} className="hidden md:inline-flex">
                <Upload className="h-4 w-4" />
                Importar CSV
              </Button>
            )}
            {/* Always visible: Add patient */}
            <Button onClick={() => setAddOpen(true)} size="sm">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Paciente</span>
              <span className="sm:hidden">Novo</span>
            </Button>
            {/* Desktop-only logout */}
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair" className="hidden md:inline-flex">
              <LogOut className="h-4 w-4" />
            </Button>
            {/* Mobile-only hamburger */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="md:hidden">
                <Button variant="outline" size="icon" aria-label="Menu">
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

        <div className="flex items-center gap-x-6 gap-y-2 flex-wrap mb-3 md:mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Ativos:</span>
            <span className="font-semibold text-foreground">{activeFiltered.length}</span>
          </div>
          {canSeeFinancials && (
            <div className="hidden md:flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Pipeline:</span>
              <span className="font-semibold text-foreground">{formatCurrency(totalValue)}</span>
            </div>
          )}
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
          <div className="md:ml-auto flex items-center gap-1 flex-wrap w-full md:w-auto">
            <Button
              variant={slaFilter === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSlaFilter('all')}
            >
              Todos
            </Button>
            <Button
              variant={slaFilter === 'breached' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSlaFilter('breached')}
            >
              ⏰ SLA estourado
            </Button>
            <Button
              variant={slaFilter === 'escalated' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSlaFilter('escalated')}
            >
              🚨 Escaladas
            </Button>
          </div>
        </div>

        <FilterBar
          search={search} onSearchChange={setSearch}
          surgeon={surgeonFilter} onSurgeonChange={setSurgeonFilter}
          concierge={conciergeFilter} onConciergeChange={setConciergeFilter}
          procedure={procedureFilter} onProcedureChange={setProcedureFilter}
          patientType={patientTypeFilter} onPatientTypeChange={setPatientTypeFilter}
          surgicalApproach={surgicalApproachFilter} onSurgicalApproachChange={setSurgicalApproachFilter}
        />
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

      {isMobile ? (
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
              const stagePatients = filtered
                .filter((p) => p.stage === mobileStage)
                .sort((a, b) => new Date(a.indicationDate || a.createdAt || '9999-12-31').getTime() - new Date(b.indicationDate || b.createdAt || '9999-12-31').getTime());
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
                const stagePatients = filtered.filter((p) => p.stage === stage).sort((a, b) => {
                  const dateA = new Date(a.indicationDate || a.createdAt || '9999-12-31').getTime();
                  const dateB = new Date(b.indicationDate || b.createdAt || '9999-12-31').getTime();
                  return dateA - dateB;
                });
                return <PipelineColumn key={stage} stage={stage} patients={stagePatients} onPatientClick={handlePatientClick} onCompleteTask={handleCompleteTask} onDeletePatient={can('delete_patients') ? handleDeletePatient : undefined} newSinceIso={briefing.lastSeenAt} />;
              })}
              <PipelineColumn key="lost" stage="lost" patients={filtered.filter((p) => p.stage === 'lost').sort((a, b) => new Date(a.indicationDate || a.createdAt || '9999-12-31').getTime() - new Date(b.indicationDate || b.createdAt || '9999-12-31').getTime())} onPatientClick={handlePatientClick} onCompleteTask={handleCompleteTask} onDeletePatient={can('delete_patients') ? handleDeletePatient : undefined} variant="lost" newSinceIso={briefing.lastSeenAt} />
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
