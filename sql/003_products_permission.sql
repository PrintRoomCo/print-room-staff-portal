-- One-off: grant the new 'products' permission to seed admins.
-- The application accepts 'products' OR 'products:write' on staff_users.permissions.
-- Run manually via the Supabase SQL editor as a logged-in service user.

UPDATE staff_users
SET permissions = (
  SELECT jsonb_agg(DISTINCT value)
  FROM jsonb_array_elements_text(permissions || '["products"]'::jsonb) AS value
)
WHERE role IN ('admin', 'super_admin');

-- v1.1 follow-up: add CHECK constraint on products.tags
-- ALTER TABLE products
--   ADD CONSTRAINT products_tags_allowed
--   CHECK (tags <@ ARRAY['workwear','preorder','b2b','leavers','design-tool']::text[]);
