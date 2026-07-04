# YTC Data Entry — P0 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Code samples are starting points, not production code.** Apply the implementation standards in `CLAUDE.md` on top of every sample — input validation, error handling, and exhaustive auth conditions are always required regardless of what the sample shows.

**Goal:** Build the P0 MVP — a mobile-friendly production log entry form, daily summary + pipeline + model-progress dashboard, and admin CRUD — on Next.js + Supabase + Vercel with per-submission lead auth and Google OAuth for supervisors/admins.

**Architecture:** Next.js 15 App Router, single repo deployed to Vercel. Supabase holds Postgres + Auth (Google OAuth for Supervisor/Admin) + Row-Level Security. Line leads authenticate per-submission via bcrypt server-side using the service role key — no session created. Supervisors/Admins get a full Google OAuth session via `@supabase/ssr`. All DB writes go through Next.js server actions; credentials never reach the browser.

**Tech Stack:** Next.js 15 (App Router, TypeScript, Tailwind CSS), Supabase (Postgres + Auth + RLS), Vercel, bcryptjs, Jest + ts-jest

---

## Global Constraints

- Next.js 15 App Router only — no Pages Router patterns
- TypeScript strict mode — no `any` without comment
- All DB writes use the **service role key** server-side only — never in `NEXT_PUBLIC_*` vars or client bundles
- Use `bcryptjs` (not native `bcrypt`) — works without native bindings in Node and Edge
- Tailwind CSS for styling — no external UI framework required, use freely for speed
- `.env.local` for secrets — never commit to git; commit `.env.example` with placeholder values
- Supabase free tier: stay under 500 MB DB storage, 50k MAU
- Soft deletes only — never `DELETE` from `stations`, `models`, `orders`, `order_lines`, `leads`; set `active = false`
- Valid periods: `'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'OT'` — OT is the Overtime period, logged after P6 on days when the shift runs long (enforced at DB level)
- **Migration required:** `supabase/migrations/20260621000000_initial_schema.sql` has `CHECK (period IN ('P1','P2','P3','P4','P5','P6'))` — a new migration must add `'OT'` to this constraint before the entry form and server actions can accept it
- Valid roles: `'supervisor' | 'admin'` (line leads are in `leads` table, not `auth.users`)

---

## Dev Assignment Key

- 🔵 **Anyka** — infrastructure, auth, server actions, entry form (UI tightly coupled to auth/security flow)
- 🟢 **Ryo** — admin UI, dashboard queries (DA territory), dashboard views

Tasks can run in parallel after **M1 and M2 are complete**.

---

## File Map

```
├── supabase/
│   ├── migrations/20260621000000_initial_schema.sql   🔵 Full schema + RLS
│   └── seed.sql                                        🔵 Dev seed data
├── types/
│   └── database.ts                                     🔵 Supabase-generated types
├── lib/
│   ├── supabase/
│   │   ├── client.ts                                   🔵 Browser client
│   │   ├── server.ts                                   🔵 Server client (SSR cookies)
│   │   └── admin.ts                                    🔵 Service role client
│   ├── auth/
│   │   ├── lead-auth.ts                                🔵 bcrypt validation + hashing
│   │   └── session.ts                                  🔵 requireSession, requireRole helpers
│   └── db/
│       └── dashboard.ts                                🟢 getDailySummary, getPipelineData, getModelProgress
├── actions/
│   ├── entry.ts                                        🔵 submitEntry, editEntry, searchEntries
│   └── admin.ts                                        🔵 upsertStation, upsertModel, upsertOrder, upsertLead, setUserRole
├── middleware.ts                                        🔵 Route protection by role
├── app/
│   ├── layout.tsx                                      🟢 Root layout
│   ├── page.tsx                                        🟢 Root redirect
│   ├── login/page.tsx                                  🔵 Google OAuth login page
│   ├── api/
│   │   ├── auth/callback/route.ts                      🔵 OAuth callback
│   │   └── ping/route.ts                               🔵 Keep-alive endpoint
│   ├── entry/page.tsx                                  🟢 Entry form page (server shell)
│   ├── dashboard/
│   │   ├── layout.tsx                                  🟢 Auth guard layout
│   │   ├── page.tsx                                    🟢 Daily summary page
│   │   ├── pipeline/page.tsx                           🟢 Pipeline view page
│   │   └── progress/page.tsx                           🟢 Model progress page
│   └── admin/
│       ├── layout.tsx                                  🟢 Auth guard layout
│       ├── stations/page.tsx                           🟢 Stations CRUD
│       ├── models/page.tsx                             🟢 Models CRUD
│       ├── orders/page.tsx                             🟢 Orders CRUD
│       ├── leads/page.tsx                              🟢 Leads CRUD
│       └── accounts/page.tsx                           🟢 User role management (admin only)
├── components/
│   ├── entry/
│   │   ├── EntryForm.tsx                               🔵 Main entry form (auth-coupled UI)
│   │   └── EditEntryDrawer.tsx                         🔵 Edit previous entry UI (auth-coupled)
│   ├── dashboard/
│   │   ├── DailySummaryTable.tsx                       🟢 Daily summary table
│   │   ├── PipelineView.tsx                            🟢 Pipeline view
│   │   └── ModelProgressTable.tsx                      🟢 Model progress table
│   ├── admin/
│   │   └── CrudTable.tsx                               🟢 Reusable admin CRUD table
│   └── ui/
│       └── ConfirmDialog.tsx                           🟢 Confirm/cancel dialog
├── __tests__/
│   ├── lead-auth.test.ts                               🔵
│   ├── entry-actions.test.ts                           🔵
│   └── dashboard-queries.test.ts                       🔵
├── jest.config.ts                                      🔵
├── .env.example                                        🔵
└── .env.local                                          🔵 (gitignored)
```

---

## Milestone 1: Scaffold & Database 🔵 Anyka

### Task 1.1: Initialise Next.js project

**Files:**
- Modify: root directory (scaffolds all Next.js files)
- Create: `.env.example`, `.env.local`, `jest.config.ts`

- [x] **Scaffold Next.js in the existing repo root**

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint
```

When prompted: say Yes to all defaults. This will scaffold into the current directory.

- [x] **Install runtime dependencies**

```bash
npm install @supabase/ssr @supabase/supabase-js bcryptjs
npm install -D @types/bcryptjs supabase jest ts-jest @types/jest jest-environment-node
```

- [x] **Create `jest.config.ts`**

```typescript
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
}

export default config
```

- [x] **Create `.env.example`** (commit this)

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [x] **Create `.env.local`** (never commit — add to `.gitignore` if not already there)

Fill in real values from the Supabase dashboard after Task 1.2.

- [x] **Add test script to `package.json`**

```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch"
}
```

- [x] **Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Supabase and Jest"
```

---

### Task 1.2: Supabase project + database schema + RLS

**Files:**
- Create: `supabase/migrations/20260621000000_initial_schema.sql`
- Create: `supabase/seed.sql`

**Prerequisites:** Create a Supabase project at supabase.com. Copy the project URL, anon key, and service role key into `.env.local`.

- [x] **Initialise Supabase CLI**

```bash
npx supabase init
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

- [x] **Create the migration file**

```bash
npx supabase migration new initial_schema
```

This creates `supabase/migrations/20260621000000_initial_schema.sql`. Replace its contents with:

```sql
-- ── Reference tables ─────────────────────────────────────────────────────────

