import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePatientDocuments, useDeleteDocument, getDocumentSignedUrl } from '@/hooks/useDocuments';
import { useSurgeonCertStatus, useSignDocument, useAuthorizeDocumentSignature } from '@/hooks/useSigning';
import { useUserRole } from '@/hooks/useUserRole';
import { DOCUMENT_TYPE_LABELS } from '@/data/documents';
import { GenerateDocumentDialog } from './GenerateDocumentDialog';
import { SignatureConfirmDialog } from './SignatureConfirmDialog';
import { FileText, Plus, Download, Trash2, Loader2, ShieldCheck, PenLine, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  patient: any;
}

export function PatientDocuments({ patient }: Props) {
  const { data: docs = [], isLoading } = usePatientDocuments(patient?.id);
  const deleteDoc = useDeleteDocument();
  const { data: certStatus } = useSurgeonCertStatus(patient?.id);
  const signDoc = useSignDocument();
  const authorizeDoc = useAuthorizeDocumentSignature();
  const { isSurgeon, surgeonName } = useUserRole();
  const [genOpen, setGenOpen] = useState(false);
  const [confirmDoc, setConfirmDoc] = useState<{ id: string; title: string } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const isResponsibleSurgeon = isSurgeon && surgeonName === patient?.surgeon;

  const handleDownload = async (pdfPath: string, title: string) => {
    if (downloading) return;
    setDownloading(pdfPath);
    const filename = `${title}.pdf`.replace(/[\\/:*?"<>|]+/g, '_');
    let url: string | null = null;
    try {
      url = await getDocumentSignedUrl(pdfPath, filename);
    } catch (e) {
      console.error('[download] erro ao gerar link', e);
    }
    if (!url) {
      console.error('[download] signed URL nula para', pdfPath);
      toast.error('Não foi possível gerar o link. Tente novamente.');
      setDownloading(null);
      return;
    }
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    } catch (e) {
      console.error('[download] falha ao baixar arquivo', e);
      toast.error('Falha ao baixar o documento');
    } finally {
      setDownloading(null);
    }
  };

  const handleConfirmSign = () => {
    if (!confirmDoc) return;
    signDoc.mutate(
      { documentId: confirmDoc.id },
      { onSuccess: () => setConfirmDoc(null) },
    );
  };

  const canDelegateSign = (d: any) => {
    if (!certStatus?.has_cert) return false;
    if (isResponsibleSurgeon) return true;
    if (certStatus.delegation_mode === 'never') return false;
    if (certStatus.delegation_mode === 'per_document') return !!d.signature_authorized_by;
    return true;
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

      {certStatus && (
        <div className={`text-[11px] flex items-center gap-1.5 ${certStatus.has_cert ? 'text-pipeline-green' : 'text-muted-foreground'}`}>
          <ShieldCheck className="h-3 w-3" />
          {certStatus.has_cert
            ? <>Certificado A1 ativo de {certStatus.surgeon_name} {certStatus.valid_to && `(válido até ${certStatus.valid_to})`}</>
            : <>{certStatus.surgeon_name ?? 'O cirurgião responsável'} ainda não cadastrou certificado A1</>
          }
        </div>
      )}

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
        {docs.map((d: any) => (
          <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 group">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground truncate">{d.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {DOCUMENT_TYPE_LABELS[d.type as keyof typeof DOCUMENT_TYPE_LABELS]} • {formatDate(d.created_at)}
                {d.signed_at && (
                  <span className="ml-1 text-pipeline-green">• Assinado em {formatDate(d.signed_at)}</span>
                )}
              </p>
            </div>
            {d.pdf_path && !d.signed_pdf_path && certStatus?.has_cert && canDelegateSign(d) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setConfirmDoc({ id: d.id, title: d.title })}
                title={`Assinar com A1 de ${certStatus.surgeon_name}`}
              >
                <PenLine className="h-3.5 w-3.5" />
              </Button>
            )}
            {d.pdf_path && !d.signed_pdf_path && certStatus?.has_cert
              && certStatus.delegation_mode === 'per_document'
              && !d.signature_authorized_by
              && isResponsibleSurgeon && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => authorizeDoc.mutate(d.id)}
                title="Liberar para a concierge assinar"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-pipeline-amber" />
              </Button>
            )}
            {d.signed_pdf_path && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={downloading === d.signed_pdf_path}
                onClick={(e) => { e.stopPropagation(); handleDownload(d.signed_pdf_path, `${d.title} (assinado)`); }}
                title="Baixar PDF assinado"
              >
                {downloading === d.signed_pdf_path
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-pipeline-green" />
                  : <ShieldCheck className="h-3.5 w-3.5 text-pipeline-green" />}
              </Button>
            )}
            {d.pdf_path && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={downloading === d.pdf_path}
                onClick={(e) => { e.stopPropagation(); handleDownload(d.pdf_path!, d.title); }}
                title="Baixar"
              >
                {downloading === d.pdf_path
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />}
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
      <SignatureConfirmDialog
        open={!!confirmDoc}
        onClose={() => setConfirmDoc(null)}
        onConfirm={handleConfirmSign}
        loading={signDoc.isPending}
        signerName={certStatus?.surgeon_name}
        documentTitle={confirmDoc?.title}
      />
    </div>
  );
}
