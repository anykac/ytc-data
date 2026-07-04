# YTC Data Entry — Technical Specification

> **Companion to:** `YTC_Data_entry_problem_doc.md` (PRD)
> **Last updated:** 2026-07-03
> **Status:** Draft — pending implementation plan

---

## 1. Stack & Hosting

| Layer | Choice | Free tier limits (relevant) |
|---|---|---|
| **Frontend + API** | Next.js (App Router) | — |
| **Hosting** | Vercel | 100 GB bandwidth/mo, hobby plan |
| **Database** | Supabase (Postgres) | 500 MB DB, 50k MAU |
| **Auth** | Supabase Auth | Google OAuth for Supervisor/Admin |
| **Keep-alive** | cron-job.org daily ping | Free, prevents Supabase DB pause after 7 days inactivity |

One repo, one Vercel deployment. Supabase handles the database, auth sessions, and row-level security. Next.js server actions handle all DB writes — credentials never reach the browser.

---

## 2. Architecture

```
Browser (tablet / desktop)
         │
         ▼
    Next.js on Vercel
    ┌──────────────────────────────────┐
    │  /app                            │
    │   ├── /entry        (Line Lead)  │
    │   ├── /dashboard    (Supervisor+)│
    │   └── /admin        (Supervisor+)│
    │                                  │
    │  Server Actions (all DB writes)  │
    └─────────────────┬────────────────┘
                      │
                      ▼
             Supabase (Postgres)
             ├── Auth (Google OAuth sessions)
             ├── Row-Level Security policies
             └── Tables (see section 4)

    cron-job.org ──► GET /api/ping ──► Vercel (daily, keeps Supabase awake)
```

---

## 3. Auth Design

Two separate auth paths by role:

### 3.1 Line Leads — per-submission password

- No login page, no session, no cookie.
- The entry form includes a **Lead name dropdown** and **Password field**.
- On submit, a Next.js server action:
  1. Looks up the lead record by name in the `leads` table.
  2. Compares the submitted password against `password_hash` (bcrypt).
  3. If match → writes the `period_log` row tagged with `submitted_by = lead.id`.
  4. If no match → returns an error; **nothing is written**.
- Same flow applies to edits: password must pass before any `period_log_edits` row is written.
- Leads are created and passwords are set/reset by Supervisors in the Admin panel.

### 3.2 Supervisors & Admins — Google OAuth session

- Standard Supabase Auth Google OAuth flow ("Sign in with Google").
- Session cookie managed by `@supabase/ssr`.
- Role stored in a `user_roles` table linked to `auth.uid`.
- All dashboard and admin routes check the session and role server-side before rendering.

### 3.3 Future: YubiKey / FIDO2 (P1)

Hardware security tokens for Supervisors are a candidate upgrade if setup budget allows (~$25–50/key, no recurring cost).

---

## 4. Data Model

### Tables

```sql
-- Customers (independent production flows, e.g. Meanwell, Martindale)
customers (id, name TEXT, active BOOL)

-- Reference data — each station/model belongs to exactly one customer
stations (id, name, sequence INT, active BOOL, customer_id → customers)
  UNIQUE (customer_id, sequence)  -- sequence is scoped per customer's flow, not global
models   (id, name, active BOOL, customer_id → customers)

-- Per-model station routing (which stations a model flows through)
-- Invariant (app-enforced, not a DB constraint): model.customer_id must equal station.customer_id
model_station_config (model_id, station_id, active BOOL)
  PRIMARY KEY (model_id, station_id)

-- Orders & line items — an order belongs to exactly one customer (immutable after creation);
-- line items must reference models of that same customer (app-enforced, not a DB constraint)
orders      (id, order_number TEXT, order_date DATE, due_date DATE, active BOOL, customer_id → customers)
order_lines (id, order_id, model_id, quantity INT, active BOOL)

-- Line lead credentials
leads (id, name TEXT, password_hash TEXT, active BOOL)

-- Supervisor / Admin role assignments (linked to Supabase auth.uid)
user_roles (id, user_id UUID, role TEXT)  -- role: 'supervisor' | 'admin'

-- Production logs
period_log (
  id, date DATE, period TEXT,   -- period: 'P1'–'P6' | 'OT' (Overtime)
  station_id, model_id,
  target INT, actual INT, pax INT, defects INT,
  submitted_by,                 -- leads.id
  created_at TIMESTAMPTZ
)

-- Edit audit trail
period_log_edits (
  id, period_log_id,
  edited_by,                    -- leads.id
  edited_at TIMESTAMPTZ,
  prev_target INT, new_target INT,
  prev_actual INT, new_actual INT,
  prev_pax    INT, new_pax    INT,
  prev_defects INT, new_defects INT
)
```

