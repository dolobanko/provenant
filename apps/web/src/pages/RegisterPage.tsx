import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, getErrorMessage } from '../lib/api';
import { setAuth } from '../lib/auth';
import { ChevronRight } from 'lucide-react';

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', orgName: '', orgSlug: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleOrgName(name: string) {
    setForm({ ...form, orgName: name, orgSlug: name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      setAuth(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
            <ChevronRight className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">Provenant</span>
        </div>
        <div className="card">
          <h1 className="text-xl font-bold text-white mb-6">Create your workspace</h1>
          {error && (
            <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Your name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
            </div>
            <div>
              <label className="label">Organization name</label>
              <input className="input" value={form.orgName} onChange={(e) => handleOrgName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Organization slug</label>
              <input className="input" value={form.orgSlug} onChange={(e) => setForm({ ...form, orgSlug: e.target.value })} required pattern="[a-z0-9-]+" />
              <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, and hyphens only</p>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Creating…' : 'Create workspace'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
