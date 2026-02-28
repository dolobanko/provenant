import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, getErrorMessage } from '../lib/api';
import { ChevronRight, CheckCircle } from 'lucide-react';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      // Redirect to login after 2 seconds
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="card w-full max-w-sm text-center">
          <p className="text-red-400 mb-4">Invalid reset link. Please request a new one.</p>
          <Link to="/forgot-password" className="btn-primary">Request new link</Link>
        </div>
      </div>
    );
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
          {done ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h1 className="text-lg font-bold text-white mb-2">Password updated!</h1>
              <p className="text-sm text-gray-400">Redirecting you to sign in…</p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-white mb-2">Set new password</h1>
              <p className="text-sm text-gray-400 mb-6">Choose a strong password (at least 8 characters).</p>

              {error && (
                <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">New password</label>
                  <input
                    type="password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">Confirm password</label>
                  <input
                    type="password"
                    className="input"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                  {loading ? 'Updating…' : 'Update password'}
                </button>
              </form>

              <p className="mt-4 text-center text-sm text-gray-500">
                <Link to="/login" className="text-brand-400 hover:text-brand-300">Back to Sign In</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
