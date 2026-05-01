import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { BudgetData, budgetTotal } from '@/data/documents';

interface Props {
  data: BudgetData;
  onChange: (d: BudgetData) => void;
  hospitalsHint?: string[];
}

function formatBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

interface MoneyInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
}

function MoneyInput({ label, value, onChange }: MoneyInputProps) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-muted-foreground">{label}</label>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-8 text-sm"
      />
    </div>
  );
}

export function BudgetForm({ data, onChange, hospitalsHint = [] }: Props) {
  const set = <K extends keyof BudgetData>(k: K, v: BudgetData[K]) =>
    onChange({ ...data, [k]: v });

  const total = budgetTotal(data);

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
          <label className="text-[11px] font-semibold text-muted-foreground">Procedimento</label>
          <Input
            value={data.procedureName}
            onChange={(e) => set('procedureName', e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Hospital</label>
            <Input
              value={data.hospital}
              onChange={(e) => set('hospital', e.target.value)}
              list="budget-hospital-list"
              className="h-8 text-sm"
            />
            <datalist id="budget-hospital-list">
              {hospitalsHint.map((h) => <option key={h} value={h} />)}
            </datalist>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Convênio</label>
            <Input
              value={data.payer}
              onChange={(e) => set('payer', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          B. Honorários médicos
        </h4>

        <MoneyInput
          label="Cirurgião"
          value={data.surgeonFee}
          onChange={(v) => set('surgeonFee', v)}
        />

        <div className="flex items-center justify-between">
          <Label htmlFor="incl-aux" className="text-sm cursor-pointer">Incluir 1º auxiliar</Label>
          <Switch
            id="incl-aux"
            checked={data.includeFirstAssistant}
            onCheckedChange={(v) => set('includeFirstAssistant', v)}
          />
        </div>
        {data.includeFirstAssistant && (
          <MoneyInput
            label="1º auxiliar"
            value={data.firstAssistantFee}
            onChange={(v) => set('firstAssistantFee', v)}
          />
        )}

        <MoneyInput
          label="Instrumentador"
          value={data.scrubNurseFee}
          onChange={(v) => set('scrubNurseFee', v)}
        />

        <MoneyInput
          label="Anestesia"
          value={data.anesthesiaFee}
          onChange={(v) => set('anesthesiaFee', v)}
        />
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          C. Hospital e materiais
        </h4>
        <MoneyInput
          label="Orçamento hospitalar"
          value={data.hospitalBudget}
          onChange={(v) => set('hospitalBudget', v)}
        />
        <MoneyInput
          label="Materiais especiais"
          value={data.materialsCost}
          onChange={(v) => set('materialsCost', v)}
        />
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          D. Condições
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Validade (dias)</label>
            <Input
              type="number"
              min={1}
              value={data.validityDays}
              onChange={(e) => set('validityDays', parseInt(e.target.value) || 30)}
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
          <label className="text-[11px] font-semibold text-muted-foreground">Cidade</label>
          <Input
            value={data.city}
            onChange={(e) => set('city', e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">Observações</label>
          <Textarea
            value={data.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            className="text-sm"
            placeholder="Condições de pagamento, inclusões, exclusões, etc."
          />
        </div>
      </section>

      <div className="sticky bottom-0 bg-background border-t border-border pt-3 -mx-6 px-6">
        <div className="flex items-center justify-between rounded-md bg-primary/10 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Total estimado
          </span>
          <span className="text-base font-bold text-primary">{formatBRL(total)}</span>
        </div>
      </div>
    </div>
  );
}
