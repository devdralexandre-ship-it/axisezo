import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PatientNote {
  id: string;
  patientId: string;
  body: string;
  authorUserId: string;
  authorName: string;
  forSurgeon: boolean;
  editedAt: string | null;
  createdAt: string;
}

/** Notas ficam editáveis pelo autor por 2 horas (mesma regra aplicada no banco). */
export const NOTE_EDIT_WINDOW_MS = 2 * 60 * 60 * 1000;

export function canEditNote(note: PatientNote, userId: string | null | undefined) {
  if (!userId || note.authorUserId !== userId) return false;
  return Date.now() - new Date(note.createdAt).getTime() < NOTE_EDIT_WINDOW_MS;
}

function mapNote(row: any): PatientNote {
  return {
    id: row.id,
    patientId: row.patient_id,
    body: row.body,
    authorUserId: row.author_user_id,
    authorName: row.author_name,
    forSurgeon: !!row.for_surgeon,
    editedAt: row.edited_at ?? null,
    createdAt: row.created_at,
  };
}

export function usePatientNotes(patientId: string | null | undefined) {
  return useQuery({
    queryKey: ['patient-notes', patientId],
    enabled: !!patientId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_notes')
        .select('id,patient_id,body,author_user_id,author_name,for_surgeon,edited_at,created_at')
        .eq('patient_id', patientId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapNote);
    },
  });
}

export function useAddPatientNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      body,
      forSurgeon,
      authorName,
    }: { patientId: string; body: string; forSurgeon: boolean; authorName: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Faça login novamente.');
      const { data, error } = await supabase
        .from('patient_notes')
        .insert({
          patient_id: patientId,
          body: body.trim(),
          for_surgeon: forSurgeon,
          author_user_id: user.id,
          author_name: authorName || user.email || 'Usuário',
        })
        .select('id,patient_id,body,author_user_id,author_name,for_surgeon,edited_at,created_at')
        .single();
      if (error) throw error;
      return mapNote(data);
    },
    onSuccess: (note) => {
      qc.setQueryData(['patient-notes', note.patientId], (old: PatientNote[] | undefined) =>
        old ? [note, ...old] : [note]
      );
      qc.invalidateQueries({ queryKey: ['patients'], refetchType: 'active' });
      toast.success('Nota registrada');
    },
    onError: (e: any) => toast.error(`Não foi possível salvar a nota: ${e?.message ?? e}`),
  });
}

export function useUpdatePatientNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patientId, body, forSurgeon }: { id: string; patientId: string; body: string; forSurgeon: boolean }) => {
      const { data, error } = await supabase
        .from('patient_notes')
        .update({ body: body.trim(), for_surgeon: forSurgeon })
        .eq('id', id)
        .select('id,patient_id,body,author_user_id,author_name,for_surgeon,edited_at,created_at')
        .single();
      if (error) throw error;
      return mapNote(data);
    },
    onSuccess: (note) => {
      qc.setQueryData(['patient-notes', note.patientId], (old: PatientNote[] | undefined) =>
        (old ?? []).map((n) => (n.id === note.id ? note : n))
      );
      toast.success('Nota atualizada');
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? e);
      if (msg.includes('2 horas') || msg.includes('prazo')) {
        toast.error('O prazo de 2 horas para editar esta nota expirou.');
      } else {
        toast.error(`Não foi possível editar a nota: ${msg}`);
      }
    },
  });
}
