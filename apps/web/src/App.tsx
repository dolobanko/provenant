import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { AgentsPage } from './pages/AgentsPage';
import { AgentDetailPage } from './pages/AgentDetailPage';
import { EnvironmentsPage } from './pages/EnvironmentsPage';
import { ConfigsPage } from './pages/ConfigsPage';
import { EvalsPage } from './pages/EvalsPage';
import { EvalRunPage } from './pages/EvalRunPage';
import { DriftPage } from './pages/DriftPage';
import { SessionsPage } from './pages/SessionsPage';
import { SessionDetailPage } from './pages/SessionDetailPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { AuditPage } from './pages/AuditPage';
import { PromotionsPage } from './pages/PromotionsPage';
import { ApiKeysPage } from './pages/ApiKeysPage';
import { TeamPage } from './pages/TeamPage';
import { WebhooksPage } from './pages/WebhooksPage';
import { PricingPage } from './pages/PricingPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { getUser } from './lib/auth';

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getUser() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public marketing pages */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />

        {/* Auth pages */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Authenticated app — all dashboard routes nested under RequireAuth + Layout */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
        </Route>

        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="agents" element={<AgentsPage />} />
          <Route path="agents/:id" element={<AgentDetailPage />} />
          <Route path="environments" element={<EnvironmentsPage />} />
          <Route path="promotions" element={<PromotionsPage />} />
          <Route path="configs" element={<ConfigsPage />} />
          <Route path="evals" element={<EvalsPage />} />
          <Route path="evals/runs/:id" element={<EvalRunPage />} />
          <Route path="drift" element={<DriftPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="sessions/:id" element={<SessionDetailPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="policies" element={<PoliciesPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="api-keys" element={<ApiKeysPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="webhooks" element={<WebhooksPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
