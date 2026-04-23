import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DocumentTemplate, PatientDocument, DocumentType, DEFAULT_TEMPLATE_BODIES, buildPatientVariables, renderTemplate } from '@/data/documents';
import { renderDocumentToBlob } from '@/lib/pdf-generator';
import { toast } from 'sonner';

const BUCKET = 'patient-documents';

/* ---------- Templates ---------- */

export function useDocumentTemplates() {
  return useQuery({
    queryKey: ['document_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_templates' as any)
        .select('*')
        .order('type', { ascending: true })
        .order('surgeon', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as DocumentTemplate[];
    },
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tpl: Partial<DocumentTemplate> & { type: DocumentType; title: string; body_html: string }) => {
      const payload: any = {
        type: tpl.type,
        surgeon: tpl.surgeon || null,
        title: tpl.title,
        body_html: tpl.body_html,
        header_html: tpl.header_html || '',
        footer_html: tpl.footer_html || '',
        is_default: tpl.is_default ?? false,
      };
      if (tpl.id) {
        const { error } = await supabase.from('document_templates' as any).update(payload).eq('id', tpl.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('document_templates' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document_templates'] });
      toast.success('Template salvo!');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('document_templates' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document_templates'] });
      toast.success('Template excluído');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}

/* ---------- Patient documents ---------- */

export function usePatientDocuments(patientId: string | undefined) {
  return useQuery({
    queryKey: ['patient_documents', patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_documents' as any)
        .select('*')
        .eq('patient_id', patientId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PatientDocument[];
    },
  });
}

/**
 * Resolve which template body to use for a given (type, surgeon).
 * Priority: exact (type+surgeon) > default for type > generic for type > seed default.
 */
export function pickTemplate(templates: DocumentTemplate[], type: DocumentType, surgeon: string | null) {
  return (
    templates.find((t) => t.type === type && t.surgeon === surgeon) ||
    templates.find((t) => t.type === type && t.is_default) ||
    templates.find((t) => t.type === type && !t.surgeon) ||
    templates.find((t) => t.type === type) ||
    null
  );
}

export interface GenerateInput {
  patient: any;
  type: DocumentType;
  template: DocumentTemplate | null;
  /** Optional overrides: body and title already rendered (from preview edits) */
  titleOverride?: string;
  bodyOverride?: string;
}

export function useGenerateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ patient, type, template, titleOverride, bodyOverride }: GenerateInput) => {
      const vars = buildPatientVariables(patient);
      const seed = DEFAULT_TEMPLATE_BODIES[type];
      const rawTitle = titleOverride ?? template?.title ?? seed.title;
      const rawBody = bodyOverride ?? template?.body_html ?? seed.body;
      const title = renderTemplate(rawTitle, vars);
      const body = renderTemplate(rawBody, vars);
      const headerHtml = template?.header_html ?? '';
      const footerHtml = template?.footer_html ?? '';

      // 1. Render PDF in client
      const blob = await renderDocumentToBlob({
        title,
        bodyHtml: body,
        headerHtml,
        footerHtml,
      });

      // 2. Insert document row first (we need the ID for the storage path)
      const { data: inserted, error: insertErr } = await supabase
        .from('patient_documents' as any)
        .insert({
          patient_id: patient.id,
          template_id: template?.id ?? null,
          type,
          title,
          body_html: body,
        } as any)
        .select()
        .single();
      if (insertErr) throw insertErr;
      const docRow = inserted as unknown as PatientDocument;

      // 3. Upload PDF
      const path = `${patient.id}/${docRow.id}.pdf`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, {
          contentType: 'application/pdf',
          upsert: true,
        });
      if (upErr) throw upErr;

      // 4. Update row with pdf_path
      const { error: updErr } = await supabase
        .from('patient_documents' as any)
        .update({ pdf_path: path } as any)
        .eq('id', docRow.id);
      if (updErr) throw updErr;

      return { ...docRow, pdf_path: path };
    },
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ['patient_documents', doc.patient_id] });
      toast.success('Documento gerado!');
    },
    onError: (e: any) => toast.error(`Erro ao gerar: ${e.message}`),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: PatientDocument) => {
      if (doc.pdf_path) {
        await supabase.storage.from(BUCKET).remove([doc.pdf_path]);
      }
      const { error } = await supabase.from('patient_documents' as any).delete().eq('id', doc.id);
      if (error) throw error;
      return doc;
    },
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ['patient_documents', doc.patient_id] });
      toast.success('Documento excluído');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}

/**
 * Get a short-lived signed URL for downloading / previewing a document PDF.
 */
export async function getDocumentSignedUrl(pdfPath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(pdfPath, 60 * 10);
  if (error) return null;
  return data?.signedUrl ?? null;
}
