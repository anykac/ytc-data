# Admin Fixes: Invite Role Bug, Account Deletion, Nav Order — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the invite flow so newly invited supervisors can log in immediately, add the ability for admins to delete supervisor/no-role accounts from the Accounts tab, and reorder the admin side nav so Leads appears above Stations.

**Architecture:** All server-side logic lives in `actions/admin.ts` alongside the existing CRUD actions, following the file's established `toResult` wrapper + explicit `{ error }` return pattern. `inviteUser` gains a `user_roles` upsert right after the Supabase invite call. A new `deleteUser` action enforces admin-only, no-self-delete, no-admin-target rules server-side before calling `supabase.auth.admin.deleteUser`. `AccountsAdmin.tsx` gets a per-row Delete control that mirrors the existing per-row role dropdown (local state, inline error, disabled-while-saving). `app/admin/layout.tsx` gets a one-line reorder of its static `navItems` array.

**Tech Stack:** Next.js App Router server actions, Supabase Auth Admin API (`@supabase/supabase-js`), Jest + ts-jest (node environment) for action-level tests.

## Global Constraints

- Every Supabase call must destructure and check `error` before using `data` (see `CLAUDE.md` Implementation Standards #2).
- Auth/role checks must use explicit allowlists, never a single negative check (`CLAUDE.md` Implementation Standards #3).
- All admin actions require `requireRole('admin')` from `lib/auth/session.ts` before touching data.
- Follow the existing `toResult(fn)` wrapper in `actions/admin.ts:13-21` for every new/modified action — it converts thrown errors into `{ error: message }` so Server Action digest redaction in production doesn't swallow user-facing validation errors.
- Test file: `__tests__/admin-actions.test.ts`, run via `npm test`. Mocks `@/lib/auth/session`, `@/lib/supabase/admin`, and `next/cache` (see file header, lines 1-3) — do not add new global mocks, extend the `createAdminClient` mock return value per-test instead.
- No component-level test infrastructure exists in this repo (no `.test.tsx` files, no `@testing-library/*` dependency) — UI changes are verified manually via `npm run dev`, not automated tests.

---

### Task 1: Auto-assign supervisor role on invite

**Files:**
- Modify: `actions/admin.ts:384-393` (`inviteUser`)
- Test: `__tests__/admin-actions.test.ts`

**Interfaces:**
- Consumes: existing `toResult`, `createAdminClient`, `requireRole` from this file's top-level imports.
- Produces: `inviteUser(email: string): Promise<ActionResult>` — same signature as today, no callers elsewhere need to change (confirmed only caller is `app/admin/accounts/AccountsAdmin.tsx:38`).

**Context:** Today `inviteUser` only calls `supabase.auth.admin.inviteUserByEmail(email)`. The invited user gets a Supabase Auth account but no `user_roles` row. `requireRole` (`lib/auth/session.ts:24`) redirects anyone with no `user_roles` row to `/login?error=unauthorized`, so the invited person cannot log in until an admin manually sets their role from the Accounts table — but they don't show up with a meaningful state until they try to log in once, and admins have no reason to know to do this. Fix: assign `role: 'supervisor'` immediately when the invite is sent, using the `user.id` Supabase returns from `inviteUserByEmail`.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/admin-actions.test.ts` (add `inviteUser` to the existing import on line 5, and add `deleteUser` too since Task 2 needs it in the same import — update line 5 to `import { upsertStation, reorderStations, upsertOrder, inviteUser, deleteUser } from '@/actions/admin'`):

```ts
describe('inviteUser', () => {
  it('assigns the supervisor role immediately after a successful invite', async () => {
    ;(requireRole as jest.Mock).mockResolvedValue({ user: { id: 'admin-1' }, role: 'admin' })
    const inviteMock = jest.fn().mockResolvedValue({ data: { user: { id: validId(30) } }, error: null })
    const upsertMock = jest.fn().mockResolvedValue({ error: null })
    ;(createAdminClient as jest.Mock).mockReturnValue({
      auth: { admin: { inviteUserByEmail: inviteMock } },
      from: (table: string) => {
        if (table === 'user_roles') return { upsert: upsertMock }
        throw new Error(`unexpected table ${table}`)
      },
    })

    const result = await inviteUser('new@example.com')

    expect(result.error).toBeUndefined()
    expect(inviteMock).toHaveBeenCalledWith('new@example.com')
    expect(upsertMock).toHaveBeenCalledWith(
      { user_id: validId(30), role: 'supervisor' },
      { onConflict: 'user_id' }
    )
  })

  it('surfaces an error if role assignment fails after a successful invite', async () => {
    ;(requireRole as jest.Mock).mockResolvedValue({ user: { id: 'admin-1' }, role: 'admin' })
    ;(createAdminClient as jest.Mock).mockReturnValue({
      auth: {
        admin: {
          inviteUserByEmail: jest.fn().mockResolvedValue({ data: { user: { id: validId(30) } }, error: null }),
        },
      },
      from: () => ({ upsert: jest.fn().mockResolvedValue({ error: new Error('db down') }) }),
    })

    const result = await inviteUser('new@example.com')
    expect(result.error).toBe('db down')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- admin-actions`
Expected: FAIL — `upsertMock` never called / `inviteMock` throws because current `inviteUser` implementation never calls `createAdminClient().from(...)` and the mock's `auth.admin.inviteUserByEmail` shape doesn't match what the real code path expects yet (current code destructures `{ error }`, ignoring `data`, so the first test fails on the `upsertMock` assertion never being satisfied).

- [ ] **Step 3: Implement**

Replace `actions/admin.ts:384-393`:

```ts
export async function inviteUser(email: string): Promise<ActionResult> {
  return toResult(async () => {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('Invalid email address')
  await requireRole('admin')
  const supabase = createAdminClient()
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email)
  if (error) throw error

  const { error: roleError } = await supabase
    .from('user_roles')
    .upsert({ user_id: data.user.id, role: 'supervisor' }, { onConflict: 'user_id' })
  if (roleError) throw roleError
  revalidatePath('/admin/accounts')
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- admin-actions`
Expected: PASS — both new `inviteUser` tests green, all pre-existing tests in the file still green.

- [ ] **Step 5: Commit**

```bash
git add actions/admin.ts __tests__/admin-actions.test.ts
git commit -m "fix: auto-assign supervisor role when inviting a new user"
```

---

### Task 2: Add `deleteUser` server action

**Files:**
- Modify: `actions/admin.ts` (add new export near `setUserRole`/`removeUserRole`, after `removeUserRole` at line 382, before `inviteUser`)
- Test: `__tests__/admin-actions.test.ts`

**Interfaces:**
- Consumes: `toResult`, `assertUuid`, `createAdminClient`, `requireRole`, `revalidatePath` (all already imported/defined in this file).
- Produces: `deleteUser(userId: string): Promise<ActionResult>` — new export, will be imported by `AccountsAdmin.tsx` in Task 3.

**Context:** Admins need to permanently remove a supervisor or no-role account (not just their role — the full Supabase Auth account). Rules, enforced server-side so the UI can't be bypassed:
1. Must be an admin (`requireRole('admin')`).
2. Cannot delete your own account.
3. Cannot delete an account whose current role is `admin`.

`user_roles.user_id` has `ON DELETE CASCADE` to `auth.users(id)` (`supabase/migrations/20260621173019_initial_schema.sql:52`), so deleting the Auth user automatically removes their `user_roles` row — no separate cleanup needed.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/admin-actions.test.ts` (the `deleteUser` import was already added in Task 1's Step 1):

```ts
describe('deleteUser', () => {
  it('rejects deleting your own account', async () => {
    ;(requireRole as jest.Mock).mockResolvedValue({ user: { id: validId(1) }, role: 'admin' })

    const result = await deleteUser(validId(1))
    expect(result.error).toMatch(/own account/i)
  })

  it('rejects deleting an account with the admin role', async () => {
    ;(requireRole as jest.Mock).mockResolvedValue({ user: { id: validId(1) }, role: 'admin' })
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'admin' }, error: null }) }) }),
      }),
    })

    const result = await deleteUser(validId(2))
    expect(result.error).toMatch(/admin account/i)
  })

  it('deletes the auth user when the target is a supervisor', async () => {
    ;(requireRole as jest.Mock).mockResolvedValue({ user: { id: validId(1) }, role: 'admin' })
    const deleteUserMock = jest.fn().mockResolvedValue({ error: null })
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'supervisor' }, error: null }) }) }),
      }),
      auth: { admin: { deleteUser: deleteUserMock } },
    })

    const result = await deleteUser(validId(2))

    expect(result.error).toBeUndefined()
    expect(deleteUserMock).toHaveBeenCalledWith(validId(2))
  })

  it('deletes the auth user when the target has no role assigned', async () => {
    ;(requireRole as jest.Mock).mockResolvedValue({ user: { id: validId(1) }, role: 'admin' })
    const deleteUserMock = jest.fn().mockResolvedValue({ error: null })
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }),
      auth: { admin: { deleteUser: deleteUserMock } },
    })

    const result = await deleteUser(validId(2))

    expect(result.error).toBeUndefined()
    expect(deleteUserMock).toHaveBeenCalledWith(validId(2))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- admin-actions`
Expected: FAIL — `deleteUser is not a function` (does not exist yet).

- [ ] **Step 3: Implement**

Insert into `actions/admin.ts` immediately after `removeUserRole` (which currently ends at line 382, right before the `inviteUser` section comment):

```ts
export async function deleteUser(userId: string): Promise<ActionResult> {
  return toResult(async () => {
  assertUuid(userId, 'userId')
  const { user } = await requireRole('admin')
  if (userId === user.id) throw new Error('Cannot delete your own account')
  const supabase = createAdminClient()

  const { data, error: roleFetchError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  if (roleFetchError) throw roleFetchError
  if (data?.role === 'admin') throw new Error('Cannot delete an admin account')

  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) throw error
  revalidatePath('/admin/accounts')
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- admin-actions`
Expected: PASS — all 4 new `deleteUser` tests green, all pre-existing tests in the file still green.

- [ ] **Step 5: Commit**

```bash
git add actions/admin.ts __tests__/admin-actions.test.ts
git commit -m "feat: add deleteUser admin action for removing supervisor/no-role accounts"
```

---

### Task 3: Add Delete control to the Accounts UI

**Files:**
- Modify: `app/admin/accounts/AccountsAdmin.tsx`

**Interfaces:**
- Consumes: `deleteUser(userId: string): Promise<ActionResult>` from Task 2 (`@/actions/admin`).
- Produces: no new exports — this is a leaf UI component, `AccountsPage` (`app/admin/accounts/page.tsx`) is unchanged.

**Context:** Mirror the existing per-row pattern (`saving`/`errors` state keyed by `userId`, disabled-while-saving) already used for role changes. Since a delete removes the row entirely, track the user list in local state (seeded from the `users` prop) so a successful delete can filter the row out immediately without waiting on a full page navigation. Hide the Delete control entirely for rows whose current role is `admin` (matches the server-side rule in Task 2 — defense in depth, not the only guard). Use `window.confirm` before calling the action, matching the existing pattern in `app/admin/stations/StationsAdmin.tsx:39`.

- [ ] **Step 1: Implement**

Replace the full contents of `app/admin/accounts/AccountsAdmin.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { setUserRole, removeUserRole, inviteUser, deleteUser } from '@/actions/admin'

type User = { id: string; email: string; role: 'supervisor' | 'admin' | null }

export default function AccountsAdmin({ users: initialUsers }: { users: User[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [saving, setSaving] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [roles, setRoles] = useState<Record<string, string>>(
    Object.fromEntries(initialUsers.map((u) => [u.id, u.role ?? 'none']))
  )
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  async function changeRole(userId: string, value: string) {
    if (value === (roles[userId] ?? 'none')) return
    setSaving(userId)
    setErrors((e) => ({ ...e, [userId]: '' }))
    const result = value === 'none'
      ? await removeUserRole(userId)
      : await setUserRole(userId, value as 'supervisor' | 'admin')
    if (result.error) {
      setErrors((prev) => ({ ...prev, [userId]: result.error! }))
    } else {
      setRoles((r) => ({ ...r, [userId]: value }))
    }
    setSaving(null)
  }

  async function handleDelete(u: User) {
    if (!confirm(`Permanently delete the account for "${u.email}"? This cannot be undone.`)) return
    setSaving(u.id)
    setErrors((e) => ({ ...e, [u.id]: '' }))
    const result = await deleteUser(u.id)
    if (result.error) {
      setErrors((prev) => ({ ...prev, [u.id]: result.error! }))
      setSaving(null)
    } else {
      setUsers((list) => list.filter((x) => x.id !== u.id))
      setSaving(null)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteError('')
    setInviteSuccess('')
    const result = await inviteUser(inviteEmail)
    if (result.error) {
      setInviteError(result.error)
    } else {
      setInviteSuccess(`Invite sent to ${inviteEmail}`)
      setInviteEmail('')
    }
    setInviting(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Accounts</h1>
        </div>

        <form onSubmit={handleInvite} className="flex items-center gap-2">
          <input
            type="email"
            required
            placeholder="Invite by email…"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm text-gray-900 bg-white w-64"
          />
          <button
            type="submit"
            disabled={inviting}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {inviting ? 'Sending…' : 'Invite'}
          </button>
          {inviteSuccess && <span className="text-xs text-green-600">{inviteSuccess}</span>}
          {inviteError && <span className="text-xs text-red-500">{inviteError}</span>}
        </form>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Current role</th>
                <th className="px-4 py-3 font-medium">Set role</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{roles[u.id] === 'none' ? '—' : roles[u.id]}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={roles[u.id] ?? 'none'}
                        disabled={saving === u.id}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                        className="border rounded px-2 py-1 text-sm text-gray-900 bg-white disabled:opacity-50 cursor-pointer"
                      >
                        <option value="none">No role</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="admin">Admin</option>
                      </select>
                      {saving === u.id && <span className="text-xs text-gray-400">Saving…</span>}
                      {errors[u.id] && <span className="text-xs text-red-500">{errors[u.id]}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {roles[u.id] !== 'admin' && (
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={saving === u.id}
                        className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50 cursor-pointer"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Manually verify**

Run: `npm run dev`, sign in as an admin, go to `/admin/accounts`.
Expected:
- Rows with role Admin show no Delete control.
- Rows with role Supervisor or No role show a red "Delete" text button.
- Clicking Delete prompts a browser confirm dialog; cancelling does nothing.
- Confirming removes the row from the table immediately and the account no longer appears after a page refresh.
- Inviting a new email address, then setting that same account to Admin via the dropdown, then refreshing — the Delete button disappears for that row (confirms the role-based hide works live, not just from initial server data).

- [ ] **Step 3: Commit**

```bash
git add app/admin/accounts/AccountsAdmin.tsx
git commit -m "feat: add account deletion to the Accounts admin table"
```

---

### Task 4: Reorder side nav — Leads above Stations

**Files:**
- Modify: `app/admin/layout.tsx:7-14`

**Interfaces:**
- Consumes: none new.
- Produces: none new — purely a rendering-order change to the existing `navItems` array.

- [ ] **Step 1: Implement**

In `app/admin/layout.tsx`, reorder the `navItems` array (currently lines 7-14) so `Leads` comes before `Stations`:

```ts
  const navItems = [
    { href: '/admin/orders',   label: 'Orders',   adminOnly: false },
    { href: '/admin/models',   label: 'Models',   adminOnly: false },
    { href: '/admin/edit-history', label: 'Edit History', adminOnly: false },
    { href: '/admin/leads',    label: 'Leads',    adminOnly: false },
    { href: '/admin/stations', label: 'Stations', adminOnly: true  },
    { href: '/admin/accounts', label: 'Accounts', adminOnly: true  },
  ].filter((item) => !item.adminOnly || role === 'admin')
```

- [ ] **Step 2: Manually verify**

Run: `npm run dev`, sign in as a supervisor (non-admin) and as an admin, open any `/admin/*` page.
Expected: side nav shows Leads listed above Stations in both cases (Stations/Accounts still hidden for non-admins).

- [ ] **Step 3: Commit**

```bash
git add app/admin/layout.tsx
git commit -m "chore: move Leads above Stations in admin side nav"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers the invite-role bug; Tasks 2-3 cover account deletion (action + UI); Task 4 covers nav reorder. All three user-requested items have a task.
- **Type consistency:** `deleteUser(userId: string): Promise<ActionResult>` matches the `ActionResult` type already defined at `actions/admin.ts:11` and used by every other action; `AccountsAdmin.tsx` imports it with the same name and signature.
- **Placeholder scan:** none found — every step has literal code and literal commands.
