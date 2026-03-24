
-- Enums
CREATE TYPE public.pipeline_stage AS ENUM (
  'indication', 'first_contact', 'budget_preparation', 'budget_sent',
  'decision_pending', 'followup_negotiation', 'preop_preparation',
  'surgery_scheduled', 'surgery_completed', 'lost'
);

CREATE TYPE public.decision_status AS ENUM ('waiting', 'thinking', 'negotiating', 'confirmed');

CREATE TYPE public.loss_reason AS ENUM ('price', 'delay', 'clinical_contraindication', 'chose_another', 'other');

CREATE TYPE public.contact_type AS ENUM ('phone', 'whatsapp', 'email', 'in_person');

CREATE TYPE public.app_role AS ENUM ('admin', 'surgeon', 'concierge', 'call_center');

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Patients table
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  procedure_name TEXT NOT NULL,
  procedure_category TEXT DEFAULT '',
  surgeon TEXT NOT NULL,
  concierge TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT 'Call Center',
  stage pipeline_stage NOT NULL DEFAULT 'indication',
  stage_entered_at DATE NOT NULL DEFAULT CURRENT_DATE,
  decision_status decision_status NOT NULL DEFAULT 'waiting',
  estimated_value NUMERIC,
  last_interaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  next_follow_up_date DATE,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  indication_date DATE,
  indication_location TEXT,
  payer TEXT,
  contact_reference TEXT,
  desired_hospital TEXT,
  notes TEXT,
  loss_reason loss_reason,
  loss_reason_detail TEXT,
  special_flag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  due_time TIME NOT NULL DEFAULT '10:00',
  responsible TEXT NOT NULL DEFAULT 'Call Center',
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tasks_patient_id ON public.tasks(patient_id);

-- Contact records (follow-up timeline)
CREATE TABLE public.contact_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  contact_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type contact_type NOT NULL DEFAULT 'phone',
  note TEXT NOT NULL DEFAULT '',
  by_whom TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_contact_records_patient_id ON public.contact_records(patient_id);

-- Pre-op checklist items
CREATE TABLE public.preop_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(patient_id, item_key)
);

ALTER TABLE public.preop_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_preop_checklist_updated_at
  BEFORE UPDATE ON public.preop_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_preop_checklist_patient_id ON public.preop_checklist_items(patient_id);

-- RLS Policies

-- user_roles: admins can do all, users can read their own
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- patients: all authenticated users can CRUD (role-based filtering later)
CREATE POLICY "Authenticated users can view patients"
  ON public.patients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert patients"
  ON public.patients FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update patients"
  ON public.patients FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete patients"
  ON public.patients FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- tasks
CREATE POLICY "Authenticated users can view tasks"
  ON public.tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert tasks"
  ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update tasks"
  ON public.tasks FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete tasks"
  ON public.tasks FOR DELETE TO authenticated USING (true);

-- contact_records
CREATE POLICY "Authenticated users can view contacts"
  ON public.contact_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert contacts"
  ON public.contact_records FOR INSERT TO authenticated WITH CHECK (true);

-- preop_checklist_items
CREATE POLICY "Authenticated users can view checklist"
  ON public.preop_checklist_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert checklist"
  ON public.preop_checklist_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update checklist"
  ON public.preop_checklist_items FOR UPDATE TO authenticated USING (true);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
