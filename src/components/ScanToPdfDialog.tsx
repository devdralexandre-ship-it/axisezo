import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, ImagePlus, Loader2, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { imagesToPdf } from '@/lib/images-to-pdf';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (pdf: File) => Promise<void> | void;
}

interface Shot {
  id: string;
  file: File;
  url: string;
}

export function ScanToPdfDialog({ open, onClose, onConfirm }: Props) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) return;
    shots.forEach((s) => URL.revokeObjectURL(s.url));
    setShots([]);
    setName('');
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const items = Array.from(files)
      .filter((f) => (f.type || '').startsWith('image/'))
      .map((f) => ({ id: crypto.randomUUID(), file: f, url: URL.createObjectURL(f) }));
    if (!items.length) {
      toast.error('Selecione apenas imagens.');
      return;
    }
    setShots((prev) => [...prev, ...items]);
  };

  const move = (index: number, delta: number) => {
    setShots((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const remove = (id: string) => {
    setShots((prev) => {
      const found = prev.find((s) => s.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((s) => s.id !== id);
    });
  };

  const handleConfirm = async () => {
    if (!shots.length) return;
    setBusy(true);
    try {
      const base = name.trim() || `Digitalizacao ${shots.length} pagina${shots.length > 1 ? 's' : ''}`;
      const pdf = await imagesToPdf(shots.map((s) => s.file), base);
      await onConfirm(pdf);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível gerar o PDF');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Digitalizar em PDF</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-2">
          Tire ou selecione várias fotos: elas viram um único PDF, uma foto por página.
        </p>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs flex-1" onClick={() => cameraRef.current?.click()} disabled={busy}>
            <Camera className="h-3.5 w-3.5 mr-1" /> Tirar foto
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs flex-1" onClick={() => galleryRef.current?.click()} disabled={busy}>
            <ImagePlus className="h-3.5 w-3.5 mr-1" /> Adicionar imagens
          </Button>
          <input
            ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />
          <input
            ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[80px]">
          {!shots.length && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma página adicionada ainda.</p>
          )}
          {shots.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <img src={s.url} alt={`Página ${i + 1}`} className="h-12 w-12 rounded object-cover border border-border" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate">Página {i + 1}</p>
                <p className="text-[11px] text-muted-foreground truncate">{s.file.name}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0 || busy} onClick={() => move(i, -1)} aria-label="Subir">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === shots.length - 1 || busy} onClick={() => move(i, 1)} aria-label="Descer">
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" disabled={busy} onClick={() => remove(s.id)} aria-label="Remover">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Nome do arquivo</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Digitalizacao ${shots.length || 1} pagina${shots.length > 1 ? 's' : ''}`}
            className="h-9 text-sm"
            disabled={busy}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={busy || !shots.length}>
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Gerar PDF e anexar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
