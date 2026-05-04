import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SurgicalRequestData } from '@/data/documents';

interface Props {
  open: boolean;
  procedure: string;
  surgeon: string | null;
  concierge: string | null;
  data: SurgicalRequestData;
  /** Called with which scopes the user chose to save (may be empty). */
  onConfirm: (chosen: { surgeon: boolean; concierge: boolean }) => void;
  onCancel: () => void;
}

export function SaveDefaultsDialog({ open, procedure, surgeon, concierge, data, onConfirm, onCancel }: Props) {
  const [saveSurgeon, setSaveSurgeon] = useState<boolean>(true);
  const [saveConcierge, setSaveConcierge] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setSaveSurgeon(!!surgeon);
      setSaveConcierge(false);
    }
  }, [open, surgeon]);

  const items = useMemo(() => {
    const list: string[] = [];
    if (data.mainCbhpm.code || data.mainCbhpm.label) {
      list.push(`CBHPM principal: ${data.mainCbhpm.code ? `${data.mainCbhpm.code} — ` : ''}${data.mainCbhpm.label}`);
    }
    data.extraCbhpm.forEach((c) => {
      if (c.code || c.label) list.push(`CBHPM extra: ${c.code ? `${c.code} — ` : ''}${c.label}`);
    });
    data.cid.forEach((c) => {
      if (c.code || c.label) list.push(`CID: ${c.code ? `${c.code} — ` : ''}${c.label}`);
    });
    data.opme.forEach((o) => {
      if (o.description) list.push(`OPME: ${o.quantity}× ${o.description}`);
    });
    return list;
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar como padrão para próximas solicitações?</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Procedimento:</span>{' '}
            <span className="font-semibold text-foreground">{procedure}</span>
          </div>

          <div className="space-y-2">
            {surgeon && (
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={saveSurgeon} onCheckedChange={(v) => setSaveSurgeon(!!v)} />
                <span className="text-sm">Salvar para o cirurgião <span className="font-medium">{surgeon}</span></span>
              </label>
            )}
            {concierge && (
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={saveConcierge} onCheckedChange={(v) => setSaveConcierge(!!v)} />
                <span className="text-sm">Salvar para a concierge <span className="font-medium">{concierge}</span></span>
              </label>
            )}
            {!surgeon && !concierge && (
              <p className="text-xs text-muted-foreground">Não há cirurgião nem concierge associados a este paciente para salvar como padrão.</p>
            )}
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Itens que serão salvos</p>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum item preenchido.</p>
            ) : (
              <ul className="text-xs text-foreground space-y-0.5">
                {items.map((it, i) => <li key={i}>• {it}</li>)}
              </ul>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Repetir o mesmo código não cria duplicata — só atualiza a entrada existente.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onConfirm({ surgeon: false, concierge: false })}>
            Não salvar e gerar
          </Button>
          <Button onClick={() => onConfirm({ surgeon: saveSurgeon, concierge: saveConcierge })}>
            Gerar e salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
