import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

interface FilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  surgeon: string;
  onSurgeonChange: (v: string) => void;
  concierge: string;
  onConciergeChange: (v: string) => void;
  surgeons: string[];
  concierges: string[];
}

export function FilterBar({
  search, onSearchChange,
  surgeon, onSurgeonChange,
  concierge, onConciergeChange,
  surgeons, concierges,
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
          {surgeons.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={concierge} onValueChange={onConciergeChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Concierge" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos concierges</SelectItem>
          {concierges.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
