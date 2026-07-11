import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { fetchCurrentUser } from './api/auth';
import { DashboardPage } from './pages/DashboardPage';
import { ConventionsPage } from './pages/ConventionsPage';
import { LoginPage } from './pages/LoginPage';
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
