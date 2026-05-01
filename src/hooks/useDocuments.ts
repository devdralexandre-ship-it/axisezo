import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  DocumentTemplate,
  PatientDocument,
  DocumentType,
  DEFAULT_TEMPLATE_BODIES,
  buildPatientVariables,
  renderTemplate,
  buildSurgicalRequestHtml,
  buildPrescriptionHtml,
  buildMedicalCertificateHtml,
  buildReportHtml,
  buildBudgetHtml,
  SurgicalRequestData,
  PrescriptionData,
  MedicalCertificateData,
  ReportData,
  BudgetData,
} from '@/data/documents';
import { renderDocumentToBlob } from '@/lib/pdf-generator';
import { renderInsidePdfTemplate, htmlToBlocks } from '@/lib/pdf-template-renderer';
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
    mutationFn: async (tpl: Partial<DocumentTemplate> & { type: DocumentType; title: string; body_html?: string }) => {
      const payload: any = {
        type: tpl.type,
        surgeon: tpl.surgeon || null,
        title: tpl.title,
        body_html: tpl.body_html ?? '',
        header_html: tpl.header_html || '',
        footer_html: tpl.footer_html || '',
        is_default: tpl.is_default ?? false,
        logo_path: tpl.logo_path ?? null,
        default_data: tpl.default_data ?? {},
        mode: tpl.mode ?? 'html',
        pdf_template_path: tpl.pdf_template_path ?? null,
        content_box: tpl.content_box ?? null,
        signature_box: tpl.signature_box ?? null,
        continuation_strategy: tpl.continuation_strategy ?? 'same_page',
      };
      let resultId: string | undefined = tpl.id;
      // Check if a row with this id already exists (client-generated ids mean
      // we can't blindly insert — could collide on retries; can't blindly update
      // — row may not exist yet). Use upsert semantics.
      if (tpl.id) {
        const { data: existing } = await supabase
          .from('document_templates' as any)
          .select('id')
          .eq('id', tpl.id)
          .maybeSingle();
        if (existing) {
          const { error } = await supabase.from('document_templates' as any).update(payload).eq('id', tpl.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('document_templates' as any)
            .insert({ ...payload, id: tpl.id });
          if (error) throw error;
        }
      } else {
        const { data, error } = await supabase.from('document_templates' as any).insert(payload).select('id').single();
        if (error) throw error;
        resultId = (data as any)?.id;
      }
      return resultId;
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

export async function uploadTemplateLogo(templateId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `template-logos/${templateId}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

export async function removeTemplateLogo(path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}

export async function uploadTemplatePdf(templateId: string, file: File): Promise<string> {
  const path = `template-pdfs/${templateId}.pdf`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: 'application/pdf',
  });
  if (error) throw error;
  return path;
}

export async function getTemplatePdfSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function removeTemplatePdf(path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
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

export function pickTemplate(templates: DocumentTemplate[], type: DocumentType, surgeon: string | null) {
  return (
    templates.find((t) => t.type === type && t.surgeon === surgeon) ||
    templates.find((t) => t.type === type && t.is_default) ||
    templates.find((t) => t.type === type && !t.surgeon) ||
    templates.find((t) => t.type === type) ||
    null
  );
}

export type StructuredPayload =
  | { kind: 'surgical_request'; data: SurgicalRequestData }
  | { kind: 'prescription'; data: PrescriptionData }
  | { kind: 'medical_certificate'; data: MedicalCertificateData }
  | { kind: 'report'; data: ReportData }
  | { kind: 'budget'; data: BudgetData };

export interface GenerateInput {
  patient: any;
  type: DocumentType;
  template: DocumentTemplate | null;
  /** Simple-mode overrides (HTML) — kept for legacy / fallback */
  titleOverride?: string;
  bodyOverride?: string;
  /** Structured-mode payload */
  structuredData?: StructuredPayload;
}

async function getSignedLogoUrl(path: string | null | undefined): Promise<string | undefined> {
  if (!path) return undefined;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
  return data?.signedUrl;
}

async function recordSuggestions(procedure: string, sd: SurgicalRequestData) {
  const items: { kind: 'cbhpm' | 'cid' | 'opme'; value: string; label: string }[] = [];
  if (sd.mainCbhpm.code || sd.mainCbhpm.label) items.push({ kind: 'cbhpm', value: sd.mainCbhpm.code, label: sd.mainCbhpm.label });
  sd.extraCbhpm.forEach((c) => { if (c.code || c.label) items.push({ kind: 'cbhpm', value: c.code, label: c.label }); });
  sd.cid.forEach((c) => { if (c.code || c.label) items.push({ kind: 'cid', value: c.code, label: c.label }); });
  sd.opme.forEach((o) => { if (o.description) items.push({ kind: 'opme', value: '', label: o.description }); });

  for (const it of items) {
    // upsert with manual increment via select-then-update fallback
    const { data: existing } = await supabase
      .from('procedure_code_suggestions' as any)
      .select('id,usage_count')
      .eq('procedure', procedure)
      .eq('kind', it.kind)
      .eq('value', it.value)
      .maybeSingle();
    if (existing) {
      await supabase.from('procedure_code_suggestions' as any)
        .update({ usage_count: ((existing as any).usage_count || 0) + 1, last_used_at: new Date().toISOString(), label: it.label })
        .eq('id', (existing as any).id);
    } else {
      await supabase.from('procedure_code_suggestions' as any).insert({
        procedure, kind: it.kind, value: it.value, label: it.label,
      });
    }
  }
}

export function useGenerateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ patient, type, template, titleOverride, bodyOverride, structuredData }: GenerateInput) => {
      const vars = buildPatientVariables(patient);
      const seed = DEFAULT_TEMPLATE_BODIES[type];

      let title: string;
      let body: string;
      let dataPayload: Record<string, any> = {};

      if (structuredData) {
        title = renderTemplate(template?.title ?? seed.title, vars);
        switch (structuredData.kind) {
          case 'surgical_request':
            body = buildSurgicalRequestHtml(structuredData.data);
            break;
          case 'prescription':
            body = buildPrescriptionHtml(structuredData.data);
            break;
          case 'medical_certificate':
            body = buildMedicalCertificateHtml(structuredData.data);
            break;
          case 'report':
            body = buildReportHtml(structuredData.data);
            break;
          case 'budget':
            body = buildBudgetHtml(structuredData.data);
            break;
        }
        dataPayload = structuredData.data as any;
      } else {
        const rawTitle = titleOverride ?? template?.title ?? seed.title;
        const rawBody = bodyOverride ?? template?.body_html ?? seed.body;
        title = renderTemplate(rawTitle, vars);
        body = renderTemplate(rawBody, vars);
      }

      const headerHtml = template?.header_html ?? '';
      const footerHtml = template?.footer_html ?? '';

      // 1. Render PDF — branch by template mode
      let blob: Blob;
      if (template?.mode === 'pdf' && template.pdf_template_path && template.content_box) {
        const signedUrl = await getTemplatePdfSignedUrl(template.pdf_template_path);
        if (!signedUrl) throw new Error('Não foi possível baixar o PDF do template');
        const resp = await fetch(signedUrl);
        const templatePdfBytes = await resp.arrayBuffer();
        const blocks = htmlToBlocks(body);
        const bytes = await renderInsidePdfTemplate({
          templatePdfBytes,
          contentBox: template.content_box,
          blocks,
          continuationStrategy: template.continuation_strategy ?? 'same_page',
        });
        blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      } else {
        const logoUrl = await getSignedLogoUrl(template?.logo_path);
        blob = await renderDocumentToBlob({
          title,
          bodyHtml: body,
          headerHtml,
          footerHtml,
          logoUrl,
        });
      }

      // 2. Insert document row
      const { data: inserted, error: insertErr } = await supabase
        .from('patient_documents' as any)
        .insert({
          patient_id: patient.id,
          template_id: template?.id ?? null,
          type,
          title,
          body_html: body,
          data: dataPayload,
        } as any)
        .select()
        .single();
      if (insertErr) throw insertErr;
      const docRow = inserted as unknown as PatientDocument;

      // 3. Upload PDF
      const path = `${patient.id}/${docRow.id}.pdf`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: 'application/pdf', upsert: true });
      if (upErr) throw upErr;

      // 4. Update with pdf_path
      const { error: updErr } = await supabase
        .from('patient_documents' as any)
        .update({ pdf_path: path } as any)
        .eq('id', docRow.id);
      if (updErr) throw updErr;

      // 5. Record suggestions (best effort)
      if (type === 'surgical_request' && structuredData && patient?.procedure) {
        try { await recordSuggestions(patient.procedure, structuredData); } catch (e) { console.warn('suggestions', e); }
      }

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

export async function getDocumentSignedUrl(pdfPath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(pdfPath, 60 * 10);
  if (error) return null;
  return data?.signedUrl ?? null;
}
