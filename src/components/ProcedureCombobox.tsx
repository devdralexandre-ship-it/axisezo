import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { PROCEDURES } from '@/data/constants';

const OTHER_PROCEDURE = '__outro__';

interface Props {
  value: string;
  /** Called when the user selects a known procedure. */
  onSelect: (v: string) => void;
  /** Called when user selects "Outro..." */
  onSelectOther?: () => void;
  placeholder?: string;
  compact?: boolean;
}

export function ProcedureCombobox({ value, onSelect, onSelectOther, placeholder = 'Selecione o procedimento', compact }: Props) {
  const [open, setOpen] = useState(false);
  const isOther = value === OTHER_PROCEDURE;
  const display = isOther ? 'Outro...' : (value || '');
  const triggerCls = compact ? 'h-8 text-sm' : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', triggerCls, !display && 'text-muted-foreground')}
        >
          <span className="truncate">{display || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder="Buscar procedimento..." />
          <CommandList>
            <CommandEmpty>Nenhum procedimento encontrado.</CommandEmpty>
            <CommandGroup>
              {PROCEDURES.map((p) => (
                <CommandItem
                  key={p}
                  value={p}
                  onSelect={() => { onSelect(p); setOpen(false); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === p ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{p}</span>
                </CommandItem>
              ))}
              <CommandItem
                key="__outro__"
                value="Outro procedimento personalizado"
                onSelect={() => { onSelectOther?.(); setOpen(false); }}
              >
                <Check className={cn('mr-2 h-4 w-4', isOther ? 'opacity-100' : 'opacity-0')} />
                <span className="italic text-muted-foreground">Outro...</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
