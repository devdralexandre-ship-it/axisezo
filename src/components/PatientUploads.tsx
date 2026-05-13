import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  usePatientUploads,
  useUploadPatientFile,
  useDeletePatientUpload,
  useUploadDownloadUrl,
  UPLOAD_CATEGORIES,
  UploadCategory,
  PatientUpload,
} from '@/hooks/usePatientUploads';
import { Camera, Upload, FileText, Image as ImageIcon, Download, Trash2, Loader2 } from 'lucide-react';
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

function UploadRow({ u, onDelete }: { u: PatientUpload; onDelete: () => void }) {
  const isImage = u.mime_type.startsWith('image/');
  const { data: url, isFetching, refetch } = useUploadDownloadUrl(u.storage_path, u.file_name);

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 group">
      {isImage ? <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" /> : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground truncate">{u.file_name}</p>
        <p className="text-[11px] text-muted-foreground">
          {CAT_LABEL[u.category] ?? u.category} • {formatSize(u.size_bytes)} • {new Date(u.created_at).toLocaleDateString('pt-BR')}
        </p>
      </div>
      {url ? (
        <Button asChild variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" title="Baixar">
          <a href={url} download={u.file_name} onClick={(e) => e.stopPropagation()} aria-label="Baixar">
            <Download className="h-3.5 w-3.5" />
          </a>
        </Button>
      ) : (
        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => refetch()} disabled={isFetching} title={isFetching ? 'Preparando' : 'Baixar'}>
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
        onClick={onDelete} title="Excluir">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function PatientUploads({ patientId }: Props) {
  const { data: uploads = [], isLoading } = usePatientUploads(patientId);
  const upload = useUploadPatientFile();
  const del = useDeletePatientUpload();
  const [category, setCategory] = useState<UploadCategory>('exame');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync({ patientId, file, category });
      } catch {
        // toast already in hook
      }
    }
    toast.success(`${files.length} arquivo(s) enviado(s)`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Documentos do paciente ({uploads.length})
        </label>
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
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
          Arquivo
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => cameraRef.current?.click()} disabled={upload.isPending}>
          <Camera className="h-3 w-3 mr-1" /> Foto
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

      {!isLoading && uploads.length === 0 && (
        <p className="text-sm text-muted-foreground py-3 text-center">Nenhum arquivo enviado.</p>
      )}

      <div className="space-y-1.5">
        {uploads.map((u) => (
          <UploadRow key={u.id} u={u} onDelete={() => del.mutate(u)} />
        ))}
      </div>
    </div>
  );
}