### Key design decisions

- **`period_log` tracks `model_id`, not `order_line_id`.** Multiple orders can consolidate production of the same model on the line simultaneously. Order progress is computed at the model level (see section 5.3).
- **Soft deletes everywhere.** `active = false` hides records from dropdowns and new entries without breaking historical FK references.
- **No unique constraint on `(date, period, station_id, model_id)`.** Models can change mid-period, producing multiple rows for the same station+period. The server warns on duplicates but allows after user confirmation.
- **`defects` cannot exceed `actual`.** A defect count greater than the actual output is physically impossible. Enforced at three layers: HTML `max` attribute on the client (caps the Defects input at the current Actual value), server action validation (rejects before any DB write), and a DB-level `CHECK (defects <= actual)` constraint on `period_log`.
- **Station sequencing.** `stations.sequence` defines the linear production flow. Output of station N = available input to station N+1 (1:1 unit ratio).
- **Customer scoping.** Every `stations`, `models`, and `orders` row belongs to exactly one customer (`customer_id`). Meanwell and Martindale run fully independent flows with their own model lineups, assembly-step sequences, and orders — `stations.sequence` is unique per customer, not globally, so both customers can have a station numbered `1`. The entry form's Customer selector filters Station/Model dropdowns accordingly (see 6.1); the admin Stations/Models/Orders screens filter by the same Customer tabs, and an order's line items are restricted to models of its own customer. Real production data collected to date is entirely Meanwell; Martindale's stations/models/orders are configured fresh via Admin CRUD (FR-3.5).

---

## 5. Key Computed Metrics

| Metric | Formula |
|---|---|
| Attainment % | `actual / target × 100` |
| Variance | `actual − target` |
| WIP between stations N−1 → N | `SUM(actual WHERE station = N−1) − SUM(actual WHERE station = N)` (same model, same date range) — unit backlog sitting between two steps |
| Gap to goal | `target of station N − actual of station N` for the current period — how far behind this station is vs its own target, contextualised against upstream output to show whether the gap is self-caused or supply-constrained |
| Model demand | `SUM(order_lines.quantity WHERE model_id = X AND order active)` |
| Model produced | `SUM(period_log.actual WHERE model_id = X)` |
| Balance remaining | Model demand − Model produced |

All metrics are computed at query time — not stored.

---

## 6. Key Screens & UX Flows

### 6.1 Entry Form (Line Lead)

No login required. Form is accessible directly at `/entry`.

```
┌──────────────────────────────┐
│  YTC Production Log          │
│                              │
│  Customer  (•) Meanwell      │
│            ( ) Martindale    │
│                              │
│  Station   [dropdown]        │
│  Period    [P1–P6, OT]       │
│  Model     [dropdown]        │
│                              │
│  Target    [number]          │
│  Actual    [number]          │
│  PAX       [number]          │
│  Defects   [number]          │
│                              │
│  Your name [dropdown]        │
│  Password  [field]           │
│                              │
│  [Submit]                    │
│                              │
│  ⚠ Wrong password — not saved│  ← inline error, nothing written
│  ⚠ Entry exists — confirm?   │  ← duplicate warning with confirm/cancel
│  ✓ Submitted successfully    │  ← success, form resets
└──────────────────────────────┘
```

