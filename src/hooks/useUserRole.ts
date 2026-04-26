import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'surgeon' | 'concierge' | 'call_center';

export interface UserRoleInfo {
  roles: AppRole[];
  isAdmin: boolean;
  isSurgeon: boolean;
  isConcierge: boolean;
  isCallCenter: boolean;
  surgeonName: string | null;
  conciergeName: string | null;
  displayName: string | null;
  active: boolean;
  /** UI flag: hide monetary values from this user */
  canSeeFinancials: boolean;
}

const EMPTY: UserRoleInfo = {
  roles: [],
  isAdmin: false,
  isSurgeon: false,
  isConcierge: false,
  isCallCenter: false,
  surgeonName: null,
  conciergeName: null,
  displayName: null,
  active: true,
  canSeeFinancials: true,
};

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ['user-role', user?.id],
    enabled: !!user && !authLoading,
    queryFn: async (): Promise<UserRoleInfo> => {
      if (!user) return EMPTY;

      const [rolesRes, profileRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', user.id),
        supabase
          .from('profiles')
          .select('display_name, surgeon_name, concierge_name, active')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      const roles = (rolesRes.data ?? []).map((r) => r.role as AppRole);
      const profile = profileRes.data;

      const isAdmin = roles.includes('admin');
      const isCallCenter = roles.includes('call_center');

      return {
        roles,
        isAdmin,
        isSurgeon: roles.includes('surgeon'),
        isConcierge: roles.includes('concierge'),
        isCallCenter,
        surgeonName: profile?.surgeon_name ?? null,
        conciergeName: profile?.concierge_name ?? null,
        displayName: profile?.display_name ?? null,
        active: profile?.active ?? true,
        // Call center cannot see financial data; everyone else can.
        canSeeFinancials: !isCallCenter,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...(query.data ?? EMPTY),
    loading: authLoading || query.isLoading,
  };
}
