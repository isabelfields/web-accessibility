'use client'

import { useState, useEffect, useCallback } from 'react'
import { HEARST_DIVISIONS } from '@/types'
import { Modal } from '@/components/Modal'
import { Pagination } from '@/components/Pagination'

const PAGE_SIZE = 15

interface AppUser {
  id: string
  email: string
  role: 'admin' | 'user'
  allowed_divisions: string[]
  invited_by: string | null
  created_at: string
  pending: boolean
}

function InviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: (link: string) => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'user'>('user')
  const [divisions, setDivisions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleDivision(d: string) {
    setDivisions(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role, allowedDivisions: role === 'admin' ? [] : divisions }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to create invite')
      return
    }
    const data = await res.json()
    const baseUrl = window.location.origin
    onCreated(`${baseUrl}/invite/${data.invite_token}`)
  }

  return (
    <Modal title="Invite user" onClose={onClose} size="md">
        <form onSubmit={submit} className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as 'admin' | 'user')}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="user">User (division-restricted)</option>
              <option value="admin">Admin (full access)</option>
            </select>
          </div>
          {role === 'user' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Allowed divisions <span className="text-gray-400 font-normal">(select at least one)</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                {HEARST_DIVISIONS.map(d => (
                  <label key={d} className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={divisions.includes(d)}
                      onChange={() => toggleDivision(d)}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">{d}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading || (role === 'user' && divisions.length === 0)}
              className="flex-1 bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating…' : 'Create invite link'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
    </Modal>
  )
}

function InviteLinkModal({ link, onClose }: { link: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Modal title="Invite link created" onClose={onClose} size="md">
      <div className="p-6">
        <p className="text-sm text-gray-500 mb-4">Share this link with the user. It expires in 7 days.</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={link}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-600 truncate"
          />
          <button
            onClick={copy}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <button onClick={onClose} className="mt-4 w-full border border-gray-200 text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors">
          Done
        </button>
      </div>
    </Modal>
  )
}

function EditDivisionsModal({ user, onClose, onSaved }: { user: AppUser; onClose: () => void; onSaved: () => void }) {
  const [divisions, setDivisions] = useState<string[]>(user.allowed_divisions ?? [])
  const [loading, setLoading] = useState(false)

  function toggleDivision(d: string) {
    setDivisions(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  async function save() {
    setLoading(true)
    await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowedDivisions: divisions }),
    })
    setLoading(false)
    onSaved()
  }

  return (
    <Modal title="Edit divisions" onClose={onClose} size="md">
      <div className="p-6">
        <p className="text-sm text-gray-400 mb-4">{user.email}</p>
        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto mb-4">
          {HEARST_DIVISIONS.map(d => (
            <label key={d} className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-gray-50">
              <input
                type="checkbox"
                checked={divisions.includes(d)}
                onChange={() => toggleDivision(d)}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">{d}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={loading || divisions.length === 0}
            className="flex-1 bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('Failed to load users')
      setUsers(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const q = query.trim().toLowerCase()
  const filtered = q ? users.filter(u => u.email.toLowerCase().includes(q)) : users
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  async function changeRole(user: AppUser, newRole: 'admin' | 'user') {
    await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole, allowedDivisions: newRole === 'admin' ? [] : user.allowed_divisions }),
    })
    load()
  }

  async function deleteUser(user: AppUser) {
    if (!confirm(`Remove ${user.email}? This cannot be undone.`)) return
    await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Users</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage who has access and what they can see</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Invite user
        </button>
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onCreated={link => { setShowInvite(false); setInviteLink(link); load() }}
        />
      )}
      {inviteLink && (
        <InviteLinkModal link={inviteLink} onClose={() => setInviteLink(null)} />
      )}
      {editingUser && (
        <EditDivisionsModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => { setEditingUser(null); load() }}
        />
      )}

      <div className="mb-4">
        <input
          type="search"
          value={query}
          onChange={e => { setQuery(e.target.value); setPage(1) }}
          placeholder="Search by email…"
          aria-label="Search users by email"
          className="w-full max-w-xs px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} <button onClick={load} className="underline font-medium">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : (
        <div className="rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Divisions</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                    {query ? 'No users match your search.' : 'No users yet.'}
                  </td>
                </tr>
              )}
              {visible.map(user => (
                <tr key={user.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={e => changeRole(user, e.target.value as 'admin' | 'user')}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="admin">Admin</option>
                      <option value="user">User</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {user.role === 'admin' ? (
                      <span className="text-xs text-gray-400 italic">All divisions</span>
                    ) : user.allowed_divisions?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {user.allowed_divisions.map(d => (
                          <span key={d} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            {d}
                          </span>
                        ))}
                        <button
                          onClick={() => setEditingUser(user)}
                          className="text-xs text-gray-400 hover:text-gray-600 underline ml-1"
                        >
                          edit
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingUser(user)}
                        className="text-xs text-red-400 hover:text-red-600 underline"
                      >
                        No divisions — click to assign
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.pending ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        Pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteUser(user)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={currentPage} pageCount={pageCount} onPage={setPage} />
        </div>
      )}
    </div>
  )
}
