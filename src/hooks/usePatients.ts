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
    slaHours: t.sla_hours ?? 24,
    slaDueAt: t.sla_due_at ?? null,
    slaBreachedAt: t.sla_breached_at ?? null,
    escalateAfterHours: t.escalate_after_hours ?? 24,
    escalatedAt: t.escalated_at ?? null,
    escalatedTo: t.escalated_to ?? null,
    escalationReason: t.escalation_reason ?? null,
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
    laterality: (db as any).laterality || null,
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
    responsibleContact: (db as any).responsible_contact || null,
    desiredHospital: db.desired_hospital,
    notes: db.notes,
    alerts: (db as any).alerts || null,
    lossReason: db.loss_reason as LossReason | null,
    lossReasonDetail: db.loss_reason_detail,
    anesthesiaFees: (db as any).anesthesia_fees != null ? Number((db as any).anesthesia_fees) : null,
    hospitalBudget: (db as any).hospital_budget != null ? Number((db as any).hospital_budget) : null,
    materialsCost: (db as any).materials_cost != null ? Number((db as any).materials_cost) : null,
    preOpChecklist,
    procedureCodes: ((db as any).procedure_codes && typeof (db as any).procedure_codes === 'object')
      ? { main: (db as any).procedure_codes.main ?? null, extras: Array.isArray((db as any).procedure_codes.extras) ? (db as any).procedure_codes.extras : [] }
      : { main: null, extras: [] },
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
    mutationFn: async (p: Partial<Patient> & { name: string; procedure: string; surgeon: string; initialTasks?: { title: string; dueDate: string; dueTime: string; responsible: string }[] }) => {
      // Defense in depth: auto-fill concierge/surgeon from the current user's profile
      // so RLS (which requires concierge = current_concierge_name() / surgeon = current_surgeon_name())
      // doesn't fail when the form leaves them empty.
      let conciergeName = p.concierge || '';
      let surgeonName = p.surgeon || '';
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('concierge_name, surgeon_name')
            .eq('user_id', user.id)
            .maybeSingle();
          if (!conciergeName && prof?.concierge_name) conciergeName = prof.concierge_name;
          if (!surgeonName && prof?.surgeon_name) surgeonName = prof.surgeon_name;
        }
      } catch { /* ignore */ }

      const { data, error } = await supabase.from('patients').insert({
        name: p.name,
        procedure_name: p.procedure,
        procedure_category: p.procedureCategory || '',
        surgeon: surgeonName,
        concierge: conciergeName,
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
        responsible_contact: p.responsibleContact,
        desired_hospital: p.desiredHospital,
        notes: p.notes,
        age: p.age,
        patient_type: p.patientType || 'adult',
        billing_type: p.billingType,
        medical_fees: p.medicalFees,
        anesthesia_fees: p.anesthesiaFees,
        hospital_budget: p.hospitalBudget,
        materials_cost: p.materialsCost,
        alerts: p.alerts,
        surgical_approach: p.surgicalApproach,
        laterality: (p as any).laterality || null,
        procedure_codes: p.procedureCodes ?? { main: null, extras: [] },
      } as any).select().single();
      if (error) throw error;

      const checklistInserts = PREOP_CHECKLIST_ITEMS.map((key) => ({
        patient_id: data.id,
        item_key: key,
        checked: false,
      }));
      await supabase.from('preop_checklist_items').insert(checklistInserts);

      if (p.initialTasks && p.initialTasks.length > 0) {
        const taskInserts = p.initialTasks.map((t) => ({
          patient_id: data.id,
          title: t.title,
          due_date: t.dueDate,
          due_time: t.dueTime + ':00',
          responsible: t.responsible,
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
    onSuccess: () => {},
    onError: () => {
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
        sla_hours: task.slaHours ?? 24,
        escalate_after_hours: task.escalateAfterHours ?? 24,
      } as any);
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

export function useImportPatients() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ patients, defaultSurgeon }: {
      defaultSurgeon: string;
      patients: Array<{
        name: string;
        phone: string;
        procedure: string;
        indicationLocation: string;
        payer: string;
        desiredHospital: string;
        notes: string;
        stage: PipelineStage;
        entryDate?: string;
        initialTask: { title: string; dueDate: string; dueTime: string; responsible: string };
      }>;
    }) => {
      const today = new Date().toISOString().split('T')[0];
      let imported = 0;
      for (const p of patients) {
        // Parse entry date from CSV
        let resolvedDate = today;
        if (p.entryDate) {
          // Try common date formats: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, or timestamp strings
          const raw = p.entryDate.trim();
          const slashParts = raw.split('/');
          if (slashParts.length === 3) {
            // DD/MM/YYYY
            const [d, m, y] = slashParts;
            const parsed = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00`);
            if (!isNaN(parsed.getTime())) resolvedDate = parsed.toISOString().split('T')[0];
          } else {
            const parsed = new Date(raw);
            if (!isNaN(parsed.getTime())) resolvedDate = parsed.toISOString().split('T')[0];
          }
        }

        const { data, error } = await supabase.from('patients').insert({
          name: p.name,
          procedure_name: p.procedure,
          procedure_category: '',
          surgeon: defaultSurgeon,
          concierge: '',
          owner: 'Call Center',
          stage: p.stage as any,
          stage_entered_at: resolvedDate,
          decision_status: 'waiting' as any,
          last_interaction_date: resolvedDate,
          indication_date: resolvedDate,
          phone: p.phone || '',
          email: '',
          indication_location: p.indicationLocation || null,
          payer: p.payer || null,
          desired_hospital: p.desiredHospital || null,
          notes: p.notes || null,
        } as any).select().single();
        if (error) continue;

        const checklistInserts = PREOP_CHECKLIST_ITEMS.map((key) => ({
          patient_id: data.id,
          item_key: key,
          checked: false,
        }));
        await supabase.from('preop_checklist_items').insert(checklistInserts);

        await supabase.from('tasks').insert({
          patient_id: data.id,
          title: p.initialTask.title,
          due_date: p.initialTask.dueDate,
          due_time: p.initialTask.dueTime + ':00',
          responsible: p.initialTask.responsible,
          completed: false,
        });
        imported++;
      }
      return imported;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['patients'] });
      toast.success(`${count} paciente(s) importado(s) com sucesso!`);
    },
    onError: (e) => toast.error(`Erro na importação: ${e.message}`),
  });
}
