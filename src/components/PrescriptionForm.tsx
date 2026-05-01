import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { PrescriptionData } from '@/data/documents';

interface Props {
  data: PrescriptionData;
  onChange: (d: PrescriptionData) => void;
}

export function PrescriptionForm({ data, onChange }: Props) {
  const set = <K extends keyof PrescriptionData>(k: K, v: PrescriptionData[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          A. Identificação
        </h4>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">Paciente</label>
          <Input
            value={data.patientName}
            onChange={(e) => set('patientName', e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">Cirurgião</label>
          <Input
            value={data.surgeon}
            onChange={(e) => set('surgeon', e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          B. Prescrição
        </h4>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">
            Medicações (texto livre)
          </label>
          <Textarea
            value={data.medications}
            onChange={(e) => set('medications', e.target.value)}
            rows={10}
            className="text-sm font-mono"
            placeholder={`Ex.:\n1. Dipirona 500 mg — 1 comprimido VO de 6/6h se dor\n2. Cefalexina 500 mg — 1 cápsula VO de 6/6h por 7 dias`}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          C. Data e local
        </h4>
        <div className="flex items-center justify-between">
          <Label htmlFor="show-date" className="text-sm cursor-pointer">Incluir data</Label>
          <Switch
            id="show-date"
            checked={data.showDate}
            onCheckedChange={(v) => set('showDate', v)}
          />
        </div>
        {data.showDate && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Data</label>
              <Input
                type="date"
                value={data.date ?? ''}
                onChange={(e) => set('date', e.target.value || null)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Cidade</label>
              <Input
                value={data.city}
                onChange={(e) => set('city', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
