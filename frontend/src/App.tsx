import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useFirebaseAuthContext } from './hooks/useFirebaseAuth';
import { AuthGate } from './components/AuthGate';
import { LandingPage } from './pages/marketing/LandingPage';
import { PricingPage } from './pages/marketing/PricingPage';
import { AboutPage } from './pages/marketing/AboutPage';
import { ComponentLibraryPage } from './pages/marketing/ComponentLibraryPage';
import { Dashboard } from './pages/Dashboard';
import { Workspace } from './components/Workspace';
import { GettingStartedPage } from './pages/GettingStartedPage';
import { ProfilePage } from './pages/user/ProfilePage';
import { SettingsPage } from './pages/user/SettingsPage';
import { SubscriptionPage } from './pages/user/SubscriptionPage';
import { AdminPanel } from './pages/admin/AdminPanel';
import { AppShell } from './components/AppShell';
import './App.css';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useFirebaseAuthContext();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-lg bg-white px-6 py-4 shadow">
          <p className="text-sm text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthGate>
        {children}
      </AuthGate>
    );
  }

  return <>{children}</>;
}

// Public route wrapper (redirects to dashboard if logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useFirebaseAuthContext();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-lg bg-white px-6 py-4 shadow">
          <p className="text-sm text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return !user ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public marketing pages */}
      <Route
        path="/"
        element={(
          <PublicRoute>
            <AppShell variant="marketing">
              <LandingPage />
            </AppShell>
          </PublicRoute>
        )}
      />
      <Route
        path="/pricing"
        element={(
          <AppShell>
            <PricingPage />
          </AppShell>
        )}
      />
      <Route
        path="/about"
        element={(
          <AppShell>
            <AboutPage />
          </AppShell>
        )}
      />
      <Route
        path="/components"
        element={(
          <AppShell>
            <ComponentLibraryPage />
          </AppShell>
        )}
      />

      {/* Protected user pages */}
      <Route
        path="/dashboard"
        element={(
          <ProtectedRoute>
            <AppShell>
              <Dashboard />
            </AppShell>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/workspace/:id?"
        element={(
          <ProtectedRoute>
            <AppShell>
              <Workspace />
            </AppShell>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/getting-started"
        element={(
          <ProtectedRoute>
            <AppShell>
              <GettingStartedPage />
            </AppShell>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/profile"
        element={(
          <ProtectedRoute>
            <AppShell>
              <ProfilePage />
            </AppShell>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/settings"
        element={(
          <ProtectedRoute>
            <AppShell>
              <SettingsPage />
            </AppShell>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/subscription"
        element={(
          <ProtectedRoute>
            <AppShell>
              <SubscriptionPage />
            </AppShell>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/admin"
        element={(
          <ProtectedRoute>
            <AppShell>
              <AdminPanel />
            </AppShell>
          </ProtectedRoute>
        )}
      />

      {/* 404 fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
