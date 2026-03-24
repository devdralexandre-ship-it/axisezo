import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Patient, PatientTask, ContactRecord, PreOpChecklist, PreOpChecklistItem, PREOP_CHECKLIST_ITEMS, DEFAULT_PREOP_CHECKLIST, PipelineStage, DecisionStatus, Owner, LossReason } from '@/data/types';
import { toast } from 'sonner';

type DbPatient = Awaited<ReturnType<typeof fetchPatients>>[number];

async function fetchPatients() {
  const { data, error } = await supabase
    .from('patients')
    .select(`
      *,
      tasks(*),
      contact_records(*),
      preop_checklist_items(*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

function mapDbToPatient(db: DbPatient): Patient {
  const checklistItems = db.preop_checklist_items || [];
  const preOpChecklist: PreOpChecklist = { ...DEFAULT_PREOP_CHECKLIST };
  checklistItems.forEach((item: any) => {
    if (PREOP_CHECKLIST_ITEMS.includes(item.item_key as PreOpChecklistItem)) {
      preOpChecklist[item.item_key as PreOpChecklistItem] = item.checked;
    }
  });

  const tasks: PatientTask[] = (db.tasks || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    dueDate: t.due_date,
    dueTime: t.due_time?.substring(0, 5) || '10:00',
    responsible: t.responsible as Owner,
    completed: t.completed,
    completedAt: t.completed_at,
    createdAt: t.created_at?.split('T')[0] || '',
  }));

  const contacts: ContactRecord[] = (db.contact_records || []).map((c: any) => ({
    id: c.id,
    date: c.contact_date,
    type: c.type,
    note: c.note,
    by: c.by_whom,
  }));

  return {
    id: db.id,
    name: db.name,
    procedure: db.procedure_name,
    procedureCategory: db.procedure_category || '',
    surgeon: db.surgeon,
    concierge: db.concierge,
    owner: db.owner as Owner,
    stage: db.stage as PipelineStage,
    stageEnteredAt: db.stage_entered_at,
    decisionStatus: db.decision_status as DecisionStatus,
    estimatedValue: db.estimated_value ? Number(db.estimated_value) : null,
    lastInteractionDate: db.last_interaction_date,
    nextFollowUpDate: db.next_follow_up_date,
    phone: db.phone || '',
    email: db.email || '',
    contacts,
    tasks,
    createdAt: db.created_at?.split('T')[0] || '',
    indicationDate: db.indication_date,
    indicationLocation: db.indication_location,
    payer: db.payer,
    contactReference: db.contact_reference,
    desiredHospital: db.desired_hospital,
    notes: db.notes,
    lossReason: db.loss_reason as LossReason | null,
    lossReasonDetail: db.loss_reason_detail,
    specialFlag: db.special_flag,
    preOpChecklist,
  };
}

export function usePatients() {
  return useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const data = await fetchPatients();
      return data.map(mapDbToPatient);
    },
  });
}

export function useAddPatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Omit<Patient, 'id' | 'tasks' | 'contacts' | 'preOpChecklist'>) => {
      const { data, error } = await supabase.from('patients').insert({
        name: p.name,
        procedure_name: p.procedure,
        procedure_category: p.procedureCategory,
        surgeon: p.surgeon,
        concierge: p.concierge,
        owner: p.owner,
        stage: p.stage as any,
        stage_entered_at: p.stageEnteredAt,
        decision_status: p.decisionStatus as any,
        estimated_value: p.estimatedValue,
        last_interaction_date: p.lastInteractionDate,
        next_follow_up_date: p.nextFollowUpDate,
        phone: p.phone,
        email: p.email,
        indication_date: p.indicationDate,
        indication_location: p.indicationLocation,
        payer: p.payer,
        contact_reference: p.contactReference,
        desired_hospital: p.desiredHospital,
        notes: p.notes,
        special_flag: p.specialFlag,
      }).select().single();
      if (error) throw error;

      // Create initial contact record
      if (p.concierge) {
        await supabase.from('contact_records').insert({
          patient_id: data.id,
          contact_date: p.stageEnteredAt,
          type: 'phone' as any,
          note: 'Cadastro inicial no sistema.',
          by_whom: p.concierge,
        });
      }

      // Create default preop checklist items
      const checklistInserts = PREOP_CHECKLIST_ITEMS.map((key) => ({
        patient_id: data.id,
        item_key: key,
        checked: false,
      }));
      await supabase.from('preop_checklist_items').insert(checklistInserts);

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] });
      toast.success('Paciente adicionado!');
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

export function useUpdatePatientStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage, lossReason, lossReasonDetail }: {
      id: string; stage: PipelineStage; lossReason?: LossReason | null; lossReasonDetail?: string | null;
    }) => {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('patients').update({
        stage: stage as any,
        stage_entered_at: today,
        loss_reason: (lossReason || null) as any,
        loss_reason_detail: lossReasonDetail || null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patients'] }),
  });
}

export function useUpdatePatientField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const { error } = await supabase.from('patients').update({ [field]: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patients'] }),
  });
}

export function useAddTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ patientId, task }: { patientId: string; task: PatientTask }) => {
      const { error } = await supabase.from('tasks').insert({
        patient_id: patientId,
        title: task.title,
        due_date: task.dueDate,
        due_time: task.dueTime + ':00',
        responsible: task.responsible,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] });
      toast.success('Tarefa criada!');
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('tasks').update({
        completed: true,
        completed_at: today,
      }).eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] });
      toast.success('Tarefa concluída!');
    },
  });
}

export function useTogglePreOpItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ patientId, itemKey, checked }: { patientId: string; itemKey: string; checked: boolean }) => {
      const { error } = await supabase.from('preop_checklist_items').update({
        checked,
      }).eq('patient_id', patientId).eq('item_key', itemKey);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patients'] }),
  });
}
