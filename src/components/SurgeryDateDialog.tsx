import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface SurgeryDateDialogProps {
  open: boolean;
  patientName: string;
  initialDate?: string | null;
  initialTime?: string | null;
  title?: string;
  onConfirm: (date: string, time: string | null) => void;
  onCancel: () => void;
}

function parseISODate(s?: string | null): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s + 'T12:00:00');
  return isNaN(d.getTime()) ? undefined : d;
}

export function SurgeryDateDialog({
  open,
  patientName,
  initialDate,
  initialTime,
  title = 'Data da cirurgia',
  onConfirm,
  onCancel,
}: SurgeryDateDialogProps) {
  const [date, setDate] = useState<Date | undefined>(parseISODate(initialDate));
  const [time, setTime] = useState<string>(initialTime?.substring(0, 5) || '');
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(parseISODate(initialDate));
      setTime(initialTime?.substring(0, 5) || '');
    }
  }, [open, initialDate, initialTime]);

  const handleConfirm = () => {
    if (!date) return;
    const iso = format(date, 'yyyy-MM-dd');
    onConfirm(iso, time ? `${time}:00` : null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Informe quando a cirurgia de{' '}
          <span className="font-medium text-foreground">{patientName}</span> está agendada.
        </p>

        <div className="grid gap-4 mt-2">
          <div className="grid gap-2">
            <Label>Data *</Label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => { setDate(d); setPopoverOpen(false); }}
                  initialFocus
                  locale={ptBR}
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="surgery-time">Horário (opcional)</Label>
            <Input
              id="surgery-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!date}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
