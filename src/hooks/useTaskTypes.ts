import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TaskType {
  id: string;
  name: string;
  maxHours: number;
  defaultToleranceHours: number;
  active: boolean;
  position: number;
}

function mapRow(r: any): TaskType {
  return {
    id: r.id,
    name: r.name,
    maxHours: r.max_hours,
    defaultToleranceHours: r.default_tolerance_hours,
    active: r.active,
    position: r.position,
  };
}

/** All task types (including inactive) — used by the admin screen. */
export function useAllTaskTypes() {
  return useQuery({
    queryKey: ['task-types', 'all'],
    queryFn: async (): Promise<TaskType[]> => {
      const { data, error } = await supabase
        .from('task_types')
        .select('*')
        .order('position', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []).map(mapRow);
    },
    staleTime: 5 * 60_000,
  });
}

/** Active task types — used by the action form. */
export function useTaskTypes() {
  const q = useAllTaskTypes();
  return { ...q, data: (q.data || []).filter((t) => t.active) };
}

export function useUpsertTaskType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Partial<TaskType> & { name: string }) => {
      const payload: any = {
        name: t.name.trim(),
        max_hours: t.maxHours ?? 48,
        default_tolerance_hours: t.defaultToleranceHours ?? 24,
        active: t.active ?? true,
        position: t.position ?? 100,
      };
      if (t.id) {
        const { error } = await supabase.from('task_types').update(payload).eq('id', t.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('task_types').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-types'] });
      toast.success('Tipo de ação salvo!');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}

export function useDeleteTaskType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-types'] });
      toast.success('Tipo de ação removido.');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}
