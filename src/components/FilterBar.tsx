import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { PROCEDURES } from '@/data/constants';
import { PATIENT_TYPE_LABELS } from '@/data/constants';
import { useStaffNames } from '@/hooks/useStaffNames';
import { SURGICAL_APPROACHES, SURGEONS, CONCIERGES, PAYERS, BILLING_TYPES, HOSPITALS, INDICATION_SOURCES } from '@/data/constants';

interface FilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  surgeon: string;
  onSurgeonChange: (v: string) => void;
  concierge: string;
  onConciergeChange: (v: string) => void;
  procedure: string;
  onProcedureChange: (v: string) => void;
  patientType: string;
  onPatientTypeChange: (v: string) => void;
  surgicalApproach: string;
  onSurgicalApproachChange: (v: string) => void;
  payer: string;
  onPayerChange: (v: string) => void;
  billingType: string;
  onBillingTypeChange: (v: string) => void;
  hospital: string;
  onHospitalChange: (v: string) => void;
  indicationSource: string;
  onIndicationSourceChange: (v: string) => void;
  indicationFrom: string;
  onIndicationFromChange: (v: string) => void;
  indicationTo: string;
  onIndicationToChange: (v: string) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
  hideSearch?: boolean;
}

export function FilterBar({
  search, onSearchChange,
  surgeon, onSurgeonChange,
  concierge, onConciergeChange,
  procedure, onProcedureChange,
  patientType, onPatientTypeChange,
  surgicalApproach, onSurgicalApproachChange,
  payer, onPayerChange,
  billingType, onBillingTypeChange,
  hospital, onHospitalChange,
  indicationSource, onIndicationSourceChange,
  indicationFrom, onIndicationFromChange,
  indicationTo, onIndicationToChange,
  onClearAll, hasActiveFilters,
  hideSearch = false,
}: FilterBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {!hideSearch && (
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        )}
        <Select value={surgeon} onValueChange={onSurgeonChange}>
          <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Cirurgião" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos cirurgiões</SelectItem>
            {staffSurgeons.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={concierge} onValueChange={onConciergeChange}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Concierge" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {staffConcierges.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={procedure} onValueChange={onProcedureChange}>
          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Procedimento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos procedimentos</SelectItem>
            {PROCEDURES.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={patientType} onValueChange={onPatientTypeChange}>
          <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="adult">{PATIENT_TYPE_LABELS.adult}</SelectItem>
            <SelectItem value="pediatric">{PATIENT_TYPE_LABELS.pediatric}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={surgicalApproach} onValueChange={onSurgicalApproachChange}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Via cirúrgica" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas vias</SelectItem>
            {SURGICAL_APPROACHES.map((a) => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Select value={payer} onValueChange={onPayerChange}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Convênio" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos convênios</SelectItem>
            {PAYERS.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={billingType} onValueChange={onBillingTypeChange}>
          <SelectTrigger className="w-[170px] h-8 text-xs"><SelectValue placeholder="Faturamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos faturamentos</SelectItem>
            {BILLING_TYPES.map((b) => (<SelectItem key={b} value={b}>{b}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={hospital} onValueChange={onHospitalChange}>
          <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Hospital" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos hospitais</SelectItem>
            {HOSPITALS.map((h) => (<SelectItem key={h} value={h}>{h}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={indicationSource} onValueChange={onIndicationSourceChange}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            {INDICATION_SOURCES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>Indicação:</span>
          <Input
            type="date"
            value={indicationFrom}
            onChange={(e) => onIndicationFromChange(e.target.value)}
            className="h-8 w-[120px] text-xs px-2"
            title="Data de indicação — de"
          />
          <span>até</span>
          <Input
            type="date"
            value={indicationTo}
            onChange={(e) => onIndicationToChange(e.target.value)}
            className="h-8 w-[120px] text-xs px-2"
            title="Data de indicação — até"
          />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={onClearAll}>
            <X className="h-3 w-3 mr-1" /> Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
