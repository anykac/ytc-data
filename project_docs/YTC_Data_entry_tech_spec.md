# YTC Data Entry — Technical Specification

> **Companion to:** `YTC_Data_entry_problem_doc.md` (PRD)
> **Last updated:** 2026-06-21
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
-- Reference data
stations (id, name, sequence INT, active BOOL)
models   (id, name, active BOOL)

-- Per-model station routing (which stations a model flows through)
model_station_config (model_id, station_id, active BOOL)
  PRIMARY KEY (model_id, station_id)

-- Orders & line items
orders      (id, order_number TEXT, order_date DATE, due_date DATE, active BOOL)
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

**Edit flow:** "Edit previous entry" link → search by Station + Period → list of matching rows → select → pre-filled form → password re-auth → save (writes `period_log_edits` row).

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
- Active order lines grouped by model, sorted by `due_date`
- Columns: Model | Total ordered | Total produced | Balance remaining | Due date

**Full Data Report** (FR-2.9)
- Date range picker (start/end), defaults to the current calendar month
- Raw `period_log` rows for the range, grouped visually by date; within each date sorted by period then station sequence
- Columns: Date | Period | Station | Model | Target | Actual | PAX | Defects | Submitted By | Submitted At | Edited (flag, no full diff)
- "Export CSV" button converts the rows already loaded on screen to a CSV string client-side and triggers a browser download — no separate export endpoint, no re-query
- Reuses the existing `period_log` / `period_log_edits` SELECT policies (Supervisor/Admin) — no new RLS policy required

### 6.3 Admin (Supervisor+)

Four management tables (create / edit / deactivate):
- **Stations** — name, sequence, active
- **Models** — name, active, station config (model_station_config)
- **Orders** — order number, order date, due date, line items (model + quantity)
- **Leads** — name, set/reset password, active

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
| `stations`, `models`, `orders`, `order_lines` | SELECT (dropdowns) | SELECT + INSERT + UPDATE | SELECT + INSERT + UPDATE |
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
- Stations / models / orders / leads CRUD (FR-3.1, FR-3.3)
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
6. **Model progress** — create an order with two line items; log production for both models; confirm balance remaining updates correctly.
7. **Pipeline view** — log production for sequential stations; confirm WIP and gap-to-goal reflect actual vs upstream output.
8. **Admin CRUD** — create a station, model, order, and lead; confirm they appear in dropdowns; deactivate one; confirm it disappears from dropdowns but historical logs remain intact.
9. **Role gating** — confirm a line lead cannot access `/dashboard` or `/admin`; confirm a Supervisor can access both but not `/admin/accounts`.
10. **Keep-alive** — confirm the `/api/ping` endpoint returns 200 and that cron-job.org is configured to hit it daily.
