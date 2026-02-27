import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { Users, Plus, Trash2, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { getUser } from '../lib/auth';

interface Member { id: string; name: string; email: string; role: string; createdAt: string; }
interface Invitation {
  id: string; email: string; role: string; expiresAt: string;
  invitedBy: { name: string; email: string };
}

export function TeamPage() {
  const qc = useQueryClient();
  const currentUser = getUser();
  const [open, setOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'MEMBER' });
  const [error, setError] = useState('');

  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ['team-members'],
    queryFn: () => api.get('/org/members').then((r) => r.data),
  });

  const { data: invitations = [] } = useQuery<Invitation[]>({
    queryKey: ['invitations'],
    queryFn: () => api.get('/org/invitations').then((r) => r.data),
  });

  const invite = useMutation({
    mutationFn: (body: object) => api.post('/org/invitations', body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['invitations'] });
      setInviteLink(res.data.inviteLink);
      setOpen(false);
      setForm({ email: '', role: 'MEMBER' });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/org/members/${userId}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-members'] }),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => api.delete(`/org/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-members'] }),
  });

  const cancelInvitation = useMutation({
    mutationFn: (id: string) => api.delete(`/org/invitations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations'] }),
  });

  const isOwner = currentUser?.role === 'OWNER';
  const isAdminOrOwner = isOwner || currentUser?.role === 'ADMIN';

  function copyLink() {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <PageHeader
        title="Team"
        description="Manage members and send invitations"
        action={
          isAdminOrOwner ? (
            <button
              onClick={() => { setOpen(true); setError(''); }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Invite Member
            </button>
          ) : undefined
        }
      />

      {/* Invite link banner */}
      {inviteLink && (
        <div className="mb-6 p-4 bg-brand-900/20 border border-brand-800 rounded-xl">
          <p className="text-sm font-medium text-brand-300 mb-2">
            Invitation link — share with the invitee:
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 text-xs font-mono text-gray-200 bg-gray-900 px-3 py-2 rounded-lg truncate">
              {inviteLink}
            </code>
            <button onClick={copyLink} className="btn-secondary flex items-center gap-1 shrink-0">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Members table */}
      <div className="card mb-6 overflow-x-auto">
        <h2 className="font-semibold text-white mb-4">Members</h2>
        {isLoading ? (
          <div className="text-gray-500 text-sm">Loading…</div>
        ) : members.length === 0 ? (
          <EmptyState icon={Users} title="No members" description="Invite team members to collaborate." />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Email</th>
                <th className="table-header">Role</th>
                <th className="table-header">Joined</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="table-row">
                  <td className="table-cell font-medium text-white">{m.name}</td>
                  <td className="table-cell text-gray-400">{m.email}</td>
                  <td className="table-cell">
                    {isOwner && m.id !== currentUser?.id ? (
                      <select
                        className="input py-1 text-xs"
                        value={m.role}
                        onChange={(e) => changeRole.mutate({ userId: m.id, role: e.target.value })}
                      >
                        {['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="badge badge-gray">{m.role}</span>
                    )}
                  </td>
                  <td className="table-cell text-xs">
                    {format(new Date(m.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="table-cell">
                    {isAdminOrOwner && m.id !== currentUser?.id && (
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${m.name} from the team?`)) removeMember.mutate(m.id);
                        }}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-white mb-4">Pending Invitations</h2>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Email</th>
                <th className="table-header">Role</th>
                <th className="table-header">Invited by</th>
                <th className="table-header">Expires</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id} className="table-row">
                  <td className="table-cell text-white">{inv.email}</td>
                  <td className="table-cell"><span className="badge badge-gray">{inv.role}</span></td>
                  <td className="table-cell text-gray-400 text-xs">{inv.invitedBy.name}</td>
                  <td className="table-cell text-xs">{format(new Date(inv.expiresAt), 'MMM d, yyyy')}</td>
                  <td className="table-cell">
                    <button
                      onClick={() => cancelInvitation.mutate(inv.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Invite Team Member">
        {error && (
          <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">
            {error}
          </div>
        )}
        <form
          onSubmit={(e) => { e.preventDefault(); invite.mutate(form); }}
          className="space-y-4"
        >
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              placeholder="teammate@company.com"
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="ADMIN">Admin — full access except owner actions</option>
              <option value="MEMBER">Member — create and edit resources</option>
              <option value="VIEWER">Viewer — read-only access</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={invite.isPending} className="btn-primary flex-1">
              {invite.isPending ? 'Sending…' : 'Send Invitation'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