CREATE TABLE stations (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name     TEXT NOT NULL,
  sequence INT  NOT NULL,
  active   BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE models (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name   TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE model_station_config (
  model_id   UUID NOT NULL REFERENCES models(id),
  station_id UUID NOT NULL REFERENCES stations(id),
  active     BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (model_id, station_id)
);

-- ── Orders ───────────────────────────────────────────────────────────────────

CREATE TABLE orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,
  order_date   DATE NOT NULL,
  due_date     DATE NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE order_lines (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  model_id UUID NOT NULL REFERENCES models(id),
  quantity INT  NOT NULL CHECK (quantity > 0),
  active   BOOLEAN NOT NULL DEFAULT true
);

-- ── People ───────────────────────────────────────────────────────────────────

CREATE TABLE leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE user_roles (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    TEXT NOT NULL CHECK (role IN ('supervisor', 'admin')),
  UNIQUE (user_id)
);

-- ── Production data ──────────────────────────────────────────────────────────

CREATE TABLE period_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE NOT NULL,
  period       TEXT NOT NULL CHECK (period IN ('P1','P2','P3','P4','P5','P6')),
  station_id   UUID NOT NULL REFERENCES stations(id),
  model_id     UUID NOT NULL REFERENCES models(id),
  target       INT  NOT NULL CHECK (target >= 0),
  actual       INT  NOT NULL CHECK (actual >= 0),
  pax          INT  NOT NULL CHECK (pax >= 0),
  defects      INT  NOT NULL CHECK (defects >= 0),
  submitted_by UUID NOT NULL REFERENCES leads(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE period_log_edits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_log_id   UUID NOT NULL REFERENCES period_log(id),
  edited_by       UUID NOT NULL REFERENCES leads(id),
  edited_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  prev_target     INT NOT NULL,
  new_target      INT NOT NULL,
  prev_actual     INT NOT NULL,
  new_actual      INT NOT NULL,
  prev_pax        INT NOT NULL,
  new_pax         INT NOT NULL,
  prev_defects    INT NOT NULL,
  new_defects     INT NOT NULL
);

-- ── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE stations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE models             ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_station_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_log_edits   ENABLE ROW LEVEL SECURITY;

-- Helper: returns the calling user's role (null if not a supervisor/admin)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER AS $$
  SELECT role FROM user_roles WHERE user_id = auth.uid()
$$;

-- Reference tables: anon can SELECT (entry form dropdowns use anon key)
--                   supervisor/admin can INSERT/UPDATE
CREATE POLICY "stations_select"  ON stations             FOR SELECT USING (true);
CREATE POLICY "stations_modify"  ON stations             FOR ALL    USING (get_user_role() IN ('supervisor','admin'));
CREATE POLICY "models_select"    ON models               FOR SELECT USING (true);
CREATE POLICY "models_modify"    ON models               FOR ALL    USING (get_user_role() IN ('supervisor','admin'));
CREATE POLICY "msc_select"       ON model_station_config FOR SELECT USING (true);
CREATE POLICY "msc_modify"       ON model_station_config FOR ALL    USING (get_user_role() IN ('supervisor','admin'));
CREATE POLICY "orders_select"    ON orders               FOR SELECT USING (true);
CREATE POLICY "orders_modify"    ON orders               FOR ALL    USING (get_user_role() IN ('supervisor','admin'));
CREATE POLICY "ol_select"        ON order_lines          FOR SELECT USING (true);
CREATE POLICY "ol_modify"        ON order_lines          FOR ALL    USING (get_user_role() IN ('supervisor','admin'));

-- leads: anon SELECT for name dropdown; service role handles password_hash (never queried via anon key)
CREATE POLICY "leads_select"  ON leads FOR SELECT USING (true);
CREATE POLICY "leads_modify"  ON leads FOR ALL    USING (get_user_role() IN ('supervisor','admin'));

-- user_roles: admin only
CREATE POLICY "user_roles_all" ON user_roles FOR ALL USING (get_user_role() = 'admin');

-- period_log / period_log_edits: service role for writes; supervisors/admins can SELECT
CREATE POLICY "pl_select"  ON period_log       FOR SELECT USING (get_user_role() IN ('supervisor','admin'));
CREATE POLICY "ple_select" ON period_log_edits FOR SELECT USING (get_user_role() IN ('supervisor','admin'));
```

- [x] **Create `supabase/seed.sql`** (dev data — run manually, not in CI)

```sql
-- Seed 8 stations
INSERT INTO stations (name, sequence) VALUES
  ('Station 1', 1), ('Station 2', 2), ('Station 3', 3), ('Station 4', 4),
  ('Station 5', 5), ('Station 6', 6), ('Station 7', 7), ('Station 8', 8);

-- Seed 2 models
INSERT INTO models (name) VALUES ('Model A'), ('Model B');

-- Seed 1 lead (password: "test1234" — bcrypt hash generated with bcrypt.hashSync('test1234', 10))
INSERT INTO leads (name, password_hash) VALUES
  ('Test Lead', '$2a$10$YourHashHere');
```

> **Note:** Generate the real hash by running `node -e "const b=require('bcryptjs'); console.log(b.hashSync('test1234',10))"` and pasting the output.

- [x] **Push migration to Supabase**

```bash
npx supabase db push
```

Expected output: `Applying migration 20260621000000_initial_schema.sql... done`

- [x] **Verify schema in Supabase dashboard** — open Table Editor, confirm all 9 tables exist with correct columns.

- [x] **Commit**

```bash
git add supabase/ .env.example jest.config.ts
git commit -m "feat: initial database schema with RLS policies"
```

---

### Task 1.3: Generate TypeScript types

**Files:**
- Create: `types/database.ts`

- [x] **Generate types from the live schema**

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_REF > types/database.ts
```

- [x] **Verify the file** — it should export a `Database` type with all 9 tables.

- [x] **Commit**

```bash
git add types/database.ts
git commit -m "feat: add generated Supabase TypeScript types"
```

---

## Milestone 2: Auth Layer 🔵 Anyka

### Task 2.1: Supabase clients

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`

- [ ] **Create `lib/supabase/client.ts`** (browser — uses anon key)

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Create `lib/supabase/server.ts`** (server components + actions — reads session cookie)

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Create `lib/supabase/admin.ts`** (service role — server only, bypasses RLS)

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Commit**

```bash
git add lib/supabase/
git commit -m "feat: add Supabase browser, server, and admin clients"
```

---

### Task 2.2: Lead auth utility

**Files:**
- Create: `lib/auth/lead-auth.ts`, `__tests__/lead-auth.test.ts`

- [ ] **Write the failing test first**

```typescript
// __tests__/lead-auth.test.ts
import { authenticateLead, hashPassword } from '@/lib/auth/lead-auth'

// Mock the admin client
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}))

import { createAdminClient } from '@/lib/supabase/admin'

describe('authenticateLead', () => {
  it('returns null when lead is not found', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) }) }),
    })
    const result = await authenticateLead('Unknown', 'password')
    expect(result).toBeNull()
  })

  it('returns null when password does not match', async () => {
    const hash = await hashPassword('correct')
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: { id: 'lead-1', password_hash: hash } }) }) }) }) }),
    })
    const result = await authenticateLead('Lead A', 'wrong')
    expect(result).toBeNull()
  })

  it('returns lead id when password matches', async () => {
    const hash = await hashPassword('correct')
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: { id: 'lead-1', password_hash: hash } }) }) }) }) }),
    })
    const result = await authenticateLead('Lead A', 'correct')
    expect(result).toBe('lead-1')
  })
})
```

- [ ] **Run test to confirm it fails**

```bash
npm test -- lead-auth
```

Expected: FAIL — `Cannot find module '@/lib/auth/lead-auth'`

- [ ] **Create `lib/auth/lead-auth.ts`**

```typescript
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'

export async function authenticateLead(
  name: string,
  password: string
): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: lead } = await supabase
    .from('leads')
    .select('id, password_hash')
    .eq('name', name)
    .eq('active', true)
    .single()

  if (!lead) return null
  const valid = await bcrypt.compare(password, lead.password_hash)
  return valid ? lead.id : null
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}
```

- [ ] **Run test to confirm it passes**

```bash
npm test -- lead-auth
```

Expected: PASS (3 tests)

- [ ] **Commit**

```bash
git add lib/auth/lead-auth.ts __tests__/lead-auth.test.ts
git commit -m "feat: lead bcrypt auth utility with tests"
```

---

### Task 2.3: Session + role utilities

**Files:**
- Create: `lib/auth/session.ts`

- [ ] **Create `lib/auth/session.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type UserRole = 'supervisor' | 'admin'

export async function requireSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return user
}

