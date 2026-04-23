import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePatientDocuments, useDeleteDocument, getDocumentSignedUrl } from '@/hooks/useDocuments';
import { DOCUMENT_TYPE_LABELS } from '@/data/documents';
import { GenerateDocumentDialog } from './GenerateDocumentDialog';
import { FileText, Plus, Download, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  patient: any;
}

export function PatientDocuments({ patient }: Props) {
  const { data: docs = [], isLoading } = usePatientDocuments(patient?.id);
  const deleteDoc = useDeleteDocument();
  const [genOpen, setGenOpen] = useState(false);

  const handleDownload = async (pdfPath: string) => {
    const url = await getDocumentSignedUrl(pdfPath);
    if (!url) {
      toast.error('Não foi possível gerar o link');
      return;
    }
    window.open(url, '_blank');
  };

  const formatDate = (s: string) => {
    const d = new Date(s);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Documentos ({docs.length})
        </label>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setGenOpen(true)}>
          <Plus className="h-3 w-3 mr-1" /> Novo documento
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && docs.length === 0 && (
        <p className="text-sm text-muted-foreground py-3 text-center">
          Nenhum documento gerado ainda.
        </p>
      )}

      <div className="space-y-1.5">
        {docs.map((d) => (
          <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 group">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground truncate">{d.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {DOCUMENT_TYPE_LABELS[d.type]} • {formatDate(d.created_at)}
              </p>
            </div>
            {d.pdf_path && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDownload(d.pdf_path!)}
                title="Baixar"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
              onClick={() => deleteDoc.mutate(d)}
              title="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <GenerateDocumentDialog open={genOpen} onClose={() => setGenOpen(false)} patient={patient} />
    </div>
  );
}
