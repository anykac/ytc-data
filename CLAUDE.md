# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

**YTC Data Entry** — a factory production tracking web app replacing a tab-per-day spreadsheet. Operators log target/actual/PAX/defects per station per period; supervisors get a dashboard with attainment, pipeline WIP, and order progress.

## Key Documents

Always read these before making implementation decisions:

| File | Purpose |
|---|---|
| `project_docs/YTC_Data_entry_tech_spec.md` | **Primary reference.** Stack, auth design, data model, key screens, security, P0 scope, and verification plan. Start here. |
| `project_docs/YTC_Data_entry_problem_doc.md` | PRD — problem statement, goals, success metrics, functional requirements with P0/P1/P2 priorities, and non-functional requirements. |

## Stack

- **Frontend + API:** Next.js (App Router, server actions)
- **Hosting:** Vercel (free tier)
- **Database + Auth:** Supabase (Postgres + Auth + RLS)
- **Keep-alive:** cron-job.org daily ping to `/api/ping`

## Roles

- **Line Lead** — submits/edits period logs via per-submission password (no session)
- **Supervisor** — dashboard + admin via Google OAuth session
- **Admin** — account/role management via Google OAuth session

## P0 MVP Scope

Entry form, edit + audit log, daily summary dashboard, model progress view, pipeline view, stations/models/orders/leads CRUD, RBAC, Google OAuth for Supervisor/Admin. See tech spec section 10 for the full P0 list and what is deferred to P1/P2.