Selecting a Customer filters the Station and Model dropdowns to that customer's own reference data (`customer_id` match) and resets any previously selected Station/Model, since the prior selection may no longer be valid for the new customer. Defaults to Meanwell on load, matching current operator behavior.

**Edit flow:** "Edit previous entry" link → search by Station + Period → list of matching rows → select → pre-filled form → password re-auth → save (writes `period_log_edits` row). Unchanged by customer scoping — search is by station, which is already customer-specific.

### 6.2 Dashboard (Supervisor+ — session required)

Four tab-switched views:

**Daily Summary**
- Date picker (defaults to today)
- Table: Station | Target | Actual | Attainment % | Variance | Defects

**Pipeline View**
- Stations listed in sequence order
- Per station: attainment %, WIP into this station, gap-to-goal indicator
- Highlights stations that are starving or overfeeding the next step

**Model Progress**
- One row per active order-model combination (if a model appears in two orders, two rows), sorted by `due_date`
- Each model name is a link to the Order-Model Step Tracker for that order + model
- Columns: Order # | Model | Ordered | Produced | Balance remaining | Due date

**Order-Model Step Tracker** (reached by clicking a model row in Model Progress)
- Shows step-by-step production progress for a specific model within a specific order
- URL: `/dashboard/progress/[orderId]/[modelId]`
- **Steps table (left panel)** — one row per station the model flows through, ordered by sequence:
  - *Step* — station name
  - *Cumulative Output* — total actual units produced at this step for this model (all time)
  - *Active Inputs* — units that completed the previous step but have not yet been processed by this step (WIP = prev-step cumulative output − this-step cumulative output); `—` for the first step
  - *Order Attainment %* — Cumulative Output ÷ Order Quantity × 100
- **Chart (right panel)** — displayed when a step row is selected, rendered with Recharts `ComposedChart`:
  - Line series: cumulative output over time (date axis)
  - Bar series: actual output per period at this step
  - Bar series: active inputs (WIP into this step) per date
- Charting library: `recharts` — install with `npm install recharts`

**Full Data Report** (FR-2.9)
- Date range picker (start/end), defaults to the current calendar month
- Raw `period_log` rows for the range, grouped visually by date; within each date sorted by period then station sequence
- Columns: Date | Period | Station | Model | Target | Actual | PAX | Defects | Submitted By | Submitted At | Edited (flag, no full diff)
- "Export CSV" button converts the rows already loaded on screen to a CSV string client-side and triggers a browser download — no separate export endpoint, no re-query
- Reuses the existing `period_log` / `period_log_edits` SELECT policies (Supervisor/Admin) — no new RLS policy required

### 6.3 Admin (Supervisor+)

Five management tables (create / edit / deactivate):
- **Customers** — name, active
- **Stations** — name, sequence (scoped per customer), active, customer
- **Models** — name, active, customer, station config (model_station_config, restricted to stations of the same customer)
- **Orders** — order number, order date, due date, customer (scoped, immutable after creation — line items must be models of the same customer), line items (model + quantity)
- **Leads** — name, set/reset password, active

**Edit History** (read-only audit log, distinct from the four CRUD tables above)
- Date range picker (start/end), defaults to the current calendar month, filters by `period_log_edits.edited_at` (when the edit happened, not the production date of the entry that was edited)
- One row per edit, sorted by `edited_at` descending (newest first) — a flat log, not grouped by date
- Columns: Edited At | Editor | Entry (date · period · station · model) | Target | Actual | PAX | Defects
- Target/Actual/PAX/Defects always render `prev → new`; visually highlighted only when the value actually changed
- Reuses the existing `period_log_edits` SELECT policy (Supervisor/Admin) — no new RLS policy required

### 6.4 Account Management (Admin only)

- Invite Supervisors/Admins via Google OAuth (Supabase Auth invite flow)
- Manage role assignments (`user_roles` table)

---

## 7. Security

### 7.1 Row-Level Security (Supabase RLS)

All dashboard and admin tables are gated by Supabase RLS policies keyed on `auth.uid()` and the `user_roles` table:

