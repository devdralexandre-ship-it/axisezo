import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'surgeon' | 'concierge' | 'call_center' | 'intern';

export type Capability =
  | 'view_financials'
  | 'edit_financials'
  | 'edit_clinical'
  | 'move_pipeline'
  | 'delete_patients'
  | 'assigned_only'
  | 'generate_documents'
  | 'manage_templates'
  | 'manage_library'
  | 'import_csv'
  | 'view_dashboard'
  | 'manage_users';

export const ALL_CAPABILITIES: Capability[] = [
  'view_financials', 'edit_financials',
  'edit_clinical', 'move_pipeline', 'delete_patients', 'assigned_only',
  'generate_documents', 'manage_templates', 'manage_library',
  'import_csv', 'view_dashboard', 'manage_users',
];

export type CapsMap = Partial<Record<Capability, boolean>>;

export interface UserRoleInfo {
  roles: AppRole[];
  isAdmin: boolean;
  isSurgeon: boolean;
  isConcierge: boolean;
  isCallCenter: boolean;
  isIntern: boolean;
  surgeonName: string | null;
  conciergeName: string | null;
  displayName: string | null;
  active: boolean;
  caps: CapsMap;
  can: (cap: Capability) => boolean;
  /** UI flag: hide monetary values from this user */
  canSeeFinancials: boolean;
}

const EMPTY: UserRoleInfo = {
  roles: [],
  isAdmin: false,
  isSurgeon: false,
  isConcierge: false,
  isCallCenter: false,
  isIntern: false,
  surgeonName: null,
  conciergeName: null,
  displayName: null,
  active: true,
  caps: {},
  can: () => false,
  canSeeFinancials: false,
};

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ['user-role', user?.id],
    enabled: !!user && !authLoading,
    queryFn: async (): Promise<UserRoleInfo> => {
      if (!user) return EMPTY;

      const [rolesRes, profileRes, capsRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', user.id),
        supabase
          .from('profiles')
          .select('display_name, surgeon_name, concierge_name, active')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('user_capabilities')
          .select('caps')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      const roles = (rolesRes.data ?? []).map((r) => r.role as AppRole);
      const profile = profileRes.data;
      const caps = (capsRes.data?.caps ?? {}) as CapsMap;

      const isAdmin = roles.includes('admin');
      const can = (cap: Capability) => isAdmin || !!caps[cap];

      return {
        roles,
        isAdmin,
        isSurgeon: roles.includes('surgeon'),
        isConcierge: roles.includes('concierge'),
        isCallCenter: roles.includes('call_center'),
        isIntern: roles.includes('intern'),
        surgeonName: profile?.surgeon_name ?? null,
        conciergeName: profile?.concierge_name ?? null,
        displayName: profile?.display_name ?? null,
        active: profile?.active ?? true,
        caps,
        can,
        canSeeFinancials: can('view_financials'),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...(query.data ?? EMPTY),
    loading: authLoading || query.isLoading,
  };
}
