import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CodeAutocomplete } from './CodeAutocomplete';
import { MedicalCertificateData } from '@/data/documents';

interface Props {
  data: MedicalCertificateData;
  onChange: (d: MedicalCertificateData) => void;
  procedureKey: string;
}

export function MedicalCertificateForm({ data, onChange, procedureKey }: Props) {
  const set = <K extends keyof MedicalCertificateData>(k: K, v: MedicalCertificateData[K]) =>
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
          <label className="text-[11px] font-semibold text-muted-foreground">Médico</label>
          <Input
            value={data.surgeon}
            onChange={(e) => set('surgeon', e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          B. Atestado
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Dias de afastamento</label>
            <Input
              type="number"
              min={0}
              value={data.days}
              onChange={(e) => set('days', parseInt(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Data</label>
            <Input
              type="date"
              value={data.date}
              onChange={(e) => set('date', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">CID</label>
          <CodeAutocomplete
            procedure={procedureKey}
            kind="cid"
            value={data.cid.code}
            label={data.cid.label}
            onChange={(code, label) => set('cid', { code, label })}
            valuePlaceholder="CID"
            labelPlaceholder="Descrição"
          />
        </div>

        <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
          <div>
            <Label htmlFor="cid-consent" className="text-sm cursor-pointer block">
              Paciente concorda com a inclusão do CID
            </Label>
            <p className="text-[11px] text-muted-foreground mt-1">
              Se desativado, o CID será omitido do atestado emitido.
            </p>
          </div>
          <Switch
            id="cid-consent"
            checked={data.patientConsentsCid}
            onCheckedChange={(v) => set('patientConsentsCid', v)}
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
      </section>
    </div>
  );
}