| Table | Line Lead | Supervisor | Admin |
|---|---|---|---|
| `period_log` | INSERT via server action (no session) | SELECT | SELECT |
| `period_log_edits` | INSERT via server action | SELECT | SELECT |
| `customers`, `stations`, `models`, `orders`, `order_lines` | SELECT (dropdowns) | SELECT + INSERT + UPDATE | SELECT + INSERT + UPDATE |
| `leads` | — | SELECT + INSERT + UPDATE | SELECT + INSERT + UPDATE |
| `user_roles` | — | — | Full access |

Line lead writes bypass RLS using the Supabase **service role key** (server-side only, never exposed to the browser). The server action validates the password before invoking the service role.

### 7.2 Secrets

- `SUPABASE_SERVICE_ROLE_KEY` — server-side only, never in client bundles
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — safe for browser (RLS enforces limits)
- Google OAuth credentials — stored in Supabase Auth dashboard, not in the repo
- No secrets committed to git

---

## 8. Error Handling

| Scenario | Behaviour |
|---|---|
| Wrong lead password | Inline error: "Incorrect password — submission not recorded." Nothing written. |
| Duplicate `(date, period, station, model)` | Warning prompt: "An entry already exists for this combination. Submit anyway?" Proceed only on explicit confirmation. |
| Form validation failure (missing field, non-numeric) | Inline field errors before submission attempt. |
| Defects exceed actual output | Client blocks submission (Defects field `max` = current Actual value). Server action also rejects with "Defects cannot exceed actual output." DB CHECK constraint provides final guard. |
| Supabase write failure | Generic error: "Submission failed — please try again." Entry not recorded. |
| Session expired (Supervisor/Admin) | Redirect to login page. |
| Unauthorised route access | Redirect to login or 403 page based on role check. |
| Full Data Report: invalid range (start > end, or malformed date) | Inline validation error; query not run. |
| Full Data Report: no rows in range | Empty state: "No entries found for this date range." |
| Full Data Report: query failure | Generic "Failed to load report — please try again." |
| Edit History: invalid range (start > end, or malformed date) | Inline validation error; query not run. |
| Edit History: no edits in range | Empty state: "No edits found for this date range." |
| Edit History: query failure | Generic "Failed to load edit history — please try again." |

---

## 9. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Monthly cost | $0 (Vercel + Supabase free tiers) |
| Entry form submit latency | < 5 seconds |
| Dashboard load time | < 10 seconds |
| Device support | Tablet + desktop browsers; no smartphone required |
| Availability | Generally available; keep-alive cron prevents Supabase pause |
| Usability | One-page guide sufficient for floor operators |
| Data integrity | FK constraints at DB level; no orphan `period_log` rows |

---

## 10. P0 Scope (MVP)

