-- 006_products_markup_multiplier.sql
-- Applied via mcp__supabase__apply_migration as 20260424_products_markup_multiplier on 2026-04-27.
-- Plan: docs/superpowers/plans/2026-04-24-staff-portal-b2b-catalogues-subapp-plan.md (Task 1).
--
-- Adds products.markup_multiplier numeric(6,3) NOT NULL DEFAULT 1.0, backfills from
-- existing markup_pct, and installs a bidirectional sync trigger so middleware-pr
-- (which writes markup_pct) and new code (which writes markup_multiplier) stay in
-- lockstep until middleware-pr is decommissioned (sub-app #1 §9).
--
-- Per execution-time finding: get_unit_price was NOT rewritten (live function reads
-- neither markup column today; rewrite would have been a no-op). See plan Task 1
-- "Option 1" decision in execution log.

alter table products
  add column if not exists markup_multiplier numeric(6,3);

update products
   set markup_multiplier = round(1 + coalesce(markup_pct, 0) / 100.0, 3)
 where markup_multiplier is null;

alter table products alter column markup_multiplier set default 1.0;
alter table products alter column markup_multiplier set not null;

create or replace function sync_products_markup() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT')
     or (new.markup_pct is distinct from old.markup_pct
         and new.markup_multiplier is not distinct from old.markup_multiplier) then
    new.markup_multiplier := round(1 + coalesce(new.markup_pct, 0) / 100.0, 3);
  end if;
  if (tg_op = 'INSERT')
     or (new.markup_multiplier is distinct from old.markup_multiplier
         and new.markup_pct is not distinct from old.markup_pct) then
    new.markup_pct := round((coalesce(new.markup_multiplier, 1) - 1) * 100.0, 2);
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_products_markup on products;
create trigger trg_sync_products_markup
  before insert or update of markup_pct, markup_multiplier on products
  for each row execute function sync_products_markup();
