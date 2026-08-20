import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePatients, useCompleteTask, useUpdatePatientFields } from '@/hooks/usePatients';
import { useRealtimePatients } from '@/hooks/useRealtimePatients';
import { useUserRole } from '@/hooks/useUserRole';
import { Patient, PatientTask, PIPELINE_STAGES, PipelineStage, STAGE_LABELS, getTaskSlaState, formatSlaChip } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Check, Star, AlertTriangle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { useAddTask } from '@/hooks/usePatients';
import { normalizeText } from '@/lib/utils';

type Bucket = 'breached' | 'today' | 'week' | 'future';

interface Row {
  patient: Patient;
  task: PatientTask;
  bucket: Bucket;
  dueMs: number;
}

const BUCKET_META: Record<Bucket, { label: string; tone: string }> = {
  breached: { label: 'Estouradas / Escaladas', tone: 'border-destructive/50 bg-destructive/5' },
  today: { label: 'Hoje', tone: 'border-pipeline-amber/50 bg-pipeline-amber/5' },
  week: { label: 'Esta semana', tone: 'border-primary/30 bg-primary/5' },
  future: { label: 'Futuras', tone: 'border-border bg-muted/30' },
};

function bucketOf(task: PatientTask): Bucket {
  const state = getTaskSlaState(task);
  if (state === 'breached' || state === 'escalated') return 'breached';
  const now = new Date();
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tomorrow0 = today0 + 86400000;
  const weekEnd = today0 + 7 * 86400000;
  const due = new Date(`${task.dueDate}T${task.dueTime}`).getTime();
  if (due < tomorrow0) return 'today';
  if (due < weekEnd) return 'week';
  return 'future';
}