export async function requireRole(minRole: UserRole) {
  const user = await requireSession()
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!data) redirect('/login')
  if (minRole === 'admin' && data.role !== 'admin') redirect('/dashboard')
  return { user, role: data.role as UserRole }
}
```

- [ ] **Commit**

```bash
git add lib/auth/session.ts
git commit -m "feat: session and role check utilities"
```

---

### Task 2.4: Middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Create `middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  if ((path.startsWith('/dashboard') || path.startsWith('/admin')) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (path.startsWith('/admin/accounts') && user) {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (data?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
}
```

- [ ] **Commit**

```bash
git add middleware.ts
git commit -m "feat: middleware route protection by role"
```

---

### Task 2.5: Login page + OAuth callback

**Files:**
- Create: `app/login/page.tsx`, `app/api/auth/callback/route.ts`

**Prerequisites:** In Supabase dashboard → Authentication → Providers, enable Google OAuth. Add your Google OAuth client ID and secret. Add `http://localhost:3000/api/auth/callback` and your production Vercel URL to the allowed redirect URLs.

- [ ] **Create `app/api/auth/callback/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
```

- [ ] **Create `app/login/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const params = await searchParams
  const error = params.error

  async function signIn() {
    'use server'
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/auth/callback`,
      },
    })
    if (data.url) redirect(data.url)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">YTC Production</h1>
        <p className="text-gray-600 text-sm">Supervisor / Admin login</p>
        {error && (
          <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
            Authentication failed — please try again.
          </p>
        )}
        <form action={signIn}>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            Sign in with Google
          </button>
        </form>
        <p className="text-xs text-gray-400 text-center">
          Line leads — go to <a href="/entry" className="underline">/entry</a>
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Add `NEXT_PUBLIC_SITE_URL` to `.env.local`**

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Test login flow locally**

```bash
npm run dev
```

Navigate to `http://localhost:3000/login` → click "Sign in with Google" → complete OAuth → confirm redirect to `/dashboard`.

- [ ] **Commit**

```bash
git add app/login/ app/api/auth/
git commit -m "feat: Google OAuth login page and callback handler"
```

---

## Milestone 3: Entry Form 🔵 Anyka (server actions) + 🟢 Ryo (UI)

*These tasks can run in parallel after M2 is complete.*

---

### Task 3.1 🔵 Anyka: Entry server actions

**Files:**
- Create: `actions/entry.ts`, `__tests__/entry-actions.test.ts`

- [x] **Write failing tests**

```typescript
// __tests__/entry-actions.test.ts
jest.mock('@/lib/auth/lead-auth', () => ({
  authenticateLead: jest.fn(),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}))

import { submitEntry, editEntry, searchEntries } from '@/actions/entry'
import { authenticateLead } from '@/lib/auth/lead-auth'
import { createAdminClient } from '@/lib/supabase/admin'

const baseData = {
  date: '2026-06-21',
  period: 'P1',
  stationId: 'station-uuid',
  modelId: 'model-uuid',
  target: 100,
  actual: 90,
  pax: 5,
  defects: 2,
  leadName: 'Alice',
  password: 'pass',
}

describe('submitEntry', () => {
  it('returns auth_failed when password is wrong', async () => {
    ;(authenticateLead as jest.Mock).mockResolvedValue(null)
    const result = await submitEntry(baseData)
    expect(result.status).toBe('auth_failed')
  })

  it('returns duplicate when entry already exists and not confirmed', async () => {
    ;(authenticateLead as jest.Mock).mockResolvedValue('lead-1')
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'existing' } }) }) }) }) }) }) }),
    })
    const result = await submitEntry(baseData)
    expect(result.status).toBe('duplicate')
  })

  it('returns success when auth passes and no duplicate', async () => {
    ;(authenticateLead as jest.Mock).mockResolvedValue('lead-1')
    const mockInsert = jest.fn().mockResolvedValue({ error: null })
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: (table: string) => table === 'period_log'
        ? { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }), insert: mockInsert }
        : {},
    })
    const result = await submitEntry(baseData)
    expect(result.status).toBe('success')
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ submitted_by: 'lead-1' }))
  })
})
```

- [x] **Run tests to confirm they fail**

```bash
npm test -- entry-actions
```

- [x] **Create `actions/entry.ts`**

```typescript
'use server'
import { authenticateLead } from '@/lib/auth/lead-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export type EntryFormData = {
  date: string
  period: string
  stationId: string
  modelId: string
  target: number
  actual: number
  pax: number
  defects: number
  leadName: string
  password: string
  confirmDuplicate?: boolean
}

export type EntryResult =
  | { status: 'success' }
  | { status: 'auth_failed' }
  | { status: 'duplicate' }
  | { status: 'error'; message: string }

export async function submitEntry(data: EntryFormData): Promise<EntryResult> {
  const leadId = await authenticateLead(data.leadName, data.password)
  if (!leadId) return { status: 'auth_failed' }

  const supabase = createAdminClient()

  if (!data.confirmDuplicate) {
    const { data: existing } = await supabase
      .from('period_log')
      .select('id')
      .eq('date', data.date)
      .eq('period', data.period)
      .eq('station_id', data.stationId)
      .eq('model_id', data.modelId)
      .maybeSingle()

    if (existing) return { status: 'duplicate' }
  }

  const { error } = await supabase.from('period_log').insert({
    date: data.date,
    period: data.period,
    station_id: data.stationId,
    model_id: data.modelId,
    target: data.target,
    actual: data.actual,
    pax: data.pax,
    defects: data.defects,
    submitted_by: leadId,
  })

  return error ? { status: 'error', message: error.message } : { status: 'success' }
}

export type EditData = {
  entryId: string
  leadName: string
  password: string
  target: number
  actual: number
  pax: number
  defects: number
}

export type EditResult =
  | { status: 'success' }
  | { status: 'auth_failed' }
  | { status: 'error'; message: string }

export async function editEntry(data: EditData): Promise<EditResult> {
  const leadId = await authenticateLead(data.leadName, data.password)
  if (!leadId) return { status: 'auth_failed' }

  const supabase = createAdminClient()

  const { data: current, error: fetchError } = await supabase
    .from('period_log')
    .select('target, actual, pax, defects')
    .eq('id', data.entryId)
    .single()

  if (fetchError || !current) return { status: 'error', message: 'Entry not found' }

  const { error: updateError } = await supabase
    .from('period_log')
    .update({ target: data.target, actual: data.actual, pax: data.pax, defects: data.defects })
    .eq('id', data.entryId)

  if (updateError) return { status: 'error', message: updateError.message }

  const { error: auditError } = await supabase.from('period_log_edits').insert({
    period_log_id: data.entryId,
    edited_by: leadId,
    prev_target: current.target,
    new_target: data.target,
    prev_actual: current.actual,
    new_actual: data.actual,
    prev_pax: current.pax,
    new_pax: data.pax,
    prev_defects: current.defects,
    new_defects: data.defects,
  })

  return auditError ? { status: 'error', message: auditError.message } : { status: 'success' }
}

export async function searchEntries(stationId: string, period: string, date: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('period_log')
    .select(`
      id, date, period, target, actual, pax, defects, created_at,
      stations(name),
      models(name),
      leads(name)
    `)
    .eq('station_id', stationId)
    .eq('period', period)
    .eq('date', date)
    .order('created_at', { ascending: false })

  return data ?? []
}
```

- [x] **Run tests — confirm they pass**

```bash
npm test -- entry-actions
```

- [x] **Commit**

```bash
git add actions/entry.ts __tests__/entry-actions.test.ts
git commit -m "feat: entry server actions (submit, edit, search) with tests"
```

---

### Task 3.2 🔵 Anyka: EntryForm component + page

**Files:**
- Create: `components/entry/EntryForm.tsx`, `components/ui/ConfirmDialog.tsx`, `app/entry/page.tsx`

**Interfaces from Task 3.1:**
- `submitEntry(data: EntryFormData): Promise<EntryResult>` — import from `@/actions/entry`
- `searchEntries(stationId, period, date): Promise<entries[]>` — for the edit search

**Data shape fetched server-side and passed as props:**

```typescript
type Station = { id: string; name: string; sequence: number }
type Model   = { id: string; name: string }
type Lead    = { id: string; name: string }
```

- [x] **Create `components/ui/ConfirmDialog.tsx`** — a modal that shows a message with Confirm and Cancel buttons. Accept `message: string`, `onConfirm: () => void`, `onCancel: () => void` props.

- [x] **Create `components/entry/EntryForm.tsx`**

This is a client component (`'use client'`). It receives `stations`, `models`, and `leads` as props and calls `submitEntry` on submit.

State to manage:
- `formState` — current field values
- `result` — the last `EntryResult` from the server action
- `showConfirm` — boolean for the duplicate confirmation dialog
- `pending` — from `useTransition` to disable the button while submitting

Behaviour:
- On `status: 'auth_failed'` → show inline error "Incorrect password — submission not recorded."
- On `status: 'duplicate'` → show `ConfirmDialog` with "An entry already exists for this combination. Submit anyway?"
  - On confirm → re-call `submitEntry` with `confirmDuplicate: true`
  - On cancel → dismiss dialog
