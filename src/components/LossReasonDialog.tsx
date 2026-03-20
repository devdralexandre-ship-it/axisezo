import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { LOSS_REASONS, LOSS_REASON_LABELS, LossReason } from '@/data/types';

interface LossReasonDialogProps {
  open: boolean;
  patientName: string;
  onConfirm: (reason: LossReason, detail: string | null) => void;
  onCancel: () => void;
}

export function LossReasonDialog({ open, patientName, onConfirm, onCancel }: LossReasonDialogProps) {
  const [reason, setReason] = useState<LossReason | null>(null);
  const [detail, setDetail] = useState('');

  const handleConfirm = () => {
    if (!reason) return;
    onConfirm(reason, reason === 'other' ? detail || null : null);
    setReason(null);
    setDetail('');
  };

  const handleCancel = () => {
    setReason(null);
    setDetail('');
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Motivo da perda</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Por que <span className="font-medium text-foreground">{patientName}</span> não prosseguiu?
        </p>
        <RadioGroup value={reason || ''} onValueChange={(v) => setReason(v as LossReason)} className="space-y-2 mt-2">
          {LOSS_REASONS.map((r) => (
            <div key={r} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <RadioGroupItem value={r} id={r} />
              <Label htmlFor={r} className="cursor-pointer flex-1 text-sm">{LOSS_REASON_LABELS[r]}</Label>
            </div>
          ))}
        </RadioGroup>
        {reason === 'other' && (
          <Textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Descreva o motivo..."
            className="mt-2"
            rows={3}
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!reason || (reason === 'other' && !detail.trim())} variant="destructive">
            Confirmar perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
