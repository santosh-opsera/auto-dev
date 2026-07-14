import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { fetchCurrentUser } from './api/auth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ApprovalGatePage } from './pages/ApprovalGatePage';
import { DashboardPage } from './pages/DashboardPage';
import { ConventionsPage } from './pages/ConventionsPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { LoginPage } from './pages/LoginPage';
import { PrdReviewPage } from './pages/PrdReviewPage';
import { RepositoriesPage } from './pages/RepositoriesPage';
import { TicketIngestPage } from './pages/TicketIngestPage';
import { WorkflowDetailPage } from './pages/WorkflowDetailPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { useAuthStore } from './store/authStore';
import { useLocaleStore } from './store/localeStore';
import { useThemeStore } from './store/themeStore';
import './App.css';

function AppRoutes() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const detectLocale = useLocaleStore((state) => state.detectLocale);
  const initTheme = useThemeStore((state) => state.initTheme);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    detectLocale();
  }, [detectLocale]);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  useEffect(() => {
    let active = true;

    const bootstrap = async (): Promise<void> => {
      try {
        const response = await fetchCurrentUser();
        if (active) {
          setAuth(response.user, response.session);
        }
      } catch {
        if (active) {
          clearAuth();
        }
      } finally {
        if (active) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [clearAuth, setAuth]);

  if (isBootstrapping) {
    return (
      <main className="auth-page" aria-live="polite">
        <p>Loading session…</p>
      </main>
    );
  }

  const handleLogoutComplete = (): void => {
    navigate('/login', { replace: true });
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route element={<ProtectedRoute onLogoutComplete={handleLogoutComplete} />}>
        <Route path="/conventions" element={<ConventionsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/repositories" element={<RepositoriesPage />} />
        <Route path="/tickets" element={<TicketIngestPage />} />
        <Route path="/approvals/:requestId" element={<ApprovalGatePage />} />
        <Route path="/prd/:id" element={<PrdReviewPage mode="byId" />} />
        <Route path="/tickets/:ticketKey/prd" element={<PrdReviewPage mode="byTicket" />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/workflows/:id" element={<WorkflowDetailPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