- On `status: 'success'` → show "Submitted successfully" and reset form fields (except leadName/password so the lead doesn't have to re-enter every time)
- On `status: 'error'` → show "Submission failed — please try again."

The date field should default to today (`new Date().toISOString().split('T')[0]`).

- [x] **Create `app/entry/page.tsx`** — server component that fetches dropdowns and renders `EntryForm`

```typescript
import { createClient } from '@/lib/supabase/server'
import EntryForm from '@/components/entry/EntryForm'

export default async function EntryPage() {
  const supabase = await createClient()

  const [{ data: stations }, { data: models }, { data: leads }] = await Promise.all([
    supabase.from('stations').select('id, name, sequence').eq('active', true).order('sequence'),
    supabase.from('models').select('id, name').eq('active', true).order('name'),
    supabase.from('leads').select('id, name').eq('active', true).order('name'),
  ])

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <EntryForm
        stations={stations ?? []}
        models={models ?? []}
        leads={leads ?? []}
      />
    </main>
  )
}
```

- [ ] **Manually test the entry form**

```bash
npm run dev
```

1. Navigate to `http://localhost:3000/entry`
2. Fill in all fields with a valid lead name + "test1234" (from seed)
3. Submit → confirm "Submitted successfully"
4. Submit the same entry again → confirm duplicate warning appears
5. Confirm duplicate → confirm second row written
6. Submit with wrong password → confirm error message, no DB row

- [x] **Commit**

```bash
git add components/entry/ components/ui/ConfirmDialog.tsx app/entry/
git commit -m "feat: entry form UI with duplicate warning and auth error handling"
```

---

### Task 3.3 🔵 Anyka: Edit entry UI

**Files:**
- Create: `components/entry/EditEntryDrawer.tsx`

**Interfaces from Task 3.1:**
- `searchEntries(stationId, period, date)` — returns entries to display
- `editEntry(data: EditData): Promise<EditResult>` — called on save

- [x] **Create `components/entry/EditEntryDrawer.tsx`** — a client component that:
  1. Shows a search form: Station (dropdown), Period (dropdown), Date (date input defaulting to today)
  2. On search → calls `searchEntries` (as a server action or via fetch), displays matching rows in a table showing: Station, Period, Model, Target, Actual, PAX, Defects, Submitted by, Time
  3. User clicks a row → opens edit form pre-filled with those values + Lead name dropdown + Password field
  4. On save → calls `editEntry`, shows success/auth-failure inline
  5. On `status: 'auth_failed'` → "Incorrect password — edit not saved."
  6. On `status: 'success'` → "Saved." and close the edit form

- [x] **Add an "Edit previous entry" link/button to `EntryForm.tsx`** that opens the `EditEntryDrawer`.

- [ ] **Manually test**

1. Submit an entry
2. Open Edit drawer, search by that station + period + today
3. Confirm the entry appears
4. Click it, change Actual, submit with correct password → confirm update
5. Try with wrong password → confirm error, no change

- [ ] **Commit**

```bash
git add components/entry/EditEntryDrawer.tsx
git commit -m "feat: edit entry drawer with audit log"
```

---

## Milestone 4: Admin CRUD 🔵 Anyka (actions) + 🟢 Ryo (UI)

*These tasks can run in parallel after M2 is complete.*

---

### Task 4.1 🔵 Anyka: Admin server actions

**Files:**
- Create: `actions/admin.ts`

- [x] **Create `actions/admin.ts`**

```typescript
'use server'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashPassword } from '@/lib/auth/lead-auth'
import { revalidatePath } from 'next/cache'

// ── Stations ──────────────────────────────────────────────────────────────────

export async function upsertStation(data: {
  id?: string
  name: string
  sequence: number
  active: boolean
}) {
  await requireRole('supervisor')
  const supabase = createAdminClient()
  if (data.id) {
    await supabase.from('stations')
      .update({ name: data.name, sequence: data.sequence, active: data.active })
      .eq('id', data.id)
  } else {
    await supabase.from('stations').insert({ name: data.name, sequence: data.sequence, active: data.active })
  }
  revalidatePath('/admin/stations')
}

// ── Models ────────────────────────────────────────────────────────────────────

export async function upsertModel(data: {
  id?: string
  name: string
  active: boolean
  stationIds: string[]  // stations this model flows through
}) {
  await requireRole('supervisor')
  const supabase = createAdminClient()
  let modelId = data.id

  if (data.id) {
    await supabase.from('models').update({ name: data.name, active: data.active }).eq('id', data.id)
  } else {
    const { data: inserted } = await supabase.from('models')
      .insert({ name: data.name, active: data.active }).select('id').single()
    modelId = inserted!.id
  }

  // Deactivate all existing config for this model, then activate selected stations
  await supabase.from('model_station_config').update({ active: false }).eq('model_id', modelId!)
  if (data.stationIds.length > 0) {
    await supabase.from('model_station_config').upsert(
      data.stationIds.map(stationId => ({ model_id: modelId!, station_id: stationId, active: true })),
      { onConflict: 'model_id,station_id' }
    )
  }
  revalidatePath('/admin/models')
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function upsertOrder(data: {
  id?: string
  orderNumber: string
  orderDate: string
  dueDate: string
  active: boolean
  lines: { modelId: string; quantity: number }[]
}) {
  await requireRole('supervisor')
  const supabase = createAdminClient()
  let orderId = data.id

  if (data.id) {
    await supabase.from('orders').update({
      order_number: data.orderNumber,
      order_date: data.orderDate,
      due_date: data.dueDate,
      active: data.active,
    }).eq('id', data.id)
    // Replace all order lines
    await supabase.from('order_lines').delete().eq('order_id', data.id)
  } else {
    const { data: inserted } = await supabase.from('orders').insert({
      order_number: data.orderNumber,
      order_date: data.orderDate,
      due_date: data.dueDate,
      active: data.active,
    }).select('id').single()
    orderId = inserted!.id
  }

  if (data.lines.length > 0) {
    await supabase.from('order_lines').insert(
      data.lines.map(l => ({ order_id: orderId!, model_id: l.modelId, quantity: l.quantity, active: true }))
    )
  }
  revalidatePath('/admin/orders')
}

// ── Leads ─────────────────────────────────────────────────────────────────────

export async function upsertLead(data: {
  id?: string
  name: string
  password?: string  // required for new leads, optional for updates
  active: boolean
}) {
  await requireRole('supervisor')
  const supabase = createAdminClient()

  if (data.id) {
    const update: Record<string, unknown> = { name: data.name, active: data.active }
    if (data.password) update.password_hash = await hashPassword(data.password)
    await supabase.from('leads').update(update).eq('id', data.id)
  } else {
    if (!data.password) throw new Error('Password required for new leads')
    const password_hash = await hashPassword(data.password)
    await supabase.from('leads').insert({ name: data.name, password_hash, active: data.active })
  }
  revalidatePath('/admin/leads')
}

// ── User roles (Admin only) ───────────────────────────────────────────────────

export async function setUserRole(userId: string, role: 'supervisor' | 'admin') {
  await requireRole('admin')
  const supabase = createAdminClient()
  await supabase.from('user_roles').upsert({ user_id: userId, role }, { onConflict: 'user_id' })
  revalidatePath('/admin/accounts')
}

export async function removeUserRole(userId: string) {
  await requireRole('admin')
  const supabase = createAdminClient()
  await supabase.from('user_roles').delete().eq('user_id', userId)
  revalidatePath('/admin/accounts')
}
```

- [x] **Commit**

```bash
git add actions/admin.ts
git commit -m "feat: admin CRUD server actions for all reference tables"
```

---

### Task 4.2 🟢 Ryo: Admin layout + shared CrudTable component

**Files:**
- Create: `app/admin/layout.tsx`, `components/admin/CrudTable.tsx`

- [ ] **Create `app/admin/layout.tsx`** — server component that calls `requireRole('supervisor')` and wraps with a nav sidebar linking to `/admin/stations`, `/admin/models`, `/admin/orders`, `/admin/leads`, and (admin only) `/admin/accounts`.

- [ ] **Create `components/admin/CrudTable.tsx`** — a generic, reusable table component. Props:

```typescript
type CrudTableProps<T> = {
  columns: { key: keyof T; label: string }[]
  rows: T[]
  onEdit: (row: T) => void
  onToggleActive: (row: T) => void  // calls upsert with flipped active
}
```

Renders a table with an Edit button and an Active/Deactivate toggle per row.

- [ ] **Commit**

```bash
git add app/admin/layout.tsx components/admin/CrudTable.tsx
git commit -m "feat: admin layout and reusable CrudTable component"
```

---

### Task 4.3 🟢 Ryo: Stations, Models, Orders, Leads admin pages

**Files:**
- Create: `app/admin/stations/page.tsx`, `app/admin/models/page.tsx`, `app/admin/orders/page.tsx`, `app/admin/leads/page.tsx`, `app/admin/accounts/page.tsx`

Each page follows the same pattern:
1. Server component fetches current data
2. Renders `CrudTable` with rows
3. Edit button opens a form/modal that calls the relevant `upsertX` action
4. New button opens the same form empty

> **Form contracts from T4.1 server actions — required before building these pages:**
>
> - **Leads — password field on edit:** Send `undefined` (omit the field entirely) when the password input is left blank. Do **not** send `""` — the action throws on empty string. Only include the field when the supervisor has typed a new password.
>
> - **order_lines soft-delete pattern:** Each order edit deactivates the old lines and inserts new ones. Inactive rows are the audit trail and accumulate. Any query that reads `order_lines` **must** filter `WHERE active = true` / `.eq('active', true)` — forgetting this filter double-counts quantities. This applies to the orders page and to any `order_lines` query in `lib/db/dashboard.ts`.

- [ ] **Create `app/admin/stations/page.tsx`** — fetches all stations ordered by sequence; form fields: Name (text), Sequence (number), Active (checkbox).

- [ ] **Create `app/admin/models/page.tsx`** — fetches all models; form fields: Name (text), Active (checkbox), Station Config (multi-select checkboxes from active stations — maps to `stationIds`).

- [ ] **Create `app/admin/orders/page.tsx`** — fetches orders with their line items. Form fields: Order Number, Order Date, Due Date, Active, and a dynamic list of line items (Model dropdown + Quantity input, with Add/Remove line).

- [ ] **Create `app/admin/leads/page.tsx`** — fetches leads. Form fields: Name (text), Password (only required on create, optional on edit — shown as "Leave blank to keep existing"), Active (checkbox).

- [ ] **Create `app/admin/accounts/page.tsx`** — admin only. Fetches all Supabase Auth users (via `createAdminClient().auth.admin.listUsers()`) and their current roles from `user_roles`. Shows a table: Email | Current Role | Set Role (dropdown: supervisor / admin / none).

- [ ] **Manually verify all admin pages**

1. Create a station → appears in entry form dropdown
2. Deactivate a station → disappears from entry form dropdown; historical logs still intact
3. Create a lead with password → can submit entry form with that lead
4. Reset a lead's password → old password no longer works, new one does
5. Create an order with two line items → appears in model progress view

- [ ] **Commit**

```bash
git add app/admin/
git commit -m "feat: admin CRUD pages for stations, models, orders, leads, accounts"
```

---

## Milestone 5: Dashboard 🟢 Ryo (queries + UI) + 🔵 Anyka (T5.5 Full Data Report)

*These tasks can run in parallel after M1 is complete.*

---

### Task 5.1 🟢 Ryo: Dashboard query functions

**Files:**
- Create: `lib/db/dashboard.ts`, `__tests__/dashboard-queries.test.ts`

- [ ] **Write failing tests**

```typescript
// __tests__/dashboard-queries.test.ts
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
import { createAdminClient } from '@/lib/supabase/admin'
import { getDailySummary, getPipelineData, getModelProgress } from '@/lib/db/dashboard'

describe('getDailySummary', () => {
  it('aggregates target/actual/defects by station and sorts by sequence', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            data: [
              { target: 100, actual: 80, defects: 3, stations: { id: 's1', name: 'Station 1', sequence: 1 } },
              { target: 50,  actual: 40, defects: 1, stations: { id: 's1', name: 'Station 1', sequence: 1 } },
              { target: 90,  actual: 90, defects: 0, stations: { id: 's2', name: 'Station 2', sequence: 2 } },
            ],
          }),
        }),
      }),
    })
    const rows = await getDailySummary('2026-06-21')
    expect(rows).toHaveLength(2)
    expect(rows[0].stationName).toBe('Station 1')
    expect(rows[0].target).toBe(150)
    expect(rows[0].actual).toBe(120)
    expect(rows[0].attainmentPct).toBe(80)
    expect(rows[0].variance).toBe(-30)
    expect(rows[1].attainmentPct).toBe(100)
  })
})

describe('getPipelineData', () => {
  it('computes WIP as upstream actual minus current station actual', async () => {
    jest.spyOn(require('@/lib/db/dashboard'), 'getDailySummary').mockResolvedValue([
      { stationId: 's1', stationName: 'Station 1', sequence: 1, target: 100, actual: 90, attainmentPct: 90, variance: -10, defects: 0 },
      { stationId: 's2', stationName: 'Station 2', sequence: 2, target: 100, actual: 70, attainmentPct: 70, variance: -30, defects: 2 },
    ])
    const rows = await getPipelineData('2026-06-21')
    expect(rows[0].wip).toBeNull()       // first station has no upstream
    expect(rows[1].wip).toBe(20)         // 90 - 70
    expect(rows[1].gapToGoal).toBe(30)   // 100 - 70
  })
})
```

- [ ] **Run tests — confirm they fail**

```bash
npm test -- dashboard-queries
```

- [ ] **Create `lib/db/dashboard.ts`**

```typescript
import { createAdminClient } from '@/lib/supabase/admin'

export type DailySummaryRow = {
  stationId: string
  stationName: string
  sequence: number
  target: number
  actual: number
  attainmentPct: number | null
  variance: number
  defects: number
}

export async function getDailySummary(date: string): Promise<DailySummaryRow[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('period_log')
    .select('target, actual, defects, stations!inner(id, name, sequence)')
    .eq('date', date)

  if (!data) return []

  const byStation = new Map<string, { name: string; sequence: number; target: number; actual: number; defects: number }>()
  for (const row of data) {
    const s = row.stations as { id: string; name: string; sequence: number }
    const ex = byStation.get(s.id) ?? { name: s.name, sequence: s.sequence, target: 0, actual: 0, defects: 0 }
    byStation.set(s.id, { ...ex, target: ex.target + row.target, actual: ex.actual + row.actual, defects: ex.defects + row.defects })
  }

  return Array.from(byStation.entries())
    .map(([stationId, s]) => ({
      stationId,
      stationName: s.name,
      sequence: s.sequence,
      target: s.target,
      actual: s.actual,
      attainmentPct: s.target > 0 ? Math.round((s.actual / s.target) * 100) : null,
      variance: s.actual - s.target,
      defects: s.defects,
    }))
    .sort((a, b) => a.sequence - b.sequence)
}

export type PipelineRow = DailySummaryRow & {
  gapToGoal: number
  wip: number | null
}

export async function getPipelineData(date: string): Promise<PipelineRow[]> {
  const summary = await getDailySummary(date)
  return summary.map((row, i) => ({
    ...row,
    gapToGoal: row.target - row.actual,
    wip: i > 0 ? summary[i - 1].actual - row.actual : null,
  }))
}

export type ModelProgressRow = {
  modelId: string
  modelName: string
  totalOrdered: number
  totalProduced: number
  balanceRemaining: number
  earliestDueDate: string
}

export async function getModelProgress(): Promise<ModelProgressRow[]> {
  const supabase = createAdminClient()

  const { data: lines } = await supabase
    .from('order_lines')
    .select('quantity, model_id, models!inner(name), orders!inner(due_date, active)')
    .eq('active', true)
    .eq('orders.active', true)

  if (!lines) return []

  const modelMap = new Map<string, { name: string; totalOrdered: number; earliestDueDate: string }>()
  for (const line of lines) {
    const id = line.model_id
    const order = line.orders as { due_date: string }
    const ex = modelMap.get(id)
    if (!ex) {
      modelMap.set(id, { name: (line.models as { name: string }).name, totalOrdered: line.quantity, earliestDueDate: order.due_date })
    } else {
      modelMap.set(id, {
        ...ex,
        totalOrdered: ex.totalOrdered + line.quantity,
        earliestDueDate: order.due_date < ex.earliestDueDate ? order.due_date : ex.earliestDueDate,
      })
    }
  }

  const modelIds = Array.from(modelMap.keys())
  const { data: produced } = await supabase
    .from('period_log')
    .select('model_id, actual')
    .in('model_id', modelIds)

  const producedMap = new Map<string, number>()
  for (const row of produced ?? []) {
    producedMap.set(row.model_id, (producedMap.get(row.model_id) ?? 0) + row.actual)
  }

  return Array.from(modelMap.entries())
    .map(([modelId, m]) => ({
      modelId,
      modelName: m.name,
      totalOrdered: m.totalOrdered,
      totalProduced: producedMap.get(modelId) ?? 0,
      balanceRemaining: m.totalOrdered - (producedMap.get(modelId) ?? 0),
      earliestDueDate: m.earliestDueDate,
    }))
    .sort((a, b) => a.earliestDueDate.localeCompare(b.earliestDueDate))
}
```

- [ ] **Run tests — confirm they pass**

```bash
npm test -- dashboard-queries
```

Expected: PASS (3 tests)

- [ ] **Commit**

```bash
git add lib/db/dashboard.ts __tests__/dashboard-queries.test.ts
git commit -m "feat: dashboard query functions with tests"
```

---

### Task 5.2 🟢 Ryo: Dashboard layout + Daily Summary view

**Files:**
- Create: `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`, `components/dashboard/DailySummaryTable.tsx`

**Interfaces from Task 5.1:**
```typescript
// getDailySummary(date: string): Promise<DailySummaryRow[]>
type DailySummaryRow = {
  stationId: string; stationName: string; sequence: number
  target: number; actual: number
  attainmentPct: number | null; variance: number; defects: number
}
```

- [ ] **Create `app/dashboard/layout.tsx`** — server component that calls `requireRole('supervisor')`, then renders a top nav with tabs: Daily Summary (`/dashboard`), Pipeline (`/dashboard/pipeline`), Model Progress (`/dashboard/progress`), and a link to Admin.

- [ ] **Create `components/dashboard/DailySummaryTable.tsx`** — client or server component. Props: `rows: DailySummaryRow[]`. Renders a table:

| Station | Target | Actual | Attainment % | Variance | Defects |
|---|---|---|---|---|---|

- Attainment % shown as a percentage with colour coding: green ≥ 90%, amber 70–89%, red < 70%, grey if null (no target).
- Variance shown as negative numbers in red.

- [ ] **Create `app/dashboard/page.tsx`** — server component with a date picker (defaults to today). Fetches `getDailySummary(date)` and passes rows to `DailySummaryTable`.

```typescript
import { getDailySummary } from '@/lib/db/dashboard'
import DailySummaryTable from '@/components/dashboard/DailySummaryTable'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const params = await searchParams
  const date = params.date ?? new Date().toISOString().split('T')[0]
  const rows = await getDailySummary(date)

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Daily Summary</h1>
      <DatePicker value={date} />
      <DailySummaryTable rows={rows} />
    </div>
  )
}
```

Create a small client component `components/ui/DatePicker.tsx` that wraps the date input:

```typescript
'use client'
import { useRouter } from 'next/navigation'

export default function DatePicker({ value }: { value: string }) {
  const router = useRouter()
  return (
    <input
      type="date"
      defaultValue={value}
      className="border rounded px-3 py-1.5 text-sm"
      onChange={(e) => router.push(`?date=${e.target.value}`)}
    />
  )
}
```

- [ ] **Commit**

```bash
git add app/dashboard/layout.tsx app/dashboard/page.tsx components/dashboard/DailySummaryTable.tsx
git commit -m "feat: dashboard layout and daily summary view"
```

---

### Task 5.3 🟢 Ryo: Pipeline view + Model progress view

**Files:**
- Create: `app/dashboard/pipeline/page.tsx`, `components/dashboard/PipelineView.tsx`
- Create: `app/dashboard/progress/page.tsx`, `components/dashboard/ModelProgressTable.tsx`

**Interfaces from Task 5.1:**
```typescript
type PipelineRow = DailySummaryRow & { gapToGoal: number; wip: number | null }
type ModelProgressRow = {
  modelId: string; modelName: string
  totalOrdered: number; totalProduced: number
  balanceRemaining: number; earliestDueDate: string
}
```

- [ ] **Create `components/dashboard/PipelineView.tsx`** — renders stations in sequence order. For each station show:
  - Station name + sequence number
  - Attainment %  (colour-coded same as daily summary)
  - WIP into this station (units sitting between previous station and this one) — show "—" for first station
  - Gap to goal (target − actual) — highlight in red if > 0

- [ ] **Create `app/dashboard/pipeline/page.tsx`** — server component, same date picker pattern as daily summary, calls `getPipelineData(date)`.

- [ ] **Create `components/dashboard/ModelProgressTable.tsx`** — props: `rows: ModelProgressRow[]`. Renders:

| Model | Ordered | Produced | Balance | Due Date |
|---|---|---|---|---|

- Balance shown in red if > 0 (still work to do), green if 0 (complete).
- Sorted by due date (already sorted from query).

- [ ] **Create `app/dashboard/progress/page.tsx`** — server component, calls `getModelProgress()` (no date filter — all-time production vs active orders).

- [ ] **Manually verify dashboard end-to-end** (from tech spec section 11, items 5–7)

1. Log entries for all 8 stations for today
2. Open Daily Summary → confirm attainment %, variance, defects display correctly
3. Open Pipeline View → confirm WIP = upstream actual − this station actual
4. Create order with 2 models, log production for both → open Model Progress → confirm balance remaining correct

- [ ] **Commit**

```bash
git add app/dashboard/pipeline/ app/dashboard/progress/ components/dashboard/
git commit -m "feat: pipeline view and model progress dashboard views"
```

---

### Task 5.4 🟢 Ryo: Order + model filter for Daily Summary and Pipeline views

**Context:** When multiple models run on the same stations in a day, `getDailySummary` and `getPipelineData` aggregate all models together per station, making attainment figures meaningless. Orders can also have overlapping models, so supervisors need to scope the view to a specific order first, then optionally drill into a single model within it.

**Data model note:** `period_log` stores `model_id`, not `order_id`. "Filter by order" means "restrict to model IDs that belong to this order's line items" — production that fulfils multiple overlapping orders for the same model cannot be separated at the log level.

**URL params:** `?orderId=<uuid>&modelId=<uuid>` — same pattern as the existing `?date=` param. Both are optional. Selecting an order with no model selected shows all models in that order aggregated. Selecting a model with no order shows that model across all orders (equivalent to the old model-only filter).

**Files:**
- Modify: `lib/db/dashboard.ts` — add optional `modelId` and `modelIds` params to `getDailySummary` and `getPipelineData`
- Modify: `app/dashboard/page.tsx` — add order + model selectors, resolve modelIds from orderId, pass to queries
- Modify: `app/dashboard/pipeline/page.tsx` — same
- Create: `components/ui/OrderPicker.tsx` — client component, dropdown of active orders
- Create: `components/ui/ModelPicker.tsx` — client component, dropdown filtered to selected order's models (or all active models if no order selected)
- Modify: `__tests__/dashboard-queries.test.ts` — add tests for filtered queries

**Design:**

- [ ] **Update `getDailySummary` and `getPipelineData`** to accept an optional `modelIds: string[] | undefined` param. When provided, replace `.eq('model_id', modelId)` with `.in('model_id', modelIds)` on the `period_log` query.

- [ ] **Create `components/ui/OrderPicker.tsx`** — client component. Props: `orders: { id: string; order_number: string }[]`, `selectedId: string | undefined`. Renders a `<select>` with an "All orders" option. On change, pushes `?orderId=<id>` and clears `modelId` from the URL (model list changes when order changes).

- [ ] **Create `components/ui/ModelPicker.tsx`** — client component. Props: `models: { id: string; name: string }[]`, `selectedId: string | undefined`. Renders a `<select>` with an "All models" option. The model list is pre-filtered server-side to the selected order's models (or all active models if no order). On change, pushes `?modelId=<id>` to the URL, preserving `orderId`.

- [ ] **Update `app/dashboard/page.tsx`** — server-side:
  1. Read `orderId` and `modelId` from `searchParams`
  2. If `orderId` is set: query `order_lines` for that order to get its `model_id` list; pass as `modelIds` to `getDailySummary`; fetch only those models for `ModelPicker`
  3. If `modelId` is also set: filter `modelIds` down to just that one
  4. If neither is set: pass `modelIds = undefined` (all models, current behaviour)
  5. Fetch all active orders for `OrderPicker`

- [ ] **Update `app/dashboard/pipeline/page.tsx`** — same pattern.

- [ ] **Add tests** for `getDailySummary` with a `modelIds` argument — confirm `.in('model_id', [...])` is called correctly.

- [ ] **Manually verify**
  1. With multiple orders and models in the DB, open Daily Summary — "All orders / All models" shows full aggregated figures
  2. Select an order → only models in that order appear in the model dropdown; station rows filter to those models
  3. Select a model within the order → single model view
  4. Switch to Pipeline → order + model selection carries across tabs

- [ ] **Commit**

```bash
git add lib/db/dashboard.ts app/dashboard/ components/ui/OrderPicker.tsx components/ui/ModelPicker.tsx __tests__/dashboard-queries.test.ts
git commit -m "feat: order + model filter for daily summary and pipeline views (FR-2.6)"
```

---

### Task 5.5 🔵 Anyka: Full Data Report tab

**Context:** Raw `period_log` entries with readable names for a selected date range, plus CSV export — pulled forward from P2 (originally FR-2.8) as new requirement FR-2.9 because raw-entry visibility/export is needed sooner than the rest of P2. Distinct from FR-2.8, which is exporting the aggregated Daily Summary / Pipeline / Model Progress views themselves.

**Files:**
- Modify: `lib/db/dashboard.ts` — add `getFullDataReport`
- Create: `app/dashboard/report/page.tsx`
- Create: `components/dashboard/FullDataReport.tsx`
- Modify: `__tests__/dashboard-queries.test.ts` — add tests for `getFullDataReport`

**Interfaces:**

```typescript
type FullDataReportRow = {
  date: string
  period: string
  stationName: string
  modelName: string
  target: number
  actual: number
  pax: number
  defects: number
  submittedByName: string
  createdAt: string
  edited: boolean
}
```

- [x] **Write failing tests** for `getFullDataReport(startDate, endDate)`:
  - Rows are joined with station/model/lead names, not raw IDs
  - Sorted by date ascending, then period, then station sequence within each date
  - `edited` is `true` only for rows with a matching `period_log_edits.period_log_id`
  - Empty range (no matching rows) returns `[]`

- [x] **Run tests to confirm they fail**

```bash
npm test -- dashboard-queries
```

- [x] **Add `getFullDataReport` to `lib/db/dashboard.ts`**

```typescript
export type FullDataReportRow = {
  date: string
  period: string
  stationName: string
  modelName: string
  target: number
  actual: number
  pax: number
  defects: number
  submittedByName: string
  createdAt: string
  edited: boolean
}

export async function getFullDataReport(startDate: string, endDate: string): Promise<FullDataReportRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('period_log')
    .select(`
      id, date, period, target, actual, pax, defects, created_at,
      stations!inner(name, sequence),
      models!inner(name),
      leads!inner(name)
    `)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw error
  if (!data || data.length === 0) return []

  const { data: edits, error: editsError } = await supabase
    .from('period_log_edits')
    .select('period_log_id')
    .in('period_log_id', data.map(row => row.id))

  if (editsError) throw editsError
  const editedIds = new Set((edits ?? []).map(e => e.period_log_id))

  return data
    .map(row => {
      const station = row.stations as unknown as { name: string; sequence: number }
      const model = row.models as unknown as { name: string }
      const lead = row.leads as unknown as { name: string }
      return {
        date: row.date,
        period: row.period,
        stationName: station.name,
        stationSequence: station.sequence,
        modelName: model.name,
        target: row.target,
        actual: row.actual,
        pax: row.pax,
        defects: row.defects,
        submittedByName: lead.name,
        createdAt: row.created_at,
        edited: editedIds.has(row.id),
      }
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      if (a.period !== b.period) return a.period.localeCompare(b.period)
      return a.stationSequence - b.stationSequence
    })
}
```

> **Input validation reminder (per `CLAUDE.md` implementation standards):** `startDate`/`endDate` reach this function from a client-controlled date-range picker. The page/component calling `getFullDataReport` must validate both are well-formed `YYYY-MM-DD` strings and `startDate <= endDate` *before* calling it — reject with an inline error otherwise, same pattern as the duplicate-entry check in `actions/entry.ts`.

- [x] **Run tests — confirm they pass**

```bash
npm test -- dashboard-queries
```

- [x] **Create `components/dashboard/FullDataReport.tsx`** — client component:
  - Date range inputs (start/end), defaulting to the first/last day of the current calendar month on mount
  - Validates `start <= end` before calling the server action; shows inline error otherwise (query not run)
  - Calls `getFullDataReport` on mount and whenever the range changes
  - Renders rows grouped visually by `date` (a section header per date); within each date, rows are already sorted period → station from the query
  - Shows an "edited" badge on rows where `edited === true`
  - Empty state: "No entries found for this date range."
  - Error state: "Failed to load report — please try again."
  - "Export CSV" button — converts the rows currently held in component state (already fetched, not re-queried) to a CSV string with headers `Date, Period, Station, Model, Target, Actual, PAX, Defects, Submitted By, Submitted At, Edited`, and triggers a download via `Blob` + a temporary `<a download>` element

- [x] **Create `app/dashboard/report/page.tsx`** — server component shell rendering `<FullDataReport />`. No auth logic needed here — `middleware.ts`'s existing `/dashboard/:path*` matcher already gates this route to Supervisor/Admin.

- [x] **Add a "Full Data Report" tab link** alongside the existing Daily Summary / Pipeline / Model Progress tab links in the dashboard nav.

- [ ] **Manually verify**

1. Log entries across several dates, stations, and periods; edit at least one entry
2. Open Full Data Report — confirm it loads the current month by default, grouped by date, sorted period → station within each date
3. Confirm the previously-edited entry shows its "edited" badge
4. Change the date range and confirm data reloads; try `start > end` and confirm inline validation blocks the query
5. Click Export CSV — confirm the downloaded file opens correctly with resolved names (not UUIDs) and matches the on-screen rows exactly

- [ ] **Commit**

```bash
git add lib/db/dashboard.ts app/dashboard/report/ components/dashboard/FullDataReport.tsx __tests__/dashboard-queries.test.ts
git commit -m "feat: full data report tab with date-range CSV export (FR-2.9)"
```

---

### Task 5.6 🟢 Ryo: Order-Model Step Tracker

Clicking a model row in the Model Progress view opens a detail page showing step-by-step production progress for that specific order + model combination. The page has a steps table on the left and a chart on the right.

**Prerequisites:** Install charting library:
```bash
npm install recharts
```

**Files:**
- Create: `lib/db/order-model-tracker.ts` — query functions
- Create: `app/dashboard/progress/[orderId]/[modelId]/page.tsx` — detail page
- Create: `components/dashboard/StepTrackerTable.tsx` — step rows table
- Create: `components/dashboard/StepOutputChart.tsx` — Recharts composed chart
- Modify: `lib/db/dashboard.ts` — change `getModelProgress` to return per-order rows (one row per order-model, not aggregated across orders)
- Modify: `components/dashboard/ModelProgressTable.tsx` — make model name a link; add Order # column

---

#### Part A — Update `getModelProgress` to return per-order rows

The current `getModelProgress` aggregates quantities across all orders for each model. Change it to return one row per active `order_line`, so each row carries its `orderId` and `orderNumber` and can be linked individually.

```typescript
export type ModelProgressRow = {
  orderId: string
  orderNumber: string
  modelId: string
  modelName: string
  totalOrdered: number       // quantity from this order line
  totalProduced: number      // all-time actual output for this model (shared across orders)
  balanceRemaining: number   // totalOrdered - totalProduced
  dueDate: string
}
```

> **Note on `totalProduced`:** Production logs are tagged with `model_id` only, not `order_id`. A model's produced count is shared across all orders containing it — the same caveat that applies to the dashboard filter (see T5.4). `balanceRemaining` may go negative if production exceeds this specific order's quantity, which is expected when the same model runs across multiple orders.

Update `ModelProgressTable` to add an **Order #** column and wrap each model name in a `<Link href={/dashboard/progress/${row.orderId}/${row.modelId}}>`.

---

#### Part B — Query function `getOrderModelSteps`

**File:** `lib/db/order-model-tracker.ts`

```typescript
export type StepTrackerRow = {
  stationId: string
  stationName: string
  sequence: number
  cumulativeOutput: number   // sum of period_log.actual for (model_id, station_id)
  activeInputs: number       // prevStep.cumulativeOutput - this.cumulativeOutput (0 for seq=1)
  orderQty: number           // from order_lines for this order+model
  attainmentPct: number | null  // cumulativeOutput / orderQty * 100
}

export type StepPeriodPoint = {
  label: string              // e.g. "2026-07-01 P3"
  date: string
  period: string
  periodOutput: number       // actual for this step on this date+period
  cumulativeOutput: number   // running total up to and including this point
  activeInputs: number       // prevStep cumulative at this point - thisStep cumulative at this point
}

export async function getOrderModelSteps(
  orderId: string,
  modelId: string
): Promise<{ rows: StepTrackerRow[]; orderNumber: string; modelName: string }> { ... }

export async function getStepPeriodData(
  modelId: string,
  stationId: string,
  prevStationId: string | null  // null for the first step
): Promise<StepPeriodPoint[]> { ... }
```

**`getOrderModelSteps` implementation outline:**
1. Fetch `order_lines` where `order_id = orderId AND model_id = modelId AND active = true` → get `orderQty`, `orderNumber`, `modelName`
2. Fetch active `model_station_config` for `model_id = modelId`, joined to `stations`, ordered by `sequence`
3. For each station, sum `period_log.actual` where `model_id = modelId AND station_id = station.id`
4. Compute `activeInputs` = previous station's `cumulativeOutput` − this station's `cumulativeOutput` (0 for sequence 1)
5. Compute `attainmentPct` = `cumulativeOutput / orderQty * 100` (null if `orderQty === 0`)

**`getStepPeriodData` implementation outline:**
1. Fetch all `period_log` rows for `(model_id, station_id)` ordered by `(date, period)`
2. Build running `cumulativeOutput` as a prefix sum
3. If `prevStationId` is provided: also fetch all logs for `(model_id, prevStationId)`, build a prefix sum keyed by `(date, period)`, and compute `activeInputs` = prevStep cumulative at that point − thisStep cumulative at that point
4. Return the merged array

---

#### Part C — Page + components

**`app/dashboard/progress/[orderId]/[modelId]/page.tsx`**

Server component. Reads `orderId` and `modelId` from params.
- Validate both are valid UUIDs; redirect to `/dashboard/progress` if not
- Call `requireRole('supervisor')`
- Call `getOrderModelSteps(orderId, modelId)` → pass rows + metadata to `StepTrackerTable`

```typescript
export default async function OrderModelTrackerPage({
  params,
}: {
  params: Promise<{ orderId: string; modelId: string }>
}) {
  await requireRole('supervisor')
  const { orderId, modelId } = await params
  // UUID validation — redirect if invalid
  const { rows, orderNumber, modelName } = await getOrderModelSteps(orderId, modelId)

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{modelName}</h1>
        <p className="text-sm text-gray-500">Order {orderNumber}</p>
      </div>
      <StepTrackerTable
        rows={rows}
        modelId={modelId}
        prevStationIds={/* map of stationId → prevStationId */}
      />
    </div>
  )
}
```

**`components/dashboard/StepTrackerTable.tsx`** — client component

- Renders a table: Step | Cumulative Output | Active Inputs | Attainment %
- Selected row state (`selectedStationId`) — clicking a row sets it
- When a row is selected, renders `<StepOutputChart>` in the right panel
- `StepOutputChart` fetches its own data client-side via a server action `getStepPeriodData` (or pass through a fetch to a server action)
- Layout: `flex gap-6` — table takes ~40%, chart takes ~60%

```typescript
type Props = {
  rows: StepTrackerRow[]
  modelId: string
  prevStationIds: Record<string, string | null>  // stationId → prevStationId
}
```

**`components/dashboard/StepOutputChart.tsx`** — client component

Uses Recharts `ComposedChart`:
- `Bar` series for `periodOutput` (left axis)
- `Bar` series for `activeInputs` (left axis, different colour)
- `Line` series for `cumulativeOutput` (right axis, `yAxisId="right"`)
- `XAxis` keyed on `label` (date + period string)
- `Legend`, `Tooltip`, `ResponsiveContainer`

Fetches its data by calling `getStepPeriodData` as a server action when `stationId` prop changes.

---

#### Verification

- [ ] Navigate to Model Progress → confirm each row shows Order # and model name is a link
- [ ] Click a model row → confirm Step Tracker page loads with correct step table
- [ ] Confirm Cumulative Output is the sum of all `period_log.actual` for that model + station
- [ ] Confirm Active Inputs = previous step cumulative − this step cumulative
- [ ] Confirm Order Attainment % = cumulative / order quantity
- [ ] Select a step → confirm chart renders with three series (line + two bars)
- [ ] Confirm cumulative line matches running total of bar values

- [ ] **Commit**

```bash
npm install recharts
git add lib/db/order-model-tracker.ts app/dashboard/progress/ components/dashboard/StepTrackerTable.tsx components/dashboard/StepOutputChart.tsx
git commit -m "feat: order-model step tracker with per-step chart (T5.6)"
```

---

## Milestone 6: Keep-alive + Root Routes + Deploy 🔵 Anyka

### Task 6.1: Keep-alive endpoint + root redirect

**Files:**
- Create: `app/api/ping/route.ts`, `app/layout.tsx`, `app/page.tsx`

- [x] **Create `app/api/ping/route.ts`**

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createAdminClient()
  // Simple query to keep Supabase active
  await supabase.from('stations').select('id').limit(1)
  return NextResponse.json({ ok: true, ts: new Date().toISOString() })
}
```

- [x] **Create `app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'YTC Production',
  description: 'Factory production tracking',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  )
}
```

- [x] **Create `app/page.tsx`** — redirect based on session

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')
  // Line leads go directly to entry, not login
  redirect('/entry')
}
```