### In scope
- Entry form with per-submission lead auth (FR-1.1, FR-1.3, FR-1.4, FR-1.5)
- Edit previous entries with audit log (FR-1.6)
- Daily summary dashboard (FR-2.1)
- Model progress view — model-level, sorted by due date (FR-2.3)
- Pipeline view with gap-to-goal (implied by station sequencing design)
- **Order + model filter on Daily Summary and Pipeline views** (FR-2.6) — required because multi-model days produce meaningless aggregated attainment figures without it. Order selector scopes to the models in that order; model selector drills down within it. Note: because `period_log` stores `model_id` not `order_id`, "filter by order" means "show only models belonging to this order" — production shared across overlapping orders for the same model cannot be split at the log level.
- **Full Data Report tab** (FR-2.9) — raw `period_log` entries for a supervisor-selected date range, grouped by date, with edited-entry flagging and CSV export of the loaded range. Pulled forward from the original P2 CSV-export item because raw-entry visibility/export is needed before the rest of P2. Distinct from FR-2.8 below, which covers exporting the aggregated Daily Summary / Pipeline / Model Progress views themselves.
- **Order-Model Step Tracker** — per-step progress table and chart for a specific order+model combination, accessible by clicking a model row in the Model Progress view. Shows cumulative output, active inputs (WIP), and order attainment % per station; chart displays cumulative output (line), per-period output (bar), and active inputs (bar) for the selected step.
- Stations / models / orders / leads CRUD (FR-3.1, FR-3.3)
- **Customer-scoped stations & models** (FR-1.1, FR-3.5) — `customers` table; `customer_id` on `stations`/`models`/`orders`; per-customer station sequence; Customer selector on the entry form filtering Station/Model dropdowns, with server-side validation that the submitted station and model share a customer. All landed in M3 (T3.5), including the Customer selector on the Stations/Models/Orders admin screens — M4 had already shipped without customer awareness by the time T3.5 was implemented, so that admin work was pulled forward rather than left as a separate M4 follow-up. `orders` also gained a `customer_id` (not part of the original design) once manual testing showed orders need the same per-customer scoping, since an order's line items are all models from a single customer. A standalone Customers CRUD page (create/rename/deactivate customer records) was not built; the two customers are seeded directly.
- **Edit History admin page** (FR-3.4) — read-only log of every edit recorded under FR-1.6, date-range filtered by when the edit happened, newest first, with entry context, editor, and prev/new values per field
- RBAC setup — Line Lead, Supervisor, Admin (FR-4.1)
- Google OAuth for Supervisor/Admin (FR-4.2)
- Keep-alive cron

### Deferred to P1
- Model auto-fill from daily plan (FR-1.2)
- Station attainment ranking (FR-2.2)
- Trend charts and defect concentration (FR-2.4, FR-2.5)
- Filter by date range, station, and shift (FR-2.7)
- Daily plan targets per station (FR-3.2)
- Historical spreadsheet data import
- Per-order-line production attribution

### Deferred to P2
- CSV / Excel export of the Daily Summary / Pipeline / Model Progress views themselves (FR-2.8) — the Full Data Report tab's raw-entry CSV export (FR-2.9) is in P0; this item is about exporting the aggregated views
- Automated daily plan setup (FR-3.2)
- YubiKey / FIDO2 auth upgrade

---

## 11. Verification

End-to-end test plan for P0:

1. **Entry form** — submit a log entry as a line lead; confirm row appears in `period_log` with correct `submitted_by`.
2. **Auth failure** — submit with wrong password; confirm no row is written and inline error is shown.
3. **Duplicate warning** — submit same (date, period, station, model) twice; confirm warning appears on second submission.
4. **Edit + audit log** — edit an existing entry; confirm `period_log_edits` row is created with correct `edited_by`, old/new values.
5. **Daily summary** — log entries for multiple stations; confirm attainment %, variance, and defects display correctly.
6. **Model progress** — create an order with two line items; log production for both models; confirm balance remaining updates correctly; confirm each row shows the correct order number.
7. **Pipeline view** — log production for sequential stations; confirm WIP and gap-to-goal reflect actual vs upstream output.
7a. **Order-Model Step Tracker** — click a model row in Model Progress; confirm step table shows correct cumulative output, active inputs, and order attainment % per station; select a step and confirm chart renders with correct line and bar series.
8. **Admin CRUD** — create a station, model, order, and lead; confirm they appear in dropdowns; deactivate one; confirm it disappears from dropdowns but historical logs remain intact.
8b. **Customer scoping** — select Martindale on the entry form; confirm Station/Model dropdowns show only Martindale's reference data; switch back to Meanwell and confirm the prior selection is cleared; attempt a submission with a crafted mismatched station/model pair and confirm the server action rejects it.
8a. **Edit History** — edit an entry with two changed fields and one unchanged; confirm it appears in `/admin/edit-history` with correct editor, entry context, and prev/new values (changed fields highlighted, unchanged fields plain); narrow the date range to exclude the edit and confirm it disappears.
9. **Role gating** — confirm a line lead cannot access `/dashboard` or `/admin`; confirm a Supervisor can access both but not `/admin/accounts`.
10. **Keep-alive** — confirm the `/api/ping` endpoint returns 200 and that cron-job.org is configured to hit it daily.
