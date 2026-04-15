-- Presentations module tables
-- Stores proposal metadata plus ordered reusable sections for client-facing decks

CREATE TABLE IF NOT EXISTS staff_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_brand TEXT NOT NULL,
  proposal_title TEXT NOT NULL,
  season_label TEXT NOT NULL,
  cover_date_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'archived')),
  notes TEXT NOT NULL DEFAULT '',
  template_key TEXT NOT NULL DEFAULT 'print-room-proposal-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_presentation_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES staff_presentations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'cover',
    'brand-intro',
    'brand-context',
    'product-story',
    'product-pricing',
    'product-packaging',
    'supporting-idea',
    'commercial-terms'
  )),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_presentations_staff_user_id
  ON staff_presentations(staff_user_id);

CREATE INDEX IF NOT EXISTS idx_staff_presentations_status
  ON staff_presentations(status);

CREATE INDEX IF NOT EXISTS idx_staff_presentations_updated_at
  ON staff_presentations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_presentation_sections_presentation_id
  ON staff_presentation_sections(presentation_id);

CREATE INDEX IF NOT EXISTS idx_staff_presentation_sections_sort_order
  ON staff_presentation_sections(presentation_id, sort_order);

CREATE OR REPLACE FUNCTION update_staff_presentations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_staff_presentation_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_staff_presentations_updated_at ON staff_presentations;
CREATE TRIGGER trigger_staff_presentations_updated_at
  BEFORE UPDATE ON staff_presentations
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_presentations_updated_at();

DROP TRIGGER IF EXISTS trigger_staff_presentation_sections_updated_at ON staff_presentation_sections;
CREATE TRIGGER trigger_staff_presentation_sections_updated_at
  BEFORE UPDATE ON staff_presentation_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_presentation_sections_updated_at();
