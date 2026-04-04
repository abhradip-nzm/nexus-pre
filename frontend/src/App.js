import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/layout/Sidebar';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Kanban from './pages/Kanban';
import Calendar from './pages/Calendar';
import Team from './pages/Team';
import Executives from './pages/Executives';
import Settings from './pages/Settings';
import ActivityLog from './pages/ActivityLog';
import WhatsApp from './pages/Whatsapp';
import AdminUsers from './pages/AdminUsers';
import AdminTeams from './pages/AdminTeams';
import AdminRoles from './pages/AdminRoles';
import AdminKanban from './pages/AdminKanban';
import './styles/global.css';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-secondary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="page-spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading Nexus Pre...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  if (roles && !roles.includes(user.role_name)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-secondary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="page-spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading Nexus Pre...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  if (user.role_name !== 'system_admin') return <Navigate to="/dashboard" replace />;
  return children;
}

function DefaultRedirect() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  if (user.role_name === 'system_admin') return <Navigate to="/admin/users" replace />;
  return <Navigate to="/dashboard" replace />;
}

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        {children}
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: '10px',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
            },
            success: {
              iconTheme: { primary: '#28a745', secondary: 'white' },
            },
            error: {
              iconTheme: { primary: '#dc3545', secondary: 'white' },
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Admin Routes - system_admin only */}
          <Route path="/admin/users" element={
            <AdminRoute>
              <AppLayout><AdminUsers /></AppLayout>
            </AdminRoute>
          } />
          <Route path="/admin/teams" element={
            <AdminRoute>
              <AppLayout><AdminTeams /></AppLayout>
            </AdminRoute>
          } />
          <Route path="/admin/roles" element={
            <AdminRoute>
              <AppLayout><AdminRoles /></AppLayout>
            </AdminRoute>
          } />
          <Route path="/admin/kanban" element={
            <AdminRoute>
              <AppLayout><AdminKanban /></AppLayout>
            </AdminRoute>
          } />

          {/* Regular App Routes - not for system_admin */}
          <Route path="/dashboard" element={
            <ProtectedRoute roles={['super_admin', 'pre_sales_manager', 'pre_sales_executive']}>
              <AppLayout><Dashboard /></AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/kanban" element={
            <ProtectedRoute roles={['super_admin', 'pre_sales_manager', 'pre_sales_executive']}>
              <AppLayout><Kanban /></AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/calendar" element={
            <ProtectedRoute roles={['super_admin', 'pre_sales_manager', 'pre_sales_executive']}>
              <AppLayout><Calendar /></AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/team" element={
            <ProtectedRoute roles={['super_admin', 'pre_sales_manager']}>
              <AppLayout><Team /></AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/executives" element={
            <ProtectedRoute roles={['super_admin', 'pre_sales_manager']}>
              <AppLayout><Executives /></AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/activity" element={
            <ProtectedRoute roles={['super_admin', 'pre_sales_manager', 'pre_sales_executive']}>
              <AppLayout><ActivityLog /></AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/whatsapp" element={
            <ProtectedRoute roles={['super_admin', 'pre_sales_manager']}>
              <AppLayout><WhatsApp /></AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute roles={['system_admin', 'super_admin', 'pre_sales_manager', 'pre_sales_executive']}>
              <AppLayout><Settings /></AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<DefaultRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
