import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { normalizeText } from '@/lib/utils';

export type SuggestionKind = 'cbhpm' | 'cid' | 'opme';

interface Suggestion {
  value: string;
  label: string;
  usage_count: number;
}

interface Props {
  procedure: string;
  kind: SuggestionKind;
  value: string;
  label: string;
  onChange: (value: string, label: string) => void;
  valuePlaceholder?: string;
  labelPlaceholder?: string;
  /** When true the value (code) input is hidden — for OPME free-text. */
  hideValue?: boolean;
}

export function CodeAutocomplete({
  procedure,
  kind,
  value,
  label,
  onChange,
  valuePlaceholder = 'Código',
  labelPlaceholder = 'Descrição',
  hideValue = false,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [focusedField, setFocusedField] = useState<'value' | 'label' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!procedure) {
      setSuggestions([]);
      return;
    }
    let canceled = false;
    (async () => {
      const { data } = await supabase
        .from('procedure_code_suggestions' as any)
        .select('value,label,usage_count')
        .eq('procedure', procedure)
        .eq('kind', kind)
        .order('usage_count', { ascending: false })
        .limit(20);
      if (!canceled) setSuggestions((data as any) ?? []);
    })();
    return () => { canceled = true; };
  }, [procedure, kind]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const query = normalizeText(focusedField === 'value' ? value : label);
  const filtered = suggestions.filter((s) => {
    if (!query) return true;
    return normalizeText(s.value).includes(query) || normalizeText(s.label).includes(query);
  }).slice(0, 8);

  return (
    <div ref={containerRef} className="relative flex gap-2">
      {!hideValue && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value, label)}
          onFocus={() => { setOpen(true); setFocusedField('value'); }}
          placeholder={valuePlaceholder}
          className="h-8 text-sm w-32"
        />
      )}
      <Input
        value={label}
        onChange={(e) => onChange(value, e.target.value)}
        onFocus={() => { setOpen(true); setFocusedField('label'); }}
        placeholder={labelPlaceholder}
        className="h-8 text-sm flex-1"
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-md max-h-60 overflow-y-auto">
          {filtered.map((s, i) => (
            <button
              key={`${s.value}-${i}`}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center justify-between gap-2"
              onClick={() => {
                onChange(s.value, s.label);
                setOpen(false);
              }}
            >
              <span className="min-w-0 truncate">
                {!hideValue && s.value && <span className="font-mono text-xs text-muted-foreground mr-2">{s.value}</span>}
                <span>{s.label}</span>
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">×{s.usage_count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
