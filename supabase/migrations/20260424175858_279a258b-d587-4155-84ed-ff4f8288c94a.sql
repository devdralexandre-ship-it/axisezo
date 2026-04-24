ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'html',
  ADD COLUMN IF NOT EXISTS pdf_template_path text,
  ADD COLUMN IF NOT EXISTS content_box jsonb,
  ADD COLUMN IF NOT EXISTS signature_box jsonb,
  ADD COLUMN IF NOT EXISTS continuation_strategy text NOT NULL DEFAULT 'same_page';

ALTER TABLE public.document_templates
  DROP CONSTRAINT IF EXISTS document_templates_mode_check;
ALTER TABLE public.document_templates
  ADD CONSTRAINT document_templates_mode_check CHECK (mode IN ('html','pdf'));

ALTER TABLE public.document_templates
  DROP CONSTRAINT IF EXISTS document_templates_continuation_check;
ALTER TABLE public.document_templates
  ADD CONSTRAINT document_templates_continuation_check CHECK (continuation_strategy IN ('same_page','second_page','blank'));