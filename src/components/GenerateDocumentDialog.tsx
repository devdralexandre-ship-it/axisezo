import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  DocumentType,
  DEFAULT_TEMPLATE_BODIES,
  buildPatientVariables,
  renderTemplate,
  buildSurgicalRequestHtml,
  buildPrescriptionHtml,
  buildMedicalCertificateHtml,
  buildReportHtml,
  buildBudgetHtml,
  defaultSurgicalRequestData,
  defaultPrescriptionData,
  defaultMedicalCertificateData,
  defaultReportData,
  defaultBudgetData,
  SurgicalRequestData,
  PrescriptionData,
  MedicalCertificateData,
  ReportData,
  BudgetData,
} from '@/data/documents';
import { useDocumentTemplates, pickTemplate, useGenerateDocument, StructuredPayload } from '@/hooks/useDocuments';
import { SurgicalRequestForm } from './SurgicalRequestForm';
import { PrescriptionForm } from './PrescriptionForm';
import { MedicalCertificateForm } from './MedicalCertificateForm';
import { ReportForm } from './ReportForm';
import { BudgetForm } from './BudgetForm';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  patient: any;
}

type AnyStructured =
  | { kind: 'surgical_request'; data: SurgicalRequestData }
  | { kind: 'prescription'; data: PrescriptionData }
  | { kind: 'medical_certificate'; data: MedicalCertificateData }
  | { kind: 'report'; data: ReportData }
  | { kind: 'budget'; data: BudgetData };

export function GenerateDocumentDialog({ open, onClose, patient }: Props) {
  const { data: templates = [] } = useDocumentTemplates();
  const generate = useGenerateDocument();

  const [type, setType] = useState<DocumentType>('surgical_request');
  const [titleEdit, setTitleEdit] = useState<string | null>(null);
  const [structured, setStructured] = useState<AnyStructured | null>(null);

  const selectedTemplate = useMemo(
    () => pickTemplate(templates, type, patient?.surgeon ?? null),
    [templates, type, patient?.surgeon]
  );

  const seed = DEFAULT_TEMPLATE_BODIES[type];
  const rawTitle = selectedTemplate?.title ?? seed.title;

  const vars = useMemo(() => (patient ? buildPatientVariables(patient) : {}), [patient]);
  const previewTitle = renderTemplate(titleEdit ?? rawTitle, vars);

  // Initialize structured payload whenever type or patient changes
  useEffect(() => {
    if (!open || !patient) return;
    switch (type) {
      case 'surgical_request':
        setStructured({ kind: 'surgical_request', data: defaultSurgicalRequestData(patient, selectedTemplate) });
        break;
      case 'prescription':
        setStructured({ kind: 'prescription', data: defaultPrescriptionData(patient, selectedTemplate) });
        break;
      case 'medical_certificate':
        setStructured({ kind: 'medical_certificate', data: defaultMedicalCertificateData(patient, selectedTemplate) });
        break;
      case 'report':
        setStructured({ kind: 'report', data: defaultReportData(patient, selectedTemplate) });
        break;
      case 'budget':
        setStructured({ kind: 'budget', data: defaultBudgetData(patient, selectedTemplate) });
        break;
    }
  }, [open, type, patient?.id, selectedTemplate?.id]);

  const previewBody = useMemo(() => {
    if (!structured) return '';
    switch (structured.kind) {
      case 'surgical_request': return buildSurgicalRequestHtml(structured.data);
      case 'prescription': return buildPrescriptionHtml(structured.data);
      case 'medical_certificate': return buildMedicalCertificateHtml(structured.data);
      case 'report': return buildReportHtml(structured.data);
      case 'budget': return buildBudgetHtml(structured.data);
    }
  }, [structured]);

  const hospitalsHint = useMemo(() => {
    const set = new Set<string>();
    if (patient?.desiredHospital) set.add(patient.desiredHospital);
    return Array.from(set);
  }, [patient]);

  const handleTypeChange = (v: string) => {
    setType(v as DocumentType);
    setTitleEdit(null);
  };

  const handleClose = () => {
    setStructured(null);
    setTitleEdit(null);
    onClose();
  };

  const handleGenerate = async () => {
    if (!patient || !structured) return;
    await generate.mutateAsync({
      patient,
      type,
      template: selectedTemplate,
      titleOverride: titleEdit ?? rawTitle,
      structuredData: structured as StructuredPayload,
    });
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border shrink-0">
          <DialogTitle>Novo documento — {patient?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-6 py-3 border-b border-border grid grid-cols-2 gap-3 shrink-0">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Tipo</label>
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Template usado</label>
              <div className="h-9 flex items-center text-sm text-muted-foreground truncate">
                {selectedTemplate
                  ? `${selectedTemplate.title}${selectedTemplate.surgeon ? ` (${selectedTemplate.surgeon})` : ''}`
                  : 'Padrão (sem template salvo)'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 flex-1 overflow-hidden">
            {/* Form */}
            <div className="overflow-y-auto p-6 border-r border-border">
              <div className="space-y-1 mb-4">
                <label className="text-xs font-semibold text-muted-foreground">Título do documento</label>
                <Input
                  value={titleEdit ?? rawTitle}
                  onChange={(e) => setTitleEdit(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              {structured?.kind === 'surgical_request' && (
                <SurgicalRequestForm
                  data={structured.data}
                  onChange={(d) => setStructured({ kind: 'surgical_request', data: d })}
                  procedureKey={patient?.procedure ?? ''}
                />
              )}
              {structured?.kind === 'prescription' && (
                <PrescriptionForm
                  data={structured.data}
                  onChange={(d) => setStructured({ kind: 'prescription', data: d })}
                />
              )}
              {structured?.kind === 'medical_certificate' && (
                <MedicalCertificateForm
                  data={structured.data}
                  onChange={(d) => setStructured({ kind: 'medical_certificate', data: d })}
                  procedureKey={patient?.procedure ?? ''}
                />
              )}
              {structured?.kind === 'report' && (
                <ReportForm
                  data={structured.data}
                  onChange={(d) => setStructured({ kind: 'report', data: d })}
                />
              )}
              {structured?.kind === 'budget' && (
                <BudgetForm
                  data={structured.data}
                  onChange={(d) => setStructured({ kind: 'budget', data: d })}
                  hospitalsHint={hospitalsHint}
                />
              )}
            </div>

            {/* Preview */}
            <div className="overflow-y-auto p-6 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Preview</p>
              <div className="bg-background border border-border rounded-lg p-6 shadow-sm">
                <h4 className="font-bold text-base mb-3">{previewTitle}</h4>
                <div
                  className="prose prose-sm max-w-none text-sm [&_p]:my-2 [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: previewBody }}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border shrink-0">
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={generate.isPending || !structured}>
            {generate.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
