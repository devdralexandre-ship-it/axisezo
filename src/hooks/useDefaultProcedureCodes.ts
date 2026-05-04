import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CodeItem, OpmeItem, SurgicalRequestData } from '@/data/documents';

export type DefaultScope = 'surgeon' | 'concierge';
export type DefaultKind = 'cbhpm_main' | 'cbhpm_extra' | 'cid' | 'opme';

export interface DefaultCodeRow {
  id: string;
  procedure: string;
  scope: DefaultScope;
  scope_owner: string;
  kind: DefaultKind;
  code: string;
  label: string;
  quantity: number;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DefaultsBundle {
  mainCbhpm: CodeItem | null;
  extraCbhpm: CodeItem[];
  cid: CodeItem[];
  opme: OpmeItem[];
}

const EMPTY: DefaultsBundle = { mainCbhpm: null, extraCbhpm: [], cid: [], opme: [] };

function mergeBundle(rows: DefaultCodeRow[]): DefaultsBundle {
  const seenMain = new Map<string, CodeItem>();
  const seenExtra = new Map<string, CodeItem>();
  const seenCid = new Map<string, CodeItem>();
  const seenOpme = new Map<string, OpmeItem>();

  // surgeon scope first (priority), then concierge
  const ordered = [...rows].sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === 'surgeon' ? -1 : 1;
    return (a.position || 0) - (b.position || 0);
  });

  ordered.forEach((r) => {
    const key = `${r.code}|${r.label}`;
    if (r.kind === 'cbhpm_main') {
      if (!seenMain.has(key)) seenMain.set(key, { code: r.code, label: r.label });
    } else if (r.kind === 'cbhpm_extra') {
      if (!seenExtra.has(key)) seenExtra.set(key, { code: r.code, label: r.label });
    } else if (r.kind === 'cid') {
      if (!seenCid.has(key)) seenCid.set(key, { code: r.code, label: r.label });
    } else if (r.kind === 'opme') {
      const opmeKey = r.label;
      if (!seenOpme.has(opmeKey)) seenOpme.set(opmeKey, { description: r.label, quantity: r.quantity || 1 });
    }
  });

  return {
    mainCbhpm: Array.from(seenMain.values())[0] ?? null,
    extraCbhpm: Array.from(seenExtra.values()),
    cid: Array.from(seenCid.values()),
    opme: Array.from(seenOpme.values()),
  };
}

/** Fetch defaults for a procedure/surgeon/concierge combo, merged with surgeon precedence. */
export function useDefaultProcedureCodes(procedure: string | null | undefined, surgeon: string | null | undefined, concierge: string | null | undefined) {
  return useQuery({
    queryKey: ['procedure_default_codes', procedure, surgeon, concierge],
    enabled: !!procedure,
    queryFn: async (): Promise<DefaultsBundle> => {
      const owners: { scope: DefaultScope; owner: string }[] = [];
      if (surgeon) owners.push({ scope: 'surgeon', owner: surgeon });
      if (concierge) owners.push({ scope: 'concierge', owner: concierge });
      if (owners.length === 0) return EMPTY;

      const orFilters = owners
        .map((o) => `and(scope.eq.${o.scope},scope_owner.eq.${o.owner.replace(/,/g, '\\,')})`)
        .join(',');

      const { data, error } = await supabase
        .from('procedure_default_codes' as any)
        .select('*')
        .eq('procedure', procedure!)
        .or(orFilters);
      if (error) {
        console.warn('useDefaultProcedureCodes', error);
        return EMPTY;
      }
      return mergeBundle((data as any) ?? []);
    },
  });
}

/** List all defaults visible to the current user (for /perfil management). */
export function useMyDefaults(scope: DefaultScope, owner: string | null | undefined) {
  return useQuery({
    queryKey: ['my_defaults', scope, owner],
    enabled: !!owner,
    queryFn: async (): Promise<DefaultCodeRow[]> => {
      const { data, error } = await supabase
        .from('procedure_default_codes' as any)
        .select('*')
        .eq('scope', scope)
        .eq('scope_owner', owner!)
        .order('procedure', { ascending: true })
        .order('kind', { ascending: true })
        .order('position', { ascending: true });
      if (error) throw error;
      return (data as any) ?? [];
    },
  });
}

interface SaveDefaultsInput {
  procedure: string;
  scope: DefaultScope;
  scope_owner: string;
  data: SurgicalRequestData;
}

export function useSaveDefaults() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ procedure, scope, scope_owner, data }: SaveDefaultsInput) => {
      const rows: any[] = [];
      const created_by = user?.id ?? null;

      if (data.mainCbhpm.code || data.mainCbhpm.label) {
        rows.push({ procedure, scope, scope_owner, kind: 'cbhpm_main', code: data.mainCbhpm.code, label: data.mainCbhpm.label, quantity: 1, position: 0, created_by });
      }
      data.extraCbhpm.forEach((c, i) => {
        if (c.code || c.label) rows.push({ procedure, scope, scope_owner, kind: 'cbhpm_extra', code: c.code, label: c.label, quantity: 1, position: i, created_by });
      });
      data.cid.forEach((c, i) => {
        if (c.code || c.label) rows.push({ procedure, scope, scope_owner, kind: 'cid', code: c.code, label: c.label, quantity: 1, position: i, created_by });
      });
      data.opme.forEach((o, i) => {
        if (o.description) rows.push({ procedure, scope, scope_owner, kind: 'opme', code: '', label: o.description, quantity: o.quantity || 1, position: i, created_by });
      });

      if (rows.length === 0) return;

      const { error } = await supabase
        .from('procedure_default_codes' as any)
        .upsert(rows, { onConflict: 'procedure,scope,scope_owner,kind,code,label' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procedure_default_codes'] });
      qc.invalidateQueries({ queryKey: ['my_defaults'] });
    },
  });
}

export function useDeleteDefault() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('procedure_default_codes' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procedure_default_codes'] });
      qc.invalidateQueries({ queryKey: ['my_defaults'] });
    },
  });
}
