import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  usePatientUploads,
  uploadPatientFile,
  useDeletePatientUpload,
  useUploadDownloadUrl,
  useUploadViewUrl,
  UPLOAD_CATEGORIES,
  UploadCategory,
  PatientUpload,
} from '@/hooks/usePatientUploads';
import {
  Camera, Upload, FileText, Image as ImageIcon, Download, Trash2, Loader2,
  Eye, AlertTriangle, RotateCw, X, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  patientId: string;
}

const CAT_LABEL = Object.fromEntries(UPLOAD_CATEGORIES.map((c) => [c.value, c.label])) as Record<string, string>;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface PendingUpload {
  tempId: string;
  file: File;
  category: UploadCategory;
  status: 'uploading' | 'error';
  error?: string;
}

function Thumb({ u }: { u: PatientUpload }) {
  const isImage = u.mime_type.startsWith('image/');
  const { data: url } = useUploadViewUrl(u.storage_path, isImage);

  if (isImage && url) {
    return (
      <img
        src={url}
        alt={u.file_name}
        loading="lazy"
        className="h-10 w-10 shrink-0 rounded object-cover border border-border"
      />
    );
  }
  return (
    <div className="h-10 w-10 shrink-0 rounded border border-border bg-background flex items-center justify-center">
      {isImage
        ? <ImageIcon className="h-4 w-4 text-muted-foreground" />
        : <FileText className="h-4 w-4 text-muted-foreground" />}
    </div>
  );
}

function UploadRow({
  u, onDelete, onView, highlighted,
}: {
  u: PatientUpload;
  onDelete: () => void;
  onView: () => void;
  highlighted: boolean;
}) {
  const { data: url, isFetching, refetch } = useUploadDownloadUrl(u.storage_path, u.file_name);

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-lg bg-muted/50 transition-colors ${
        highlighted ? 'ring-2 ring-primary/60 bg-primary/5' : ''
      }`}
    >
      <Thumb u={u} />
      <button type="button" onClick={onView} className="min-w-0 flex-1 text-left">
        <p className="text-sm text-foreground truncate hover:underline">{u.file_name}</p>
        <p className="text-[11px] text-muted-foreground">
          {CAT_LABEL[u.category] ?? u.category} • {formatSize(u.size_bytes)} • {new Date(u.created_at).toLocaleDateString('pt-BR')}
        </p>
      </button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onView} title="Abrir" aria-label="Abrir">
        <Eye className="h-4 w-4" />
      </Button>
      {url ? (
        <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Baixar">
          <a href={url} download={u.file_name} onClick={(e) => e.stopPropagation()} aria-label="Baixar">
            <Download className="h-4 w-4" />
          </a>
        </Button>
      ) : (
        <Button
          variant="ghost" size="icon" className="h-8 w-8"
          onClick={() => refetch()} disabled={isFetching}
          title={isFetching ? 'Preparando' : 'Baixar'} aria-label="Baixar"
        >
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </Button>
      )}
      <Button
        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={onDelete} title="Excluir" aria-label="Excluir"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function PendingRow({
  p, onRetry, onDismiss,
}: {
  p: PendingUpload;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const failed = p.status === 'error';
  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg border ${failed ? 'border-destructive/40 bg-destructive/5' : 'border-primary/30 bg-primary/5'}`}>
      <div className="h-10 w-10 shrink-0 rounded border border-border bg-background flex items-center justify-center">
        {failed ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <Loader2 className="h-4 w-4 animate-spin text-primary" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground truncate">{p.file.name}</p>
        <p className={`text-[11px] ${failed ? 'text-destructive' : 'text-muted-foreground'}`}>
          {failed ? (p.error || 'Falha ao enviar') : `Enviando… • ${formatSize(p.file.size)}`}
        </p>
        {!failed && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded bg-muted">
            <div className="h-full w-1/3 animate-pulse rounded bg-primary" />
          </div>
        )}
      </div>
      {failed && (
        <>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRetry} title="Tentar novamente" aria-label="Tentar novamente">
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDismiss} title="Descartar" aria-label="Descartar">
            <X className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}

