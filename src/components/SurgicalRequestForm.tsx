import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CodeAutocomplete } from './CodeAutocomplete';
import { SurgicalRequestData, buildSurgicalRequestHtml } from '@/data/documents';
import { Pencil, Plus, Trash2 } from 'lucide-react';

const BILLING_OPTIONS = [
  'Cooperuro',
  'Unicooper',
  'Honorários Particulares',
  'Custos Totais Particulares',
];

interface Props {
  data: SurgicalRequestData;
  onChange: (data: SurgicalRequestData) => void;
  procedureKey: string;
}

interface PatientFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function PatientField({ label, value, onChange }: PatientFieldProps) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-muted-foreground">{label}</label>
      <div className="flex items-center gap-1">
        {editing ? (
          <Input
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            className="h-8 text-sm"
          />
        ) : (
          <>
            <div className="flex-1 h-8 px-2 flex items-center text-sm bg-muted/40 rounded border border-transparent">
              {value || <span className="text-muted-foreground italic">—</span>}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditing(true)}>
              <Pencil className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function SurgicalRequestForm({ data, onChange, procedureKey }: Props) {
  const set = <K extends keyof SurgicalRequestData>(key: K, v: SurgicalRequestData[K]) =>
    onChange({ ...data, [key]: v });

  return (
    <div className="space-y-5">
      {/* A — Patient */}
      <section className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">A. Dados do paciente</h4>
        <div className="grid grid-cols-2 gap-3">
          <PatientField label="Nome" value={data.patientName} onChange={(v) => set('patientName', v)} />
          <PatientField label="Idade" value={data.patientAge} onChange={(v) => set('patientAge', v)} />
          <PatientField label="Telefone" value={data.patientPhone} onChange={(v) => set('patientPhone', v)} />
          <PatientField label="Responsável" value={data.responsibleContact} onChange={(v) => set('responsibleContact', v)} />
          <PatientField label="Convênio" value={data.payer} onChange={(v) => set('payer', v)} />
          <PatientField label="Hospital" value={data.desiredHospital} onChange={(v) => set('desiredHospital', v)} />
        </div>
      </section>

      {/* B — Procedure */}
      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">B. Procedimento e códigos</h4>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">Procedimento principal</label>
          <Input
            value={data.procedureName}
            onChange={(e) => set('procedureName', e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">Código CBHPM principal</label>
          <CodeAutocomplete
            procedure={procedureKey}
            kind="cbhpm"
            value={data.mainCbhpm.code}
            label={data.mainCbhpm.label}
            onChange={(code, label) => set('mainCbhpm', { code, label })}
            valuePlaceholder="Código CBHPM"
            labelPlaceholder="Descrição"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-muted-foreground">Procedimentos complementares</label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => set('extraCbhpm', [...data.extraCbhpm, { code: '', label: '' }])}
            >
              <Plus className="h-3 w-3 mr-1" />Adicionar
            </Button>
          </div>
          {data.extraCbhpm.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <div className="flex-1">
                <CodeAutocomplete
                  procedure={procedureKey}
                  kind="cbhpm"
                  value={item.code}
                  label={item.label}
                  onChange={(code, label) => {
                    const next = [...data.extraCbhpm];
                    next[idx] = { code, label };
                    set('extraCbhpm', next);
                  }}
                  valuePlaceholder="Código"
                  labelPlaceholder="Descrição"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => set('extraCbhpm', data.extraCbhpm.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-muted-foreground">CID</label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => set('cid', [...data.cid, { code: '', label: '' }])}
            >
              <Plus className="h-3 w-3 mr-1" />Adicionar
            </Button>
          </div>
          {data.cid.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <div className="flex-1">
                <CodeAutocomplete
                  procedure={procedureKey}
                  kind="cid"
                  value={item.code}
                  label={item.label}
                  onChange={(code, label) => {
                    const next = [...data.cid];
                    next[idx] = { code, label };
                    set('cid', next);
                  }}
                  valuePlaceholder="CID"
                  labelPlaceholder="Descrição"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => set('cid', data.cid.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-muted-foreground">OPME / Materiais</label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => set('opme', [...data.opme, { description: '', quantity: 1 }])}
            >
              <Plus className="h-3 w-3 mr-1" />Adicionar
            </Button>
          </div>
          {data.opme.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <div className="flex-1">
                <CodeAutocomplete
                  procedure={procedureKey}
                  kind="opme"
                  value=""
                  label={item.description}
                  onChange={(_, label) => {
                    const next = [...data.opme];
                    next[idx] = { ...next[idx], description: label };
                    set('opme', next);
                  }}
                  labelPlaceholder="Descrição do item"
                  hideValue
                />
              </div>
              <Input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => {
                  const next = [...data.opme];
                  next[idx] = { ...next[idx], quantity: parseInt(e.target.value) || 1 };
                  set('opme', next);
                }}
                className="h-8 text-sm w-16"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => set('opme', data.opme.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">Descrição cirúrgica (editável)</label>
          <Textarea
            value={data.surgicalDescription}
            onChange={(e) => set('surgicalDescription', e.target.value)}
            rows={4}
            className="text-sm"
            placeholder="Descrição padrão do código cirúrgico solicitado…"
          />
        </div>
      </section>

      {/* C — Regime */}
      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">C. Regime e reservas</h4>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">Regime de internação</label>
          <RadioGroup
            value={data.regime}
            onValueChange={(v) => set('regime', v as any)}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="inpatient" id="reg-in" />
              <Label htmlFor="reg-in" className="text-sm cursor-pointer">Hospitalar</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="day_hospital" id="reg-day" />
              <Label htmlFor="reg-day" className="text-sm cursor-pointer">Hospital-dia</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="icu" className="text-sm cursor-pointer">Reserva de UTI</Label>
          <Switch id="icu" checked={data.icuReservation} onCheckedChange={(v) => set('icuReservation', v)} />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="blood" className="text-sm cursor-pointer">Reserva de sangue</Label>
          <Switch id="blood" checked={data.bloodReservation} onCheckedChange={(v) => set('bloodReservation', v)} />
        </div>

        {data.bloodReservation && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Unidades de sangue</label>
            <Input
              type="number"
              min={1}
              value={data.bloodUnits}
              onChange={(e) => set('bloodUnits', parseInt(e.target.value) || 0)}
              className="h-8 text-sm w-24"
            />
          </div>
        )}
      </section>

      {/* D — Billing */}
      <section className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">D. Faturamento</h4>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">Forma de faturamento</label>
          <Select value={data.billingType || ''} onValueChange={(v) => set('billingType', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar…" /></SelectTrigger>
            <SelectContent>
              {BILLING_OPTIONS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </section>
    </div>
  );
}

export { buildSurgicalRequestHtml };
