# Customer-Scoped Stations & Models for Entry Form

**Date:** 2026-07-03
**Milestone:** M3 (Entry Form)
**Status:** Approved — ready for implementation planning

## Problem

The entry form currently treats `stations` and `models` as flat, global reference tables shared across all production. In reality the factory runs two customers — Meanwell and Martindale — each with its own model lineup and its own distinct assembly-step flow (a model's stations differ by customer). Customer identity is currently only present as free text baked into some station names (e.g. `"INSERTION (Meanwell)A"`), which isn't queryable or enforceable.

This spec covers:
1. Adding a first-class `customers` concept to the schema.
2. Scoping `stations` and `models` to a customer.
3. Adding a Customer toggle to the entry form that filters the Station and Model dropdowns.
4. A migration/rollout plan, since real production data already exists (all currently Meanwell).
5. A handoff plan for the M4 admin "station plan" screens (not built in this PR).

Out of scope for this PR: removing/changing the `target` field (kept as-is), `orders`/`order_lines` customer scoping, `EditEntryDrawer` customer filtering, and building the M4 admin CRUD screens themselves.

## A. Data model changes

New table, mirroring the existing `stations`/`models` pattern:

```sql
CREATE TABLE customers (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name   TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true
);
```

Changes to existing tables:

```sql
ALTER TABLE stations ADD COLUMN customer_id UUID REFERENCES customers(id);
ALTER TABLE models   ADD COLUMN customer_id UUID REFERENCES customers(id);
```

After backfill (see rollout below), both columns become `NOT NULL`. `stations` also gets a new constraint reflecting that sequence is now scoped per customer's flow, not global:

```sql
ALTER TABLE stations ADD CONSTRAINT stations_customer_sequence_unique UNIQUE (customer_id, sequence);
```

(No such uniqueness constraint exists today on `stations.sequence`, so this is a pure addition.)

`model_station_config` is unchanged structurally — it remains the join table for which stations a given model routes through. We add an **application-level invariant**, not a DB trigger: a row in `model_station_config` is only valid if `models.customer_id = stations.customer_id` for that pair. This is enforced wherever `model_station_config` rows are written (future M4 admin UI) and is not re-litigated in this PR since the UI for it doesn't exist yet.

`period_log` is untouched — no `customer_id` column added there. Customer is always derivable via `station_id` or `model_id`, and both must already agree by the time a row is written (enforced in the server action, see below).

RLS policies for `customers` mirror the existing pattern:

```sql
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_select" ON customers FOR SELECT USING (true);
CREATE POLICY "customers_modify" ON customers FOR ALL    USING (get_user_role() IN ('supervisor','admin'));
```

## B. Entry form UX + validation

- `app/entry/page.tsx` fetches `customers` (active only, ordered by name) alongside stations/models/leads. Station and model queries now select `customer_id` too.
- `EntryForm` (`components/entry/EntryForm.tsx`):
  - `FormState` gains `customerId: string`, defaulted to the Meanwell customer's id so existing operators see no change in default behavior.
  - New radio group for Customer, rendered as the first field (above Date/Period) since it scopes every field below it.
  - Station and Model `<select>` option lists are derived via `useMemo`, filtered to `customer_id === form.customerId`.
  - Changing the customer radio resets `stationId` and `modelId` to `''`, since the previously selected option may no longer be in the visible list.
  - `Station`/`Model` local types gain `customer_id: string`.
- `actions/entry.ts` → `submitEntry`: after auth, before insert, fetch the submitted `stationId` and `modelId` rows and verify their `customer_id` values match each other. If they don't, return `{ status: 'error', message: '...' }`. This is a trust-boundary check per the project's implementation standards — the UI filter alone doesn't protect against a stale or crafted client payload.
- `EditEntryDrawer` is left as-is. It searches by station directly, so no new customer ambiguity is introduced there. Adding a customer filter to it is a possible future nice-to-have, not required by this change.

## C. Rollout plan

**Migration** — new file `supabase/migrations/<timestamp>_customer_scoping.sql`:

1. Create `customers` table + RLS policies.
2. Add `customer_id` (nullable) to `stations` and `models`.
3. Insert two rows into `customers`: `Meanwell`, `Martindale`.
4. Backfill: `UPDATE stations/models SET customer_id = <meanwell_id>` for all existing rows (matches reality — all current production data is Meanwell).
5. Set both `customer_id` columns `NOT NULL`.
6. Add `UNIQUE (customer_id, sequence)` on `stations`.

**Dev seed** (`supabase/dev-seed.sql`): update existing seed stations/models to reference the Meanwell customer id, and add a small set of sample Martindale stations/models so the customer toggle is actually exercisable end-to-end in dev, rather than switching to an empty second option.

**Explicitly deferred to M4 (admin UI, Ryo's side)** — noted here as a handoff, not built in this PR:
- Admin CRUD screen for `customers` (name, active).
- Extending the future Stations CRUD screen with a Customer selector and per-customer sequence input — this is the actual "station plan" tool for laying out Meanwell's and Martindale's flows independently.
- Extending the future Models CRUD screen with a Customer selector.
- A Model-Station Config admin UI that only allows associating a model with stations sharing its customer (enforcing the invariant from section A).

**Testing plan:**
- Regression: existing Meanwell flow behaves identically (same default customer, same stations/models visible, same submit behavior).
- Toggling to Martindale shows only Martindale stations/models in the dropdowns.
- Submitting a crafted payload with mismatched customer station/model ids is rejected by `submitEntry` with an error, not silently written.
- The `UNIQUE (customer_id, sequence)` constraint allows the same sequence number to be reused across different customers (e.g. both customers can have a station numbered `1`) but rejects a duplicate within the same customer.
