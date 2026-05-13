
-- Materials library tables
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK (kind IN ('text','video','pdf')),
  body_html TEXT NOT NULL DEFAULT '',
  content_url TEXT,
  file_path TEXT,
  procedure TEXT,
  surgeon TEXT,
  phase TEXT NOT NULL DEFAULT 'general' CHECK (phase IN ('preop','postop','general')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.material_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  surgeon TEXT,
  phase TEXT NOT NULL DEFAULT 'general' CHECK (phase IN ('preop','postop','general')),
  procedure TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.package_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.material_packages(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  UNIQUE (package_id, material_id)
);

CREATE TABLE public.patient_sent_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.material_packages(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel TEXT NOT NULL DEFAULT 'manual' CHECK (channel IN ('whatsapp','download','manual')),
  notes TEXT,
  sent_by UUID,
  CHECK (material_id IS NOT NULL OR package_id IS NOT NULL)
);

CREATE INDEX idx_materials_procedure ON public.materials(procedure);
CREATE INDEX idx_materials_surgeon ON public.materials(surgeon);
CREATE INDEX idx_materials_phase ON public.materials(phase);
CREATE INDEX idx_package_materials_package ON public.package_materials(package_id);
CREATE INDEX idx_psm_patient ON public.patient_sent_materials(patient_id);

-- Triggers for updated_at
CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_material_packages_updated_at BEFORE UPDATE ON public.material_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_sent_materials ENABLE ROW LEVEL SECURITY;

-- Materials: any authenticated can view; admin/surgeon can manage
CREATE POLICY "Authenticated view materials" ON public.materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/surgeon insert materials" ON public.materials FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon'));
CREATE POLICY "Admin/surgeon update materials" ON public.materials FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon'));
CREATE POLICY "Admin delete materials" ON public.materials FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- Packages: same pattern
CREATE POLICY "Authenticated view packages" ON public.material_packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/surgeon insert packages" ON public.material_packages FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon'));
CREATE POLICY "Admin/surgeon update packages" ON public.material_packages FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon'));
CREATE POLICY "Admin delete packages" ON public.material_packages FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- Package materials: same as packages
CREATE POLICY "Authenticated view package_materials" ON public.package_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/surgeon insert package_materials" ON public.package_materials FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon'));
CREATE POLICY "Admin/surgeon update package_materials" ON public.package_materials FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon'));
CREATE POLICY "Admin/surgeon delete package_materials" ON public.package_materials FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon'));

-- Patient sent materials: scoped via can_access_patient
CREATE POLICY "Scoped select sent materials" ON public.patient_sent_materials FOR SELECT TO authenticated
  USING (can_access_patient(patient_id));
CREATE POLICY "Scoped insert sent materials" ON public.patient_sent_materials FOR INSERT TO authenticated
  WITH CHECK (can_access_patient(patient_id));
CREATE POLICY "Scoped delete sent materials" ON public.patient_sent_materials FOR DELETE TO authenticated
  USING (can_access_patient(patient_id));

-- Storage bucket for materials
INSERT INTO storage.buckets (id, name, public) VALUES ('patient-materials','patient-materials', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated read patient-materials" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'patient-materials');
CREATE POLICY "Admin/surgeon upload patient-materials" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'patient-materials' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon')));
CREATE POLICY "Admin/surgeon update patient-materials" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'patient-materials' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon')));
CREATE POLICY "Admin/surgeon delete patient-materials" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'patient-materials' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon')));
