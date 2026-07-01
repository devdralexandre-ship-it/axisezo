import { supabase } from '@/integrations/supabase/client';

export type SuggestionKind = 'cbhpm' | 'cid' | 'opme';

export interface CodeSuggestionEntry {
  kind: SuggestionKind;
  value: string;
  label: string;
}

/**
 * Records CBHPM/CID/OPME entries as suggestions bound to a procedure.
 * Increments usage_count for existing rows so the most-used codes bubble
 * to the top of the autocomplete list. Fire-and-forget: never throws.
 */
export async function recordProcedureCodeSuggestions(
  procedure: string,
  entries: CodeSuggestionEntry[],
): Promise<void> {
  if (!procedure) return;
  const cleaned = entries.filter((e) => (e.value && e.value.trim()) || (e.label && e.label.trim()));
  for (const it of cleaned) {
    try {
      const { data: existing } = await supabase
        .from('procedure_code_suggestions' as any)
        .select('id,usage_count')
        .eq('procedure', procedure)
        .eq('kind', it.kind)
        .eq('value', it.value ?? '')
        .maybeSingle();
      if (existing) {
        await supabase
          .from('procedure_code_suggestions' as any)
          .update({
            usage_count: ((existing as any).usage_count || 0) + 1,
            last_used_at: new Date().toISOString(),
            label: it.label,
          })
          .eq('id', (existing as any).id);
      } else {
        await supabase
          .from('procedure_code_suggestions' as any)
          .insert({ procedure, kind: it.kind, value: it.value ?? '', label: it.label ?? '' });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[recordProcedureCodeSuggestions] failed for', it, e);
    }
  }
}
