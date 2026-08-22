import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { EditorPage } from './pages/EditorPage';
import { ProjectPage } from './pages/ProjectPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/admin/AdminPage';
import { SharePage } from './pages/SharePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { useAuth } from './hooks/useAuth';
import { HelmetProvider } from 'react-helmet-async';

// SSR/CSR 双模式支持
const ENABLE_SSR = import.meta.env.VITE_ENABLE_SSR === 'true';
const Router = ENABLE_SSR ? (await import('react-router-dom/server')).StaticRouter : (await import('react-router-dom')).BrowserRouter;
const routerProps = ENABLE_SSR ? { location: window.location.pathname } : {};

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

export function App() {
  return (
    <HelmetProvider>
      <Router {...routerProps}>
        <Routes>
          {/* 公开页面 - 支持 SSR */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          
          {/* 分享页面 - 支持 SSR (SEO 关键) */}
          <Route path="/share/:token" element={<SharePage />} />
          <Route path="/s/:token" element={<SharePage />} />
          
          {/* 受保护页面 - 仅 CSR (需认证) */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<EditorPage />} />
            <Route path="/projects/:projectId" element={<ProjectPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          
          {/* 管理后台 - 可配置 SSR/CSR */}
          <Route element={<AdminRoute><Layout /></AdminRoute>}>
            <Route path="/admin/*" element={<AdminPage />} />
          </Route>
          
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </HelmetProvider>
  );
}