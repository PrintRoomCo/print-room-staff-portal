-- 007_products_is_b2b_only.sql
-- Applied via mcp__supabase__apply_migration as 20260424_products_is_b2b_only on 2026-04-27.
-- Plan: docs/superpowers/plans/2026-04-24-staff-portal-b2b-catalogues-subapp-plan.md (Task 2).
--
-- Flag for synthetic-master B2B-only items. Default false hides them from the
-- master /products view; the catalogue editor's "+ B2B-only item" creates rows
-- with is_b2b_only=true that render through the existing PDP/cart/checkout path.
-- product_type_activations is intentionally NOT auto-populated for these rows --
-- they are only visible via catalogue scope on /shop.

alter table products
  add column if not exists is_b2b_only boolean not null default false;

create index if not exists products_is_b2b_only_idx
  on products (is_b2b_only) where is_b2b_only;
