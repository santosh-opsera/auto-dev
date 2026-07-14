import { useEffect } from 'react';
import { Navigate, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { SessionWarningModal } from './SessionWarningModal';
import { IntegrationBanner } from './IntegrationBanner';
import { SidebarNav } from './SidebarNav';
import { notifySSEListeners } from '../hooks/sseEventBus';
import { useSessionHeartbeat } from '../hooks/useSessionHeartbeat';
import { useSSE } from '../hooks/useSSE';
import { useAuthStore } from '../store/authStore';

export interface ProtectedRouteOutletContext {
  onLogoutComplete: () => void;
}

export function useProtectedRouteOutlet(): ProtectedRouteOutletContext {
  return useOutletContext<ProtectedRouteOutletContext>();
}

interface ProtectedRouteProps {
  onLogoutComplete?: () => void;
}

export function ProtectedRoute({ onLogoutComplete }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const handleLogoutComplete =
    onLogoutComplete ??
    (() => {
      navigate('/login', { replace: true });
    });

  useSessionHeartbeat(isAuthenticated);
  useSSE({
    enabled: isAuthenticated,
    onEvent: notifySSEListeners,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="protected-layout">
      <SidebarNav />
      <div className="protected-layout-main">
        <IntegrationBanner />
        <SessionWarningModal onLogoutComplete={handleLogoutComplete} />
        <Outlet context={{ onLogoutComplete: handleLogoutComplete } satisfies ProtectedRouteOutletContext} />
      </div>
    </div>
  );
}
