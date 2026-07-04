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