function ViewerDialog({ upload, onClose }: { upload: PatientUpload | null; onClose: () => void }) {
  const { data: url, isFetching } = useUploadViewUrl(upload?.storage_path, !!upload);
  return (
    <Dialog open={!!upload} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-sm truncate">{upload?.file_name}</DialogTitle>
        </DialogHeader>
        {isFetching && !url && (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        )}
        {url && (
          <img src={url} alt={upload?.file_name} className="max-h-[70vh] w-full rounded object-contain bg-muted" />
        )}
        {url && (
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <a href={url} target="_blank" rel="noreferrer">Abrir em nova aba</a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PatientUploads({ patientId }: Props) {
  const qc = useQueryClient();
  const { data: uploads = [], isLoading } = usePatientUploads(patientId);
  const del = useDeletePatientUpload();
  const [category, setCategory] = useState<UploadCategory>('exame');
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [viewing, setViewing] = useState<PatientUpload | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!recentIds.length) return;
    const t = setTimeout(() => setRecentIds([]), 5000);
    return () => clearTimeout(t);
  }, [recentIds]);

  const runUpload = async (p: PendingUpload) => {
    try {
      const created = await uploadPatientFile({ patientId, file: p.file, category: p.category });
      setPending((prev) => prev.filter((x) => x.tempId !== p.tempId));
      setRecentIds((prev) => [...prev, created.id]);
      return true;
    } catch (e: any) {
      setPending((prev) => prev.map((x) => (
        x.tempId === p.tempId ? { ...x, status: 'error', error: e?.message ?? 'Falha ao enviar' } : x
      )));
      return false;
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const items: PendingUpload[] = Array.from(files).map((file) => ({
      tempId: crypto.randomUUID(),
      file,
      category,
      status: 'uploading',
    }));
    setPending((prev) => [...items, ...prev]);

    const results = await Promise.all(items.map((p) => runUpload(p)));
    await qc.invalidateQueries({ queryKey: ['patient-uploads', patientId] });

    const ok = results.filter(Boolean).length;
    const fail = results.length - ok;
    if (ok && !fail) toast.success(`${ok} arquivo(s) anexado(s)`);
    else if (ok && fail) toast.warning(`${ok} anexado(s), ${fail} com falha`);
    else if (fail) toast.error(`Nenhum arquivo anexado (${fail} falha${fail > 1 ? 's' : ''})`);
  };

  const handleDelete = (u: PatientUpload) => {
    if (!window.confirm(`Excluir "${u.file_name}"? Esta ação não pode ser desfeita.`)) return;
    del.mutate(u);
  };

  const busy = pending.some((p) => p.status === 'uploading');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Documentos do paciente ({uploads.length})
        </label>
        {!!recentIds.length && (
          <span className="flex items-center gap-1 text-[11px] text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" /> anexado
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select value={category} onValueChange={(v) => setCategory(v as UploadCategory)}>
          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {UPLOAD_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
          Arquivo
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => cameraRef.current?.click()} disabled={busy}>
          <Camera className="h-3 w-3 mr-1" /> Foto
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setScanOpen(true)} disabled={busy} title="Várias fotos em um único PDF">
          <Layers className="h-3 w-3 mr-1" /> Digitalizar
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/*"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      )}

      {!isLoading && !uploads.length && !pending.length && (
        <p className="text-sm text-muted-foreground py-3 text-center">Nenhum arquivo enviado.</p>
      )}

      <div className="space-y-1.5">
        {pending.map((p) => (
          <PendingRow
            key={p.tempId}
            p={p}
            onRetry={() => {
              setPending((prev) => prev.map((x) => (x.tempId === p.tempId ? { ...x, status: 'uploading', error: undefined } : x)));
              runUpload({ ...p, status: 'uploading' }).then((ok) => {
                if (ok) qc.invalidateQueries({ queryKey: ['patient-uploads', patientId] });
              });
            }}
            onDismiss={() => setPending((prev) => prev.filter((x) => x.tempId !== p.tempId))}
          />
        ))}
        {uploads.map((u) => (
          <UploadRow
            key={u.id}
            u={u}
            highlighted={recentIds.includes(u.id)}
            onView={() => {
              if (u.mime_type.startsWith('image/')) setViewing(u);
              else openInNewTab(u);
            }}
            onDelete={() => handleDelete(u)}
          />
        ))}
      </div>

      <ViewerDialog upload={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

async function openInNewTab(u: PatientUpload) {
  const tab = window.open('', '_blank');
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase.storage.from('patient-uploads').createSignedUrl(u.storage_path, 60 * 60);
    if (error || !data?.signedUrl) throw error ?? new Error('URL indisponível');
    if (tab) tab.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  } catch (e: any) {
    tab?.close();
    toast.error(e?.message ?? 'Não foi possível abrir o arquivo');
  }
}
