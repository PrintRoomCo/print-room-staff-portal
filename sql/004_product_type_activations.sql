-- 004_product_type_activations.sql
-- Create the channel junction table, backfill from products.tags, and strip
-- channel values out of products.tags so the column is free for open-vocab
-- staff tags. All in one transaction so rollback is atomic.
--
-- Scope: platform = 'uniforms' only (per spec §5.2).
-- Idempotent: each statement uses ON CONFLICT DO NOTHING or is filter-guarded,
-- so re-running after a partial failure is safe.

begin;

create table if not exists product_type_activations (
  product_id    uuid not null references products(id) on delete cascade,
  product_type  text not null check (product_type in ('workwear','preorder','b2b')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (product_id, product_type)
);

create index if not exists product_type_activations_product_type_idx
  on product_type_activations (product_type) where is_active;

-- Seed junction rows from the channel values currently in products.tags.
-- Only uniforms rows; backfilled rows default to is_active = true.
insert into product_type_activations (product_id, product_type, is_active)
select p.id, t.tag, true
from products p
cross join lateral unnest(p.tags) as t(tag)
where p.platform = 'uniforms'
  and t.tag in ('workwear','preorder','b2b')
on conflict (product_id, product_type) do nothing;

-- Strip channel values from products.tags so the column only carries
-- open-vocab staff tags from here on. Uniforms only.
update products
set tags = array(
  select t from unnest(tags) as t
  where t not in ('workwear','preorder','b2b')
)
where platform = 'uniforms'
  and tags && array['workwear','preorder','b2b'];

commit;
