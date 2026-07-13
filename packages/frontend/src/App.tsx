import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { fetchCurrentUser } from './api/auth';
import { ApprovalGatePage } from './pages/ApprovalGatePage';
import { DashboardPage } from './pages/DashboardPage';
import { ConventionsPage } from './pages/ConventionsPage';
import { LoginPage } from './pages/LoginPage';
import { PrdReviewPage } from './pages/PrdReviewPage';
import { RepositoriesPage } from './pages/RepositoriesPage';
import { TicketIngestPage } from './pages/TicketIngestPage';
import { WorkflowDetailPage } from './pages/WorkflowDetailPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { useAuthStore } from './store/authStore';
import './App.css';

function AppRoutes() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

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

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/conventions"
        element={
          isAuthenticated ? (
            <ConventionsPage onLogoutComplete={() => navigate('/login', { replace: true })} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/repositories"
        element={
          isAuthenticated ? (
            <RepositoriesPage onLogoutComplete={() => navigate('/login', { replace: true })} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/tickets"
        element={
          isAuthenticated ? (
            <TicketIngestPage onLogoutComplete={() => navigate('/login', { replace: true })} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/approvals/:requestId"
        element={
          isAuthenticated ? (
            <ApprovalGatePage onLogoutComplete={() => navigate('/login', { replace: true })} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/prd/:id"
        element={
          isAuthenticated ? (
            <PrdReviewPage
              mode="byId"
              onLogoutComplete={() => navigate('/login', { replace: true })}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/tickets/:ticketKey/prd"
        element={
          isAuthenticated ? (
            <PrdReviewPage
              mode="byTicket"
              onLogoutComplete={() => navigate('/login', { replace: true })}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/workflows"
        element={
          isAuthenticated ? (
            <WorkflowsPage onLogoutComplete={() => navigate('/login', { replace: true })} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/workflows/:id"
        element={
          isAuthenticated ? (
            <WorkflowDetailPage onLogoutComplete={() => navigate('/login', { replace: true })} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          isAuthenticated ? (
            <DashboardPage onLogoutComplete={() => navigate('/login', { replace: true })} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
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
