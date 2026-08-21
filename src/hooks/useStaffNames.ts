import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SURGEONS, CONCIERGES } from '@/data/constants';

/**
 * Operational names (surgeon / concierge) of active users, read from the
 * database so new hires show up everywhere without a code change.
 * The hardcoded lists remain as a fallback / base set.
 */
export function useStaffNames() {
  const query = useQuery({
    queryKey: ['staff-names'],
    staleTime: 30 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('staff_names');
      if (error) throw error;
      return (data ?? []) as { surgeon_name: string | null; concierge_name: string | null }[];
    },
  });


  const rows = query.data ?? [];
  const merge = (base: readonly string[], values: (string | null)[]) => {
    const out = [...base];
    values.forEach((v) => {
      const name = (v ?? '').trim();
      if (name && !out.includes(name)) out.push(name);
    });
    return out;
  };

  return {
    surgeons: merge(SURGEONS, rows.map((r) => r.surgeon_name)),
    concierges: merge(CONCIERGES, rows.map((r) => r.concierge_name)),
    loading: query.isLoading,
  };
}
