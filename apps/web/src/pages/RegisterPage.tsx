import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, getErrorMessage } from '../lib/api';
import { setAuth } from '../lib/auth';
import { ChevronRight } from 'lucide-react';

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

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

          {/* GitHub OAuth — fastest way to get started */}
          <a
            href="/api/auth/github"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 mb-4 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm font-medium text-white transition-colors"
          >
            <GithubIcon />
            Continue with GitHub
          </a>
          <div className="relative flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600">or sign up with email</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

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
