import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
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
import { ConversationsPage } from './pages/ConversationsPage';
import { ConversationDetailPage } from './pages/ConversationDetailPage';
import { ReportsPage } from './pages/ReportsPage';
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
    <ToastProvider>
    <BrowserRouter>
      <Routes>
        {/* Public marketing pages */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />

        {/* Auth pages */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Authenticated app */}
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
          {/* Core BI pages */}
          <Route path="conversations" element={<ConversationsPage />} />
          <Route path="conversations/:id" element={<ConversationDetailPage />} />
          <Route path="reports" element={<ReportsPage />} />

          {/* Agent management */}
          <Route path="agents" element={<AgentsPage />} />
          <Route path="agents/:id" element={<AgentDetailPage />} />

          {/* Operations */}
          <Route path="promotions" element={<PromotionsPage />} />
          <Route path="policies" element={<PoliciesPage />} />
          <Route path="audit" element={<AuditPage />} />

          {/* Settings group */}
          <Route path="api-keys" element={<ApiKeysPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="webhooks" element={<WebhooksPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="environments" element={<EnvironmentsPage />} />
          <Route path="configs" element={<ConfigsPage />} />

          {/* Legacy / hidden (keep working) */}
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="sessions/:id" element={<SessionDetailPage />} />
          <Route path="evals" element={<EvalsPage />} />
          <Route path="evals/runs/:id" element={<EvalRunPage />} />
          <Route path="drift" element={<DriftPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  );
}