- [x] **Test the ping endpoint**

```bash
curl http://localhost:3000/api/ping
```

Expected: `{"ok":true,"ts":"2026-..."}`

- [x] **Commit**

```bash
git add app/api/ping/ app/layout.tsx app/page.tsx
git commit -m "feat: keep-alive ping endpoint and root redirect"
```

---

### Task 6.2: Deploy to Vercel

- [x] **Push branch to GitHub** (via PR per repo workflow, not directly to `main`)

- [x] **Create Vercel project**
  1. Go to vercel.com → New Project → Import your GitHub repo
  2. Framework: Next.js (auto-detected)
  3. Add all environment variables from `.env.local`:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
     - `SUPABASE_SECRET_KEY`
     - `NEXT_PUBLIC_SITE_URL` → set to your Vercel production URL (`https://ytc-data.vercel.app`, no trailing slash)
  4. Deploy

- [x] **Add production URL to Supabase OAuth redirect list**

In Supabase → Authentication → URL Configuration:
  - Site URL: `https://ytc-data.vercel.app`
  - Redirect URLs (allowlist, keep both): `https://ytc-data.vercel.app/api/auth/callback` and `http://localhost:3000/api/auth/callback` (for local dev)

- [x] **Smoke-test production deployment**

1. Visit `https://ytc-data.vercel.app/entry` — entry form loads ✓
2. Submit an entry → confirm it writes to Supabase ✓
3. Visit `/login` → sign in with Google → land on dashboard ✓
4. Visit `/api/ping` → returns `{"ok":true}` ✓

