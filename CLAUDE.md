# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

**YTC Data Entry** — a factory production tracking web app replacing a tab-per-day spreadsheet. Operators log target/actual/PAX/defects per station per period; supervisors get a dashboard with attainment, pipeline WIP, and order progress.

## Key Documents

Always read these before making implementation decisions:

| File | Purpose |
|---|---|
| `project_docs/YTC_implementation_plan.md` | **Start here.** Milestone-by-milestone task breakdown with code, tests, and CLI commands. Dev assignments: 🔵 Anyka (infra/auth/entry form) and 🟢 Ryo (admin UI/dashboard). |
| `project_docs/YTC_Data_entry_tech_spec.md` | Tech spec — stack, auth design, data model, key screens, security, P0 scope, and verification plan. |
| `project_docs/YTC_Data_entry_problem_doc.md` | PRD — problem statement, goals, success metrics, functional requirements with P0/P1/P2 priorities. |

## Stack

- **Frontend + API:** Next.js (App Router, server actions)
- **Hosting:** Vercel (free tier)
- **Database + Auth:** Supabase (Postgres + Auth + RLS)
- **Keep-alive:** cron-job.org daily ping to `/api/ping`

## Roles

- **Line Lead** — submits/edits period logs via per-submission password (no session)
- **Supervisor** — dashboard + admin via Google OAuth session
- **Admin** — account/role management via Google OAuth session

## Git & PR Workflow

**All code changes must go through a PR — never commit directly to `main`.**

This applies to every task, including small fixes. Both developers (Anyka and Ryo) follow the same flow.

### Starting work on a task

1. Make sure local `main` is up to date with GitHub before branching:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Create a feature branch named after the milestone/task:
   ```bash
   git checkout -b feature/m2-auth-layer
   ```
   Use kebab-case: `feature/m3-entry-form`, `feature/m4-admin-crud`, `feature/m5-dashboard`, etc.

### During work

Commit frequently to the feature branch — one commit per logical step is fine. Never commit to `main`.

### When the task is complete

1. Push the branch to GitHub:
   ```bash
   git push -u origin feature/m2-auth-layer
   ```
2. Create a PR using the GitHub CLI (use PowerShell — `gh` is not available in Bash on this machine):
   ```powershell
   $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
   gh pr create --title "M2: Auth Layer" --base main --head feature/m2-auth-layer --body "..."
   ```
3. **Tell the developer:** "PR is ready for review at `<URL>`. Share the link with your collaborator before merging."
4. **Do not merge the PR yourself.** Wait for the developer to confirm review is done.

### After the PR is merged on GitHub

Pull `main` locally so the next branch starts from the merged state:
```bash
git checkout main
git pull origin main
```

### Branch naming convention

| Milestone | Branch name |
|---|---|
| M1 | `feature/m1-scaffold-database` |
| M2 | `feature/m2-auth-layer` |
| M3 | `feature/m3-entry-form` |
| M4 | `feature/m4-admin-crud` |
| M5 | `feature/m5-dashboard` |
| M6 | `feature/m6-deploy` |
| Hotfixes | `fix/short-description` |

---

## Living Documentation Rules

- **After completing any task:** check it off in `project_docs/YTC_implementation_plan.md` (mark the `- [ ]` steps as `- [x]`).
- **If understanding of requirements, design, or data model changes:** update `project_docs/YTC_Data_entry_tech_spec.md` and/or `project_docs/YTC_Data_entry_problem_doc.md` to reflect the current truth before continuing.
- These docs are the source of truth — keep them current, not the conversation history.

## P0 MVP Scope

Entry form, edit + audit log, daily summary dashboard, model progress view, pipeline view, stations/models/orders/leads CRUD, RBAC, Google OAuth for Supervisor/Admin. See tech spec section 10 for the full P0 list and what is deferred to P1/P2.
