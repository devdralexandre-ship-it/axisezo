import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Patient, PatientTask, ContactRecord, PreOpChecklist, PreOpChecklistItem, PREOP_CHECKLIST_ITEMS, DEFAULT_PREOP_CHECKLIST, PipelineStage, DecisionStatus, Owner, LossReason, PendingItem } from '@/data/types';
import { toast } from 'sonner';

type DbPatient = Awaited<ReturnType<typeof fetchPatients>>[number];

async function fetchPatients() {
  const { data, error } = await supabase
    .from('patients')
    .select(`
      *,
      tasks(*),
      contact_records(*),
      preop_checklist_items(*),
      pending_items(*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

function mapDbToPatient(db: DbPatient): Patient {
  const checklistItems = (db as any).preop_checklist_items || [];
  const preOpChecklist: PreOpChecklist = { ...DEFAULT_PREOP_CHECKLIST };
  checklistItems.forEach((item: any) => {
    if (PREOP_CHECKLIST_ITEMS.includes(item.item_key as PreOpChecklistItem)) {
      preOpChecklist[item.item_key as PreOpChecklistItem] = item.checked;
    }
  });

  const tasks: PatientTask[] = ((db as any).tasks || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    dueDate: t.due_date,
    dueTime: t.due_time?.substring(0, 5) || '10:00',
    responsible: t.responsible as Owner,
    completed: t.completed,
    completedAt: t.completed_at,
    createdAt: t.created_at?.split('T')[0] || '',
  }));

  const contacts: ContactRecord[] = ((db as any).contact_records || []).map((c: any) => ({
    id: c.id,
    date: c.contact_date,
    type: c.type,
    note: c.note,
    by: c.by_whom,
  }));

  const pendingItems: PendingItem[] = ((db as any).pending_items || []).map((p: any) => ({
    id: p.id,
    title: p.title,
    checked: p.checked,
  }));

  return {
    id: db.id,
    name: db.name,
    age: (db as any).age ?? null,
    patientType: (db as any).patient_type || 'adult',
    procedure: db.procedure_name,
    procedureCategory: db.procedure_category || '',
    surgicalApproach: (db as any).surgical_approach || null,
    surgeon: db.surgeon,
    concierge: db.concierge,
    owner: db.owner as Owner,
    stage: db.stage as PipelineStage,
    stageEnteredAt: db.stage_entered_at,
    decisionStatus: db.decision_status as DecisionStatus,
    estimatedValue: db.estimated_value != null ? Number(db.estimated_value) : null,
    lastInteractionDate: db.last_interaction_date,
    nextFollowUpDate: db.next_follow_up_date,
    phone: db.phone || '',
    email: db.email || '',
    contacts,
    tasks,
    pendingItems,
    createdAt: db.created_at?.split('T')[0] || '',
    indicationDate: db.indication_date,
    indicationLocation: db.indication_location,
    payer: db.payer,
    billingType: (db as any).billing_type || null,
    medicalFees: (db as any).medical_fees != null ? Number((db as any).medical_fees) : null,
    contactReference: db.contact_reference,
    desiredHospital: db.desired_hospital,
    notes: db.notes,
    alerts: (db as any).alerts || null,
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
    mutationFn: async (p: Partial<Patient> & { name: string; procedure: string; surgeon: string; initialTaskTitles?: string[] }) => {
      const { data, error } = await supabase.from('patients').insert({
        name: p.name,
        procedure_name: p.procedure,
        procedure_category: p.procedureCategory || '',
        surgeon: p.surgeon,
        concierge: p.concierge || '',
        owner: p.owner || 'Call Center',
        stage: (p.stage || 'indication') as any,
        stage_entered_at: p.stageEnteredAt || new Date().toISOString().split('T')[0],
        decision_status: (p.decisionStatus || 'waiting') as any,
        estimated_value: p.estimatedValue,
        last_interaction_date: p.lastInteractionDate || new Date().toISOString().split('T')[0],
        next_follow_up_date: p.nextFollowUpDate,
        phone: p.phone || '',
        email: p.email || '',
        indication_date: p.indicationDate,
        indication_location: p.indicationLocation,
        payer: p.payer,
        contact_reference: p.contactReference,
        desired_hospital: p.desiredHospital,
        notes: p.notes,
        special_flag: p.specialFlag,
        age: p.age,
        patient_type: p.patientType || 'adult',
        billing_type: p.billingType,
        medical_fees: p.medicalFees,
        alerts: p.alerts,
        surgical_approach: p.surgicalApproach,
      } as any).select().single();
      if (error) throw error;

      const checklistInserts = PREOP_CHECKLIST_ITEMS.map((key) => ({
        patient_id: data.id,
        item_key: key,
        checked: false,
      }));
      await supabase.from('preop_checklist_items').insert(checklistInserts);

      if (p.initialTaskTitles && p.initialTaskTitles.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const taskInserts = p.initialTaskTitles.map((title) => ({
          patient_id: data.id,
          title,
          due_date: today,
          due_time: '10:00:00',
          responsible: 'Margô',
          completed: false,
        }));
        await supabase.from('tasks').insert(taskInserts);
      }

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
    // BUG 2 FIX: Do NOT auto-invalidate here. The call site (PipelineDashboard)
    // handles optimistic updates and error recovery. Auto-invalidation here
    // causes race conditions when other mutations (like addPatient) also invalidate.
    onSuccess: () => {
      // Intentionally empty - call site handles cache
    },
    onError: () => {
      // Revert handled at call site; just refetch to be safe
      qc.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useUpdatePatientField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const { error } = await supabase.from('patients').update({ [field]: value } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patients'] }),
  });
}

export function useUpdatePatientFields() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Record<string, any> }) => {
      const { error } = await supabase.from('patients').update(fields as any).eq('id', id);
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
      toast.success('Ação criada!');
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
      toast.success('Ação concluída!');
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

export function useAddPendingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ patientId, title }: { patientId: string; title: string }) => {
      const { error } = await supabase.from('pending_items' as any).insert({
        patient_id: patientId,
        title,
        checked: false,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patients'] }),
  });
}

export function useTogglePendingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase.from('pending_items' as any).update({ checked }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patients'] }),
  });
}

export function useDeletePendingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pending_items' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patients'] }),
  });
}

export function useDeletePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete related records first
      await supabase.from('tasks').delete().eq('patient_id', id);
      await supabase.from('contact_records').delete().eq('patient_id', id);
      await supabase.from('preop_checklist_items').delete().eq('patient_id', id);
      await supabase.from('pending_items' as any).delete().eq('patient_id', id);
      const { error } = await supabase.from('patients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] });
      toast.success('Paciente excluído!');
    },
    onError: (e) => toast.error(`Erro ao excluir: ${e.message}`),
  });
}
