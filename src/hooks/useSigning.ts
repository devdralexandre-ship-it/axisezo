import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SigningCertificate {
  user_id: string;
  pfx_path: string;
  subject_cn: string | null;
  valid_from: string | null;
  valid_to: string | null;
  updated_at: string;
}

export interface SurgeonCertStatus {
  has_cert: boolean;
  surgeon_name: string | null;
  signer_user_id: string | null;
  subject_cn: string | null;
  valid_to: string | null;
}

export interface SignatureAuditEntry {
  id: string;
  signer_user_id: string;
  signer_name: string | null;
  acted_by_user_id: string;
  acted_by_name: string | null;
  patient_id: string | null;
  patient_name_snapshot: string | null;
  document_id: string | null;
  document_title: string | null;
  document_type: string | null;
  result: 'success' | 'failed' | string;
  error_message: string | null;
  signed_at: string;
}

/* ---------------- My certificate ---------------- */

export function useMySigningCertificate(userId: string | undefined) {
  return useQuery({
    queryKey: ['signing_certificate', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('signing_certificates' as any)
        .select('user_id, pfx_path, subject_cn, valid_from, valid_to, updated_at')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as SigningCertificate) || null;
    },
  });
}

export function useUploadSigningCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, password }: { file: File; password: string }) => {
      const form = new FormData();
      form.append('file', file);
      form.append('password', password);
      const { data, error } = await supabase.functions.invoke('upload-signing-cert', { body: form });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['signing_certificate'] });
      toast.success('Certificado A1 cadastrado com sucesso');
    },
    onError: (e: any) => toast.error(`Erro ao cadastrar certificado: ${e.message}`),
  });
}

export function useDeleteSigningCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await supabase.storage.from('signing-certificates').remove([`${userId}/cert.pfx`]);
      const { error } = await supabase
        .from('signing_certificates' as any)
        .delete()
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['signing_certificate'] });
      toast.success('Certificado removido');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}

/* ---------------- Surgeon cert status (per patient) ---------------- */

export function useSurgeonCertStatus(patientId: string | undefined) {
  return useQuery({
    queryKey: ['surgeon_cert_status', patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_surgeon_cert_status', {
        _patient_id: patientId!,
      });
      if (error) throw error;
      const row = (data as any[])?.[0];
      return (row || null) as SurgeonCertStatus | null;
    },
  });
}

/* ---------------- Sign action ---------------- */

export function useSignDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => {
      const { data, error } = await supabase.functions.invoke('sign-pdf', {
        body: { document_id: documentId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (_, documentId) => {
      qc.invalidateQueries({ queryKey: ['patient_documents'] });
      qc.invalidateQueries({ queryKey: ['signature_audit'] });
      toast.success('Documento assinado com A1');
    },
    onError: (e: any) => toast.error(`Erro ao assinar: ${e.message}`),
  });
}

/* ---------------- Audit log ---------------- */

export function useSignatureAuditAsSigner(userId: string | undefined) {
  return useQuery({
    queryKey: ['signature_audit', 'signer', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('signature_audit_log' as any)
        .select('*')
        .eq('signer_user_id', userId!)
        .order('signed_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as SignatureAuditEntry[];
    },
  });
}

export function useSignatureAuditAsActor(userId: string | undefined) {
  return useQuery({
    queryKey: ['signature_audit', 'actor', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('signature_audit_log' as any)
        .select('*')
        .eq('acted_by_user_id', userId!)
        .order('signed_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as SignatureAuditEntry[];
    },
  });
}
