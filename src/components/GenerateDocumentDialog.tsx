import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, DocumentType, DEFAULT_TEMPLATE_BODIES, buildPatientVariables, renderTemplate } from '@/data/documents';
import { useDocumentTemplates, pickTemplate, useGenerateDocument } from '@/hooks/useDocuments';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  patient: any;
}

export function GenerateDocumentDialog({ open, onClose, patient }: Props) {
  const { data: templates = [] } = useDocumentTemplates();
  const generate = useGenerateDocument();

  const [type, setType] = useState<DocumentType>('budget');
  const [titleEdit, setTitleEdit] = useState<string | null>(null);
  const [bodyEdit, setBodyEdit] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => pickTemplate(templates, type, patient?.surgeon ?? null),
    [templates, type, patient?.surgeon]
  );

  const seed = DEFAULT_TEMPLATE_BODIES[type];
  const rawTitle = selectedTemplate?.title ?? seed.title;
  const rawBody = selectedTemplate?.body_html ?? seed.body;

  const vars = useMemo(() => (patient ? buildPatientVariables(patient) : {}), [patient]);
  const previewTitle = renderTemplate(titleEdit ?? rawTitle, vars);
  const previewBody = renderTemplate(bodyEdit ?? rawBody, vars);

  const handleTypeChange = (v: string) => {
    setType(v as DocumentType);
    setTitleEdit(null);
    setBodyEdit(null);
  };

  const handleGenerate = async () => {
    if (!patient) return;
    await generate.mutateAsync({
      patient,
      type,
      template: selectedTemplate,
      titleOverride: titleEdit ?? rawTitle,
      bodyOverride: bodyEdit ?? rawBody,
    });
    setTitleEdit(null);
    setBodyEdit(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo documento — {patient?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
              <div className="h-9 flex items-center text-sm text-muted-foreground">
                {selectedTemplate
                  ? `${selectedTemplate.title}${selectedTemplate.surgeon ? ` (${selectedTemplate.surgeon})` : ''}`
                  : 'Padrão (sem template salvo)'}
              </div>
            </div>
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
            <label className="text-xs font-semibold text-muted-foreground">Preview com dados do paciente</label>
            <div className="border border-border rounded-lg p-4 bg-muted/30 max-h-72 overflow-y-auto">
              <h4 className="font-bold text-base mb-3">{previewTitle}</h4>
              <div
                className="prose prose-sm max-w-none text-sm [&_p]:my-2 [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: previewBody }}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
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
