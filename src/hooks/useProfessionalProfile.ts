import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ProfessionalProfile {
  id?: string;
  user_id: string;
  crm: string;
  crm_uf: string;
  rqe: string;
  signature_title: string;
  phone_professional: string;
  email_professional: string;
}

const EMPTY: Omit<ProfessionalProfile, 'user_id'> = {
  crm: '',
  crm_uf: '',
  rqe: '',
  signature_title: '',
  phone_professional: '',
  email_professional: '',
};

/** Loads the professional profile of the currently logged-in user (or a target user). */
export function useProfessionalProfile(targetUserId?: string) {
  const { user } = useAuth();
  const userId = targetUserId ?? user?.id ?? null;

  return useQuery({
    queryKey: ['professional_profile', userId],
    enabled: !!userId,
    queryFn: async (): Promise<ProfessionalProfile> => {
      const { data, error } = await supabase
        .from('professional_profiles' as any)
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? { user_id: userId!, ...EMPTY };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Loads professional profile by surgeon display name (looks up via profiles.surgeon_name). */
export function useProfessionalProfileBySurgeonName(surgeonName: string | null | undefined) {
  return useQuery({
    queryKey: ['professional_profile_by_surgeon', surgeonName],
    enabled: !!surgeonName,
    queryFn: async (): Promise<Omit<ProfessionalProfile, 'user_id'> & { user_id: string | null }> => {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('surgeon_name', surgeonName!)
        .maybeSingle();
      if (!profileRow?.user_id) return { user_id: null, ...EMPTY };
      const { data: prof } = await supabase
        .from('professional_profiles' as any)
        .select('*')
        .eq('user_id', profileRow.user_id)
        .maybeSingle();
      return (prof as any) ?? { user_id: profileRow.user_id, ...EMPTY };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveProfessionalProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: Omit<ProfessionalProfile, 'user_id' | 'id'>) => {
      if (!user) throw new Error('Não autenticado');
      const { data: existing } = await supabase
        .from('professional_profiles' as any)
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from('professional_profiles' as any)
          .update(payload as any)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('professional_profiles' as any)
          .insert({ user_id: user.id, ...payload } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['professional_profile'] });
      qc.invalidateQueries({ queryKey: ['professional_profile_by_surgeon'] });
      toast.success('Perfil profissional salvo');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}
