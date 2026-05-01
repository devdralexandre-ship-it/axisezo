import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ReportData } from '@/data/documents';
import { Sparkles } from 'lucide-react';

interface Props {
  data: ReportData;
  onChange: (d: ReportData) => void;
}

export function ReportForm({ data, onChange }: Props) {
  const set = <K extends keyof ReportData>(k: K, v: ReportData[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          A. Identificação
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Paciente</label>
            <Input
              value={data.patientName}
              onChange={(e) => set('patientName', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Idade</label>
            <Input
              value={data.patientAge}
              onChange={(e) => set('patientAge', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
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

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            B. Relatório
          </h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            disabled
            title="Em breve: sugestões automáticas com IA"
          >
            <Sparkles className="h-3 w-3 mr-1" /> Sugerir com IA (em breve)
          </Button>
        </div>
        <Textarea
          value={data.reportText}
          onChange={(e) => set('reportText', e.target.value)}
          rows={14}
          className="text-sm"
          placeholder="Descreva o histórico clínico, achados, conduta e observações relevantes…"
        />
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          C. Data e local
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Data</label>
            <Input
              type="date"
              value={data.date}
              onChange={(e) => set('date', e.target.value)}
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
      </section>
    </div>
  );
}
