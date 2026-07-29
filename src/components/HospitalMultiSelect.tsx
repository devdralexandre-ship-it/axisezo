import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, X, Plus } from 'lucide-react';
import { HOSPITALS } from '@/data/constants';

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Multi-select para "Hospitais Desejados".
 * Lista os hospitais conhecidos como checkboxes e permite adicionar hospitais custom via input.
 */
export function HospitalMultiSelect({ value, onChange, placeholder = 'Selecione hospitais', className }: Props) {
  const [custom, setCustom] = useState('');
  const known = HOSPITALS as readonly string[];

  const toggle = (h: string) => {
    if (value.includes(h)) onChange(value.filter((x) => x !== h));
    else onChange([...value, h]);
  };
  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setCustom('');
  };
  const remove = (h: string) => onChange(value.filter((x) => x !== h));

  return (
    <div className={className}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between h-auto min-h-9 py-1.5 px-3 font-normal"
          >
            <span className="flex flex-wrap gap-1 items-center text-left">
              {value.length === 0 ? (
                <span className="text-muted-foreground text-sm">{placeholder}</span>
              ) : (
                value.map((h) => (
                  <Badge key={h} variant="secondary" className="text-[11px] gap-1 pr-1">
                    {h}
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); remove(h); }}
                      className="hover:text-destructive cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </Badge>
                ))
              )}
            </span>
            <ChevronDown className="h-4 w-4 opacity-60 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-3" align="start">
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {known.map((h) => (
              <label key={h} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={value.includes(h)}
                  onCheckedChange={() => toggle(h)}
                />
                <span>{h}</span>
              </label>
            ))}
            {value.filter((h) => !known.includes(h)).map((h) => (
              <label key={h} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked onCheckedChange={() => toggle(h)} />
                <span className="italic">{h}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t flex gap-2">
            <Input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addCustom(); }
              }}
              placeholder="Outro hospital…"
              className="h-8 text-sm"
            />
            <Button type="button" size="sm" onClick={addCustom} className="h-8">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
