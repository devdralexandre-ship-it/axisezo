import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const UPLOAD_CATEGORIES = [
  { value: 'rg', label: 'RG / Documento' },
  { value: 'exame', label: 'Exame' },
  { value: 'laudo', label: 'Laudo' },
  { value: 'autorizacao', label: 'Autorização' },
  { value: 'foto_clinica', label: 'Foto clínica' },
  { value: 'outro', label: 'Outro' },
] as const;

export type UploadCategory = typeof UPLOAD_CATEGORIES[number]['value'];

export interface PatientUpload {
  id: string;
  patient_id: string;
  category: UploadCategory;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
}

const MAX_BYTES = 20 * 1024 * 1024;

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
}

export function usePatientUploads(patientId: string | undefined) {
  return useQuery({
    queryKey: ['patient-uploads', patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_uploads')
        .select('*')
        .eq('patient_id', patientId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PatientUpload[];
    },
  });
}

export async function uploadPatientFile(params: {
  patientId: string;
  file: File;
  category: UploadCategory;
}): Promise<PatientUpload> {
  const { patientId, file, category } = params;
  if (file.size > MAX_BYTES) throw new Error(`Arquivo "${file.name}" excede 20 MB.`);

  const nameLower = file.name.toLowerCase();
  const typeLower = (file.type || '').toLowerCase();
  if (typeLower === 'image/heic' || typeLower === 'image/heif' || nameLower.endsWith('.heic') || nameLower.endsWith('.heif')) {
    throw new Error('Formato HEIC/HEIF do iPhone não é suportado. No iPhone: Ajustes → Câmera → Formatos → "Mais Compatível", ou envie como JPEG/PNG.');
  }

  // Some iPhones / cameras send an empty MIME — infer from extension so the
  // browser actually treats it as an image when downloading.
  let contentType = file.type || '';
  if (!contentType) {
    if (nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg')) contentType = 'image/jpeg';
    else if (nameLower.endsWith('.png')) contentType = 'image/png';
    else if (nameLower.endsWith('.webp')) contentType = 'image/webp';
    else if (nameLower.endsWith('.pdf')) contentType = 'application/pdf';
    else contentType = 'application/octet-stream';
  }

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id ?? null;

  const path = `${patientId}/${category}/${crypto.randomUUID()}_${safeName(file.name)}`;
  const up = await supabase.storage.from('patient-uploads').upload(path, file, {
    contentType,
    upsert: false,
  });
  if (up.error) {
    const e: any = up.error;
    // eslint-disable-next-line no-console
    console.error('[uploadPatientFile] storage error', { name: file.name, type: contentType, size: file.size, error: e });
    const code = e?.statusCode || e?.status || e?.error || '';
    throw new Error(`${e?.message || 'falha ao enviar'}${code ? ` (${code})` : ''}`);
  }

  const { data, error } = await supabase
    .from('patient_uploads')
    .insert({
      patient_id: patientId,
      category,
      file_name: file.name,
      storage_path: path,
      mime_type: contentType,
      size_bytes: file.size,
      uploaded_by: uid,
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from('patient-uploads').remove([path]);
    // eslint-disable-next-line no-console
    console.error('[uploadPatientFile] db insert error', error);
    throw new Error(`Banco rejeitou o registro: ${error.message}`);
  }
  return data as PatientUpload;
}

export function useUploadPatientFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadPatientFile,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['patient-uploads', vars.patientId] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao enviar arquivo'),
  });
}

export function useDeletePatientUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (upload: PatientUpload) => {
      await supabase.storage.from('patient-uploads').remove([upload.storage_path]);
      const { error } = await supabase.from('patient_uploads').delete().eq('id', upload.id);
      if (error) throw error;
      return upload;
    },
    onSuccess: (u) => {
      qc.invalidateQueries({ queryKey: ['patient-uploads', u.patient_id] });
      toast.success('Arquivo removido');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao remover'),
  });
}

export function useUploadDownloadUrl(path: string | null | undefined, fileName?: string) {
  return useQuery({
    queryKey: ['upload-url', path, fileName],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .storage
        .from('patient-uploads')
        .createSignedUrl(path!, 60 * 60, fileName ? { download: fileName } : undefined);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
