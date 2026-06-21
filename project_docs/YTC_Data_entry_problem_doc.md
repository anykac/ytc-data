

# **1\. Overview & Background**

## **1.1 Problem statement**

Factory production planning is currently tracked in a single Excel/Google Sheets workbook where every working day is stored as its own separate tab. Each tab records target versus actual output across multiple workstations, broken into time periods (P-1 through P-6), capturing model, target, actual, headcount (PAX), and defects.

This structure makes cross-day analysis nearly impossible without manual effort. Station names are spelled inconsistently across tabs, balance figures are buried in free-text note cells, and answering a basic question like “how did this week perform?” requires manually opening and reconciling dozens of tabs. The data is valuable but effectively trapped.

## **1.2 Goal**

Move production tracking off the spreadsheet and into a structured, low-cost web application that preserves the simplicity of the current data-entry experience while unlocking reliable, automated analysis of production throughput, station performance, defect trends, and order completion forecasting. The system should also support production planning at the order-by-model level: when separate orders require the same model, production can be consolidated to optimize output. The same principle applies to the storage of completed products, where multiple orders can share containers. Container usage is planned ahead of time based on the weight and volume constraints of each model and container. 

## **1.3 Guiding constraints**

* Low cost: the system must run at or near $0/month at current data volume, using free tiers.

* Familiar entry: floor operators must fill the same four core fields they fill today — Target, Actual, PAX, Defects — with no added burden.

* Maintainable: the system should be operable without a full-time developer once built.

* Tablet/desktop-friendly: data entry must work on a tablet or desktop computer on the factory floor without app installation. Smartphone support is not required.

## **1.4 Tech stack**

| Layer | Choice | Notes |
| :---- | :---- | :---- |
| **Frontend + API** | Next.js | Single repo for UI and API routes |
| **Hosting** | Vercel (free tier) | Git-push deploy; no server management |
| **Database** | Supabase (Postgres) | Free tier; Row-Level Security enforced at DB layer |
| **Auth** | Supabase Auth | Google OAuth for Supervisors/Admins; per-submission password for Line Leads |
| **Keep-alive** | cron-job.org (free daily ping) | Prevents Supabase free-tier DB from pausing after inactivity |

# **2\. Goals & Success Metrics**

## **2.1 Primary goals**

1. Replace the tab-per-day spreadsheet with a single structured database holding all production records.

2. Provide a simple, mobile-friendly data-entry form for floor operators.

3. Provide an automatic management dashboard for attainment, defects, and order progress.

4. Eliminate inconsistent station naming and free-text balance tracking through structured reference data.

## **2.2 Success metrics**

| Metric | Current | Target |
| :---- | ----- | ----- |
| Time to produce a weekly performance summary | 1–2 hours manual | \< 10 seconds |
| Station name consistency | \~39 variants | 1 per station |
| Data-entry time per period | Baseline | Equal or faster |
| Cross-day / cross-station queries | Not feasible | Instant |
| Monthly platform cost | $0 (Sheets) | $0 |

## **2.3 Out of scope (v1)**

* Real-time machine sensor integration (IoT).

* Automated shift scheduling or labor management.

* Inventory or raw-material tracking.

* Integration with external ERP systems.

# **3\. Users & Roles**

Approximate scale: ~8 stations, 4 supervisors, and a few rotating line leads per day.

| Role | Description | Needs | Primary screens |
| :---- | :---- | :---- | :---- |
| **Line Lead** | Submits and edits period logs (replaces former "Floor operator" and "Line supervisor" roles) | Period logs, review the day's progress, spot stations falling behind | Data entry form, period summary, station view |
| **Supervisor** | Track attainment trends, defects, order completion forecasts, orders, models, and stations | Full dashboard | Dashboard, model/station/order management |
| **Admin** | Account and role management | Setup account authorizations | Account authorizations |

# **5\. Functional Requirements**

## **5.1 Data entry (Line lead)**

*The entry form is the most critical UX surface. If entry is slower than the spreadsheet, adoption fails.*

