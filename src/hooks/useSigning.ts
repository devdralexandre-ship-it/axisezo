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
  delegation_mode?: 'always' | 'per_document' | 'never';
  pfx_sha256?: string | null;
}

export interface SurgeonCertStatus {
  has_cert: boolean;
  surgeon_name: string | null;
  signer_user_id: string | null;
  subject_cn: string | null;
  valid_to: string | null;
  delegation_mode: 'always' | 'per_document' | 'never';
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
  result: 'success' | 'failed' | 'revoked' | string;
  error_message: string | null;
  signed_at: string;
  ip_address?: string | null;
}

/* ---------------- My certificate ---------------- */

export function useMySigningCertificate(userId: string | undefined) {
  return useQuery({
    queryKey: ['signing_certificate', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('signing_certificates' as any)
        .select('user_id, pfx_path, subject_cn, valid_from, valid_to, updated_at, delegation_mode, pfx_sha256')
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

export function useRevokeSigningCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('revoke-signing-cert', { body: {} });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['signing_certificate'] });
      qc.invalidateQueries({ queryKey: ['signature_audit'] });
      toast.success('Certificado revogado');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}

export function useSetDelegationMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mode: 'always' | 'per_document' | 'never') => {
      const { error } = await supabase.rpc('set_delegation_mode', { _mode: mode });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['signing_certificate'] });
      qc.invalidateQueries({ queryKey: ['surgeon_cert_status'] });
      toast.success('Modo de delegação atualizado');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}

export function useAuthorizeDocumentSignature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase.rpc('authorize_document_signature', { _document_id: documentId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient_documents'] });
      toast.success('Documento liberado para assinatura');
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
    mutationFn: async ({ documentId }: { documentId: string }) => {
      const { data, error } = await supabase.functions.invoke('sign-pdf', {
        body: { document_id: documentId },
      });
      if (error) {
        const response = (error as any)?.context;
        const body = response?.json ? await response.clone().json().catch(() => null) : null;
        throw new Error(body?.error ?? error.message);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
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

/* ---------------- MFA helpers ---------------- */

export function useMfaStatus() {
  return useQuery({
    queryKey: ['mfa_status'],
    queryFn: async () => {
      const [{ data: factors, error: factorsError }, { data: aal, error: aalError }] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      if (factorsError) throw factorsError;
      if (aalError) throw aalError;
      const totp = (factors?.totp ?? []).find((f) => f.status === 'verified');
      const currentLevel = aal?.currentLevel ?? 'aal1';
      const nextLevel = aal?.nextLevel ?? null;
      return {
        hasMfa: !!totp,
        factor: totp ?? null,
        currentLevel,
        nextLevel,
        needsVerification: !!totp && currentLevel !== 'aal2',
      };
    },
  });
}

export function useVerifyMfaFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const factor = (factors?.totp ?? []).find((f) => f.status === 'verified');
      if (!factor) throw new Error('Ative MFA antes de assinar.');

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;
      if (aal?.currentLevel !== 'aal2') throw new Error('Não foi possível verificar MFA para esta sessão.');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mfa_status'] });
      toast.success('MFA verificado para esta sessão');
    },
    onError: (e: any) => toast.error(`Erro no MFA: ${e.message}`),
  });
}