export default function Pendencias() {
  useRealtimePatients();
  const navigate = useNavigate();
  const { data: patients = [], isLoading } = usePatients();
  const completeMutation = useCompleteTask();
  const addTaskMutation = useAddTask();
  const updateFields = useUpdatePatientFields();
  const { conciergeName } = useUserRole();

  const [search, setSearch] = useState('');
  const [conciergeFilter, setConciergeFilter] = useState<string>(conciergeName || 'all');
  const [surgeonFilter, setSurgeonFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [nextTaskFor, setNextTaskFor] = useState<{ patientId: string; name: string; concierge: string } | null>(null);

  const surgeons = useMemo(() => [...new Set(patients.map(p => p.surgeon).filter(Boolean))].sort(), [patients]);
  const concierges = useMemo(() => [...new Set(patients.map(p => p.concierge).filter(Boolean))].sort(), [patients]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    patients.forEach((p) => {
      if (p.stage === 'lost' || p.stage === 'surgery_completed') return;
      if (conciergeFilter !== 'all' && p.concierge !== conciergeFilter) return;
      if (surgeonFilter !== 'all' && p.surgeon !== surgeonFilter) return;
      if (stageFilter !== 'all' && p.stage !== stageFilter) return;
      if (search && !normalizeText(p.name).includes(normalizeText(search))) return;
      p.tasks.forEach((t) => {
        if (t.completed) return;
        out.push({ patient: p, task: t, bucket: bucketOf(t), dueMs: new Date(`${t.dueDate}T${t.dueTime}`).getTime() });
      });
    });
    return out.sort((a, b) => a.dueMs - b.dueMs);
  }, [patients, search, conciergeFilter, surgeonFilter, stageFilter]);

  const grouped: Record<Bucket, Row[]> = { breached: [], today: [], week: [], future: [] };
  rows.forEach((r) => grouped[r.bucket].push(r));

  const totalOpen = rows.length;

  const handleComplete = (row: Row) => {
    completeMutation.mutate(row.task.id, {
      onSuccess: () => {
        setNextTaskFor({ patientId: row.patient.id, name: row.patient.name, concierge: row.patient.concierge });
      },
    });
  };

  const handleChangeStage = (patient: Patient, newStage: PipelineStage) => {
    if (newStage === patient.stage) return;
    if (newStage === 'lost' || newStage === 'surgery_scheduled') {
      toast.info('Abra o paciente para concluir esta mudança de estágio.');
      navigate('/');
      return;
    }
    updateFields.mutate(
      { id: patient.id, fields: { stage: newStage, stage_entered_at: new Date().toISOString().split('T')[0] } },
      { onSuccess: () => toast.success(`${patient.name}: ${STAGE_LABELS[newStage]}`) },
    );
  };

  const toggleFlag = (patient: Patient, field: 'clinically_sensitive' | 'high_risk' | 'high_ticket') => {
    const current = field === 'clinically_sensitive' ? patient.clinicallySensitive
      : field === 'high_risk' ? patient.highRisk : patient.highTicket;
    updateFields.mutate({ id: patient.id, fields: { [field]: !current } });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 md:px-6 py-3">
        <div className="flex items-center gap-3 mb-3">
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="h-4 w-4" />Kanban</Link></Button>
          <h1 className="text-lg font-semibold">Central de Pendências</h1>
          <Badge variant="secondary" className="ml-auto">{totalOpen} abertas</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            placeholder="Buscar paciente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm flex-1 min-w-[160px] max-w-xs"
          />
          <Select value={conciergeFilter} onValueChange={setConciergeFilter}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Concierge" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos concierges</SelectItem>
              {concierges.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={surgeonFilter} onValueChange={setSurgeonFilter}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Cirurgião" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos cirurgiões</SelectItem>
              {surgeons.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="h-9 w-[190px]"><SelectValue placeholder="Estágio" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos estágios</SelectItem>
              {PIPELINE_STAGES.filter(s => s !== 'lost' && s !== 'surgery_completed').map((s) => (
                <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="px-4 md:px-6 py-4 space-y-6 max-w-5xl mx-auto">
        {isLoading && <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>}
        {!isLoading && totalOpen === 0 && (
          <div className="text-center py-16 text-muted-foreground">Nenhuma pendência encontrada com esses filtros.</div>
        )}
        {(['breached', 'today', 'week', 'future'] as Bucket[]).map((b) => {
          const list = grouped[b];
          if (list.length === 0) return null;
          const meta = BUCKET_META[b];
          return (
            <section key={b}>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide">{meta.label}</h2>
                <Badge variant="outline">{list.length}</Badge>
              </div>
              <div className="space-y-2">
                {list.map(({ patient, task }) => {
                  const chip = formatSlaChip(task);
                  return (
                    <Card key={task.id} className={`border-l-4 ${meta.tone} p-3`}>
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <button
                              onClick={() => navigate(`/?patient=${patient.id}`)}
                              className="text-sm font-semibold hover:underline"
                            >{patient.name}</button>
                            <Badge variant="outline" className="text-[10px]">{STAGE_LABELS[patient.stage]}</Badge>
                            {patient.clinicallySensitive && <span title="Clinicamente sensível" className="text-destructive font-bold">*</span>}
                            {patient.highRisk && <span title="Altíssimo risco" className="text-destructive font-bold">**</span>}
                            {patient.highTicket && <Star className="h-3 w-3 fill-pipeline-amber text-pipeline-amber" />}
                            {!!patient.notesCount && (
                              <span
                                className="flex items-center gap-0.5 text-[11px] text-muted-foreground"
                                title={
                                  patient.latestNote
                                    ? `${patient.latestNote.authorName} · ${new Date(patient.latestNote.createdAt).toLocaleDateString('pt-BR')}: ${patient.latestNote.body}`
                                    : `${patient.notesCount} nota(s) da concierge`
                                }
                              >
                                <MessageSquare className="h-3 w-3" />
                                {patient.notesCount}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-foreground">{task.title}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                            <span>Resp: {task.responsible}</span>
                            <span>·</span>
                            <span>{task.dueDate} {task.dueTime}</span>
                            <span>·</span>
                            <Badge variant={chip.tone === 'breached' || chip.tone === 'escalated' ? 'destructive' : 'secondary'} className="text-[10px]">
                              {chip.tone === 'breached' && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                              {chip.label}
                            </Badge>
                            {patient.phone && (
                              <a href={`tel:${patient.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                                <Phone className="h-3 w-3" />{patient.phone}
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Button
                            variant="ghost" size="sm" className="h-8 text-[11px]"
                            title="Sensível"
                            onClick={() => toggleFlag(patient, 'clinically_sensitive')}
                          >{patient.clinicallySensitive ? '✓ *' : '*'}</Button>
                          <Button
                            variant="ghost" size="sm" className="h-8 text-[11px]"
                            title="Alto risco"
                            onClick={() => toggleFlag(patient, 'high_risk')}
                          >{patient.highRisk ? '✓ **' : '**'}</Button>
                          <Button
                            variant="ghost" size="sm" className="h-8 text-[11px]"
                            title="Alto ticket"
                            onClick={() => toggleFlag(patient, 'high_ticket')}
                          >{patient.highTicket ? '✓ ★' : '★'}</Button>
                          <Select value={patient.stage} onValueChange={(v) => handleChangeStage(patient, v as PipelineStage)}>
                            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PIPELINE_STAGES.map((s) => (
                                <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm" className="h-8"
                            onClick={() => handleComplete({ patient, task, bucket: b, dueMs: 0 })}
                          ><Check className="h-3.5 w-3.5" />Concluir</Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      <AddTaskDialog
        open={!!nextTaskFor}
        onClose={() => setNextTaskFor(null)}
        onAdd={(task) => {
          if (nextTaskFor) addTaskMutation.mutate({ patientId: nextTaskFor.patientId, task });
          setNextTaskFor(null);
        }}
        patientName={nextTaskFor?.name || ''}
        defaultResponsible={nextTaskFor?.concierge as any}
      />
    </div>
  );
}
