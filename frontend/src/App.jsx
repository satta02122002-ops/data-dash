import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import useThemeStore from './store/themeStore';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardsPage from './pages/DashboardsPage';
import DatasetsPage from './pages/DatasetsPage';
import DashboardEditorPage from './pages/DashboardEditorPage';
import DatasetUploadPage from './pages/DatasetUploadPage';
import PublicDashboardPage from './pages/PublicDashboardPage';
import SettingsPage from './pages/SettingsPage';

// Layout
import AppLayout from './components/ui/AppLayout';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const GuestRoute = ({ children }) => {
  const { user } = useAuthStore();
  if (user) return <Navigate to="/dashboards" replace />;
  return children;
};

export default function App() {
  const { theme } = useThemeStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <Routes>
      {/* Guest routes */}
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

      {/* Public dashboard view */}
      <Route path="/share/:shareToken" element={<PublicDashboardPage />} />

      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboards" replace />} />
        <Route path="dashboards" element={<DashboardsPage />} />
        <Route path="dashboards/:id/edit" element={<DashboardEditorPage />} />
        <Route path="datasets" element={<DatasetsPage />} />
        <Route path="datasets/upload" element={<DatasetUploadPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