- [x] **Commit** (Vercel config is automatic, just confirm deploy succeeds)

---

### Task 6.3: Configure keep-alive cron

- [x] **Set up cron-job.org**
  1. Create a free account at cron-job.org
  2. New cronjob → URL: `https://ytc-data.vercel.app/api/ping`
  3. Schedule: Daily (any time)
  4. Save and enable

- [x] **Verify** — trigger the cron manually from the dashboard, confirm it returns HTTP 200.

---

## Post-MVP Verification Checklist

Run through all 10 items from tech spec section 11:

- [ ] Entry form submits a log entry — row in `period_log` with correct `submitted_by`
- [ ] Wrong password → inline error, no DB row written
- [ ] Duplicate submission → warning appears, proceed on confirm
- [ ] Edit + audit log → `period_log_edits` row created with correct `edited_by` and old/new values
- [ ] Daily summary → attainment %, variance, defects display correctly
- [ ] Model progress → balance remaining updates after logging production
- [ ] Pipeline view → WIP and gap-to-goal reflect actual vs upstream output
- [ ] Admin CRUD → create/deactivate station; confirm dropdown updates; historical logs intact
- [ ] Role gating → line lead cannot access `/dashboard`; supervisor can; admin can access `/admin/accounts`
- [ ] Keep-alive → `/api/ping` returns 200; cron-job.org configured and confirmed
