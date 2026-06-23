import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns distinct task titles ever used, ordered by frequency (most used first).
 * Used as autocomplete suggestions in the task form across all entry points.
 */
export function useTaskTitleSuggestions() {
  return useQuery({
    queryKey: ['task-title-suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('title')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const freq = new Map<string, number>();
      (data ?? []).forEach((row: any) => {
        const t = (row.title || '').trim();
        if (!t) return;
        freq.set(t, (freq.get(t) || 0) + 1);
      });
      return Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([title]) => title);
    },
    staleTime: 30_000,
  });
}
