-- 005_product_tag_catalog.sql
-- Autocomplete source for the tag picker. Rows are otherwise created lazily
-- by the API on product save when an unknown name is submitted. This seed
-- pass only backfills the catalog from any staff tags that survived the 004
-- strip (e.g. 'leavers', 'design-tool'), so autocomplete works on day one.

begin;

create table if not exists product_tag_catalog (
  name        text primary key,
  created_at  timestamptz not null default now(),
  created_by  uuid references staff_users(id) on delete set null
);

insert into product_tag_catalog (name)
select distinct t
from products, unnest(tags) as t
where platform = 'uniforms'
  and t is not null
  and length(trim(t)) > 0
on conflict (name) do nothing;

commit;
