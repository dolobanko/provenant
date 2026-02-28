import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getErrorMessage } from '../lib/api';
import { ChevronRight, ArrowLeft } from 'lucide-react';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
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
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-900/30 border border-green-700 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✉️</span>
              </div>
              <h1 className="text-lg font-bold text-white mb-2">Check your email</h1>
              <p className="text-sm text-gray-400 mb-6">
                If <span className="text-white">{email}</span> is registered, you'll receive a reset link shortly. Check your spam folder if you don't see it.
              </p>
              <Link to="/login" className="btn-secondary flex items-center justify-center gap-2 w-full">
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-white mb-2">Forgot password?</h1>
              <p className="text-sm text-gray-400 mb-6">Enter your email and we'll send you a reset link.</p>

              {error && (
                <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <p className="mt-4 text-center text-sm text-gray-500">
                <Link to="/login" className="text-brand-400 hover:text-brand-300 flex items-center justify-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Back to Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
