-- Design proofs module tables
-- Staff portal owns proof assembly/export; design-tool outputs mockup images used by snapshot_data.

CREATE TABLE IF NOT EXISTS design_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','approved','changes_requested','superseded','archived')),
  current_version_id UUID,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approval_signature_text TEXT,
  approval_signed_by_email TEXT,
  approval_signed_by_name TEXT,
  approval_ip INET,
  archived_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS design_proof_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_id UUID NOT NULL REFERENCES design_proofs(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','approved','changes_requested','superseded')),
  snapshot_data JSONB NOT NULL,
  pdf_storage_path TEXT,
  pdf_generated_at TIMESTAMPTZ,
  change_order_fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  approval_token_hash TEXT UNIQUE,
  approval_token_expires_at TIMESTAMPTZ,
  changes_requested_notes TEXT,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  CONSTRAINT design_proof_versions_unique_number UNIQUE (proof_id, version_number)
);

ALTER TABLE design_proofs
  DROP CONSTRAINT IF EXISTS design_proofs_current_version_fk;

ALTER TABLE design_proofs
  ADD CONSTRAINT design_proofs_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES design_proof_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS design_proofs_org_status_idx
  ON design_proofs (organization_id, status) WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS design_proofs_status_idx
  ON design_proofs (status);

CREATE INDEX IF NOT EXISTS design_proofs_created_by_user_id_idx
  ON design_proofs (created_by_user_id);

CREATE INDEX IF NOT EXISTS design_proof_versions_proof_idx
  ON design_proof_versions (proof_id);

CREATE INDEX IF NOT EXISTS design_proof_versions_token_idx
  ON design_proof_versions (approval_token_hash) WHERE approval_token_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION update_design_proofs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_design_proofs_updated_at ON design_proofs;
CREATE TRIGGER trigger_design_proofs_updated_at
  BEFORE UPDATE ON design_proofs
  FOR EACH ROW
  EXECUTE FUNCTION update_design_proofs_updated_at();
