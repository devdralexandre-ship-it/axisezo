import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  DocumentType,
  DEFAULT_TEMPLATE_BODIES,
  buildPatientVariables,
  renderTemplate,
  buildSurgicalRequestHtml,
  defaultSurgicalRequestData,
  SurgicalRequestData,
} from '@/data/documents';
import { useDocumentTemplates, pickTemplate, useGenerateDocument } from '@/hooks/useDocuments';
import { SurgicalRequestForm } from './SurgicalRequestForm';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  patient: any;
}

export function GenerateDocumentDialog({ open, onClose, patient }: Props) {
  const { data: templates = [] } = useDocumentTemplates();
  const generate = useGenerateDocument();

  const [type, setType] = useState<DocumentType>('surgical_request');
  const [titleEdit, setTitleEdit] = useState<string | null>(null);
  const [bodyEdit, setBodyEdit] = useState<string | null>(null);
  const [surgicalData, setSurgicalData] = useState<SurgicalRequestData | null>(null);

  const selectedTemplate = useMemo(
    () => pickTemplate(templates, type, patient?.surgeon ?? null),
    [templates, type, patient?.surgeon]
  );

  const seed = DEFAULT_TEMPLATE_BODIES[type];
  const rawTitle = selectedTemplate?.title ?? seed.title;
  const rawBody = selectedTemplate?.body_html ?? seed.body;

  const vars = useMemo(() => (patient ? buildPatientVariables(patient) : {}), [patient]);
  const previewTitle = renderTemplate(titleEdit ?? rawTitle, vars);
  const previewBody = type === 'surgical_request' && surgicalData
    ? buildSurgicalRequestHtml(surgicalData)
    : renderTemplate(bodyEdit ?? rawBody, vars);

  // Initialize structured data when surgical_request opens or patient/template changes
  useEffect(() => {
    if (!open || !patient) return;
    if (type === 'surgical_request') {
      setSurgicalData(defaultSurgicalRequestData(patient, selectedTemplate));
    }
  }, [open, type, patient?.id, selectedTemplate?.id]);

  const handleTypeChange = (v: string) => {
    setType(v as DocumentType);
    setTitleEdit(null);
    setBodyEdit(null);
  };

  const handleGenerate = async () => {
    if (!patient) return;
    if (type === 'surgical_request' && surgicalData) {
      await generate.mutateAsync({
        patient,
        type,
        template: selectedTemplate,
        titleOverride: titleEdit ?? rawTitle,
        structuredData: surgicalData,
      });
    } else {
      await generate.mutateAsync({
        patient,
        type,
        template: selectedTemplate,
        titleOverride: titleEdit ?? rawTitle,
        bodyOverride: bodyEdit ?? rawBody,
      });
    }
    setTitleEdit(null);
    setBodyEdit(null);
    setSurgicalData(null);
    onClose();
  };

  const isStructured = type === 'surgical_request';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
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

          {isStructured ? (
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
                {surgicalData && (
                  <SurgicalRequestForm
                    data={surgicalData}
                    onChange={setSurgicalData}
                    procedureKey={patient?.procedure ?? ''}
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
          ) : (
            <div className="overflow-y-auto p-6 space-y-4">
              <div className="bg-muted/40 border border-border rounded-md px-3 py-2 text-xs text-muted-foreground">
                Modo simples: editar HTML do template e variáveis. Use o tipo <strong>Solicitação Cirúrgica</strong> para o formulário estruturado.
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Título (com variáveis)</label>
                <Input
                  value={titleEdit ?? rawTitle}
                  onChange={(e) => setTitleEdit(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Corpo HTML (com variáveis)</label>
                <Textarea
                  value={bodyEdit ?? rawBody}
                  onChange={(e) => setBodyEdit(e.target.value)}
                  rows={10}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Preview</label>
                <div className="border border-border rounded-lg p-4 bg-muted/30 max-h-72 overflow-y-auto">
                  <h4 className="font-bold text-base mb-3">{previewTitle}</h4>
                  <div
                    className="prose prose-sm max-w-none text-sm [&_p]:my-2 [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
                    dangerouslySetInnerHTML={{ __html: previewBody }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border shrink-0">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={generate.isPending}>
            {generate.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