| ID | Requirement | Priority |
| :---- | :---- | ----- |
| **FR-1.1** | Operator selects station, period (P-1 to P-6), and model from a dropdown populated by the station table, and enters Target output, Actual output, PAX (people on the station), Defects | P0 |
| **FR-1.2** | Model auto-fills based on the day's order plan, with manual override | P1 |
| **FR-1.3** | Submit writes one row of data to the main table | P0 |
| **FR-1.4** | Form works on any computer or mobile browser without app installation | P0 |
| **FR-1.5** | Line leads authenticate via a password field on the entry form (per-submission auth — no session or email login). Each submission is validated server-side against a hashed password stored in the `leads` table. If auth fails, an inline error is shown and nothing is written to the DB. | P0 |
| **FR-1.6** | Edit previous entries, search by Station+Period, and update with the line lead’s credentials. Auth must pass before any edit is recorded — if the password fails, nothing is written. On successful edit, the audit log stores: `edited_by` (authenticated lead’s ID), `edited_at`, previous values, and new values. | P0 |

## **5.2 Dashboard & reporting (Access: Supervisor+)**

| ID | Requirement | Priority |
| :---- | :---- | ----- |
| **FR-2.1** | Daily summary view showing attainment %, variance, defects per day | P0 |
| **FR-2.2** | Station summary ranking stations by attainment to surface bottlenecks | P1 |
| **FR-2.3** | Model progress view with balance remaining and projected completion | P0 |
| **FR-2.4** | Attainment trend chart over time (daily and weekly) | P1 |
| **FR-2.5** | Defect trend and concentration by station and day | P1 |
| **FR-2.6** | Filter all views by date range, station, model, and shift | P1 |
| **FR-2.7** | Export any view to CSV / Excel | P2 |

## **5.3 Supervisor operational (Access: Supervisor+)**

| ID | Requirement | Priority |
| :---- | :---- | ----- |
| **FR-3.1** | Admin can create, edit, and deactivate stations, models, and orders | P0 |
| **FR-3.2** | Admin sets the daily plan: which model each station runs, with targets | P2 |

## **5.4 Admin operational (Access: Admin only)**

| ID | Requirement | Priority |
| :---- | :---- | ----- |
| **FR-4.1** | Setting up role-based access: Line Lead, Supervisor, Admin | P0 |
| **FR-4.2** | Supervisors and Admins authenticate via Google OAuth ("Sign in with Google" through Supabase Auth) — proper session-based login. Note: "Gmail API" in any prior context means Google OAuth, not the Gmail email API. | P0 |

## **5.5 Auth architecture**

| Role | Auth method | Session? |
| :---- | :---- | :---- |
| **Line Lead** | Per-submission password field on the entry form; validated server-side against hashed password in `leads` table | No session — each submission/edit is independently authenticated |
| **Supervisor** | Google OAuth via Supabase Auth | Yes — standard session-based login |
| **Admin** | Google OAuth via Supabase Auth | Yes — standard session-based login |

**YubiKey/FIDO2 (P1 upgrade):** Hardware security tokens for Supervisors are noted as a potential future upgrade if setup budget allows (~$25–50/key one-time cost, no recurring cost).

## **5.6 Data management conventions**

* **Soft deletes:** Stations, models, orders, and leads use an `active` boolean flag rather than hard deletes, so historical `period_log` references remain intact and queryable.

* **Historical data migration:** Import of historical spreadsheet data is P1 scope (not required at P0 launch).

# **6\. Non-Functional Requirements**

* **Cost:** Operate at $0/month at current volume (well under 50k rows/day).

* **Performance:** Entry form submits in under 5 seconds; dashboard views load in under 10 seconds (flexible as long as it works).

* **Availability:** Prevent shutdown if service has a downtime log, should be generally available and access maintained

* **Device support:** Data entry is used on tablets and desktop computers on the factory floor. Smartphone support is not required; tablet browser support is required.

* **Usability:** Entry form usable on a tablet or with light computer work; no training beyond a one-page guide.

* **Data integrity:** Foreign-key constraints enforced at the database level; no orphan period\_log rows.

* **Security:** Row-level security; operators write, managers read, admins manage. Generally databases should not be publicly accessible. Do not expose our claude access tokens or google cloud API tokens at any point.

