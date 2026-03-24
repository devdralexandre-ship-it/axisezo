import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { PROCEDURES } from '@/data/constants';
import { PATIENT_TYPE_LABELS } from '@/data/constants';
import { SURGICAL_APPROACHES, SURGEONS, CONCIERGES } from '@/data/constants';

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
}

export function FilterBar({
  search, onSearchChange,
  surgeon, onSurgeonChange,
  concierge, onConciergeChange,
  procedure, onProcedureChange,
  patientType, onPatientTypeChange,
  surgicalApproach, onSurgicalApproachChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar paciente..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={surgeon} onValueChange={onSurgeonChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Cirurgião" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos cirurgiões</SelectItem>
          {SURGEONS.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={concierge} onValueChange={onConciergeChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Concierge" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {CONCIERGES.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={procedure} onValueChange={onProcedureChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Procedimento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos procedimentos</SelectItem>
          {PROCEDURES.map((p) => (
            <SelectItem key={p} value={p}>{p}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={patientType} onValueChange={onPatientTypeChange}>
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos tipos</SelectItem>
          <SelectItem value="adult">{PATIENT_TYPE_LABELS.adult}</SelectItem>
          <SelectItem value="pediatric">{PATIENT_TYPE_LABELS.pediatric}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={surgicalApproach} onValueChange={onSurgicalApproachChange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Via cirúrgica" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas vias</SelectItem>
          {SURGICAL_APPROACHES.map((a) => (
            <SelectItem key={a} value={a}>{a}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
