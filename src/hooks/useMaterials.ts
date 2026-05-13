import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type MaterialKind = 'text' | 'video' | 'pdf';
export type MaterialPhase = 'preop' | 'postop' | 'general';

export interface Material {
  id: string;
  title: string;
  description: string;
  kind: MaterialKind;
  body_html: string;
  content_url: string | null;
  file_path: string | null;
  procedure: string | null;
  surgeon: string | null;
  phase: MaterialPhase;
  created_at: string;
  updated_at: string;
}

export interface MaterialPackage {
  id: string;
  name: string;
  description: string;
  surgeon: string | null;
  procedure: string | null;
  phase: MaterialPhase;
  created_at: string;
  updated_at: string;
}

export interface PackageMaterial {
  id: string;
  package_id: string;
  material_id: string;
  order_index: number;
}

export interface PatientSentMaterial {
  id: string;
  patient_id: string;
  material_id: string | null;
  package_id: string | null;
  sent_at: string;
  channel: 'whatsapp' | 'download' | 'manual';
  notes: string | null;
}

const MATERIALS_BUCKET = 'patient-materials';

// ===== Materials =====

export function useMaterials() {
  return useQuery({
    queryKey: ['materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials' as any)
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Material[];
    },
  });
}

export function useSaveMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Partial<Material>) => {
      const payload: any = {
        title: m.title,
        description: m.description ?? '',
        kind: m.kind,
        body_html: m.body_html ?? '',
        content_url: m.content_url || null,
        file_path: m.file_path || null,
        procedure: m.procedure || null,
        surgeon: m.surgeon || null,
        phase: m.phase ?? 'general',
      };
      if (m.id) {
        const { error } = await supabase.from('materials' as any).update(payload).eq('id', m.id);
        if (error) throw error;
        return m.id;
      } else {
        const { data: u } = await supabase.auth.getUser();
        payload.created_by = u.user?.id ?? null;
        const { data, error } = await supabase.from('materials' as any).insert(payload).select('id').single();
        if (error) throw error;
        return (data as any).id as string;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials'] });
      toast.success('Material salvo');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar material'),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('materials' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials'] });
      toast.success('Material excluído');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao excluir'),
  });
}

export async function uploadMaterialPdf(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'pdf';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(MATERIALS_BUCKET).upload(path, file, {
    contentType: file.type || 'application/pdf',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function getMaterialFileUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(MATERIALS_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

// ===== Packages =====

export function usePackages() {
  return useQuery({
    queryKey: ['material_packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_packages' as any)
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as MaterialPackage[];
    },
  });
}

export function usePackageMaterials(packageId: string | null) {
  return useQuery({
    queryKey: ['package_materials', packageId],
    queryFn: async () => {
      if (!packageId) return [];
      const { data, error } = await supabase
        .from('package_materials' as any)
        .select('*')
        .eq('package_id', packageId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as PackageMaterial[];
    },
    enabled: !!packageId,
  });
}

export function useAllPackageMaterials() {
  return useQuery({
    queryKey: ['package_materials_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('package_materials' as any)
        .select('*')
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as PackageMaterial[];
    },
  });
}

export function useSavePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pkg, materialIds }: { pkg: Partial<MaterialPackage>; materialIds: string[] }) => {
      const payload: any = {
        name: pkg.name,
        description: pkg.description ?? '',
        surgeon: pkg.surgeon || null,
        procedure: pkg.procedure || null,
        phase: pkg.phase ?? 'general',
      };
      let id = pkg.id;
      if (id) {
        const { error } = await supabase.from('material_packages' as any).update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        payload.created_by = u.user?.id ?? null;
        const { data, error } = await supabase.from('material_packages' as any).insert(payload).select('id').single();
        if (error) throw error;
        id = (data as any).id;
      }
      // Replace package_materials
      await supabase.from('package_materials' as any).delete().eq('package_id', id);
      if (materialIds.length > 0) {
        const rows = materialIds.map((mid, idx) => ({ package_id: id, material_id: mid, order_index: idx }));
        const { error: insErr } = await supabase.from('package_materials' as any).insert(rows);
        if (insErr) throw insErr;
      }
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['material_packages'] });
      qc.invalidateQueries({ queryKey: ['package_materials_all'] });
      toast.success('Pacote salvo');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar pacote'),
  });
}

export function useDeletePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('material_packages' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['material_packages'] });
      toast.success('Pacote excluído');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao excluir'),
  });
}

// ===== Patient sent materials =====

export function usePatientSentMaterials(patientId: string | null) {
  return useQuery({
    queryKey: ['patient_sent_materials', patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .from('patient_sent_materials' as any)
        .select('*')
        .eq('patient_id', patientId)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PatientSentMaterial[];
    },
    enabled: !!patientId,
  });
}

export function useMarkSent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      materialId,
      packageId,
      channel = 'manual',
      notes,
    }: {
      patientId: string;
      materialId?: string | null;
      packageId?: string | null;
      channel?: 'whatsapp' | 'download' | 'manual';
      notes?: string;
    }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('patient_sent_materials' as any).insert({
        patient_id: patientId,
        material_id: materialId ?? null,
        package_id: packageId ?? null,
        channel,
        notes: notes ?? null,
        sent_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['patient_sent_materials', vars.patientId] });
      toast.success('Marcado como enviado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao registrar envio'),
  });
}

// ===== Suggestion (client-side) =====

export function suggestForPatient(
  materials: Material[],
  packages: MaterialPackage[],
  patient: { procedure?: string | null; surgeon?: string | null; stage?: string | null },
) {
  const proc = patient.procedure || '';
  const surg = patient.surgeon || '';
  const score = (m: { procedure: string | null; surgeon: string | null }) => {
    let s = 0;
    if (m.procedure && proc && m.procedure === proc) s += 3;
    if (m.surgeon && surg && m.surgeon === surg) s += 2;
    if (!m.procedure) s += 1; // generic procedure
    return s;
  };
  const sortedMaterials = [...materials].sort((a, b) => score(b) - score(a));
  const sortedPackages = [...packages].sort((a, b) => score(b) - score(a));
  return { materials: sortedMaterials, packages: sortedPackages };
}
