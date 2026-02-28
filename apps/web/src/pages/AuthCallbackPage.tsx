import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { setAuth } from '../lib/auth';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (error || !token) {
      navigate('/login?error=oauth_failed');
      return;
    }

    api
      .get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        setAuth(token, data);
        navigate('/dashboard');
      })
      .catch(() => navigate('/login?error=oauth_failed'));
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center animate-pulse">
          <ChevronRight className="w-6 h-6 text-white" />
        </div>
        <p className="text-gray-400 text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
