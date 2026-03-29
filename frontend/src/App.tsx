import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGuardedRoute from './components/RoleGuardedRoute';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import DashboardHome from './pages/DashboardHome';
import TasksPage from './pages/TasksPage';
import ReportPage from './pages/ReportPage';
import CreateTaskPage from './pages/CreateTaskPage';
import UserManagementPage from './pages/UserManagementPage';
import AccountPage from './pages/AccountPage';
import ProfilePage from './pages/ProfilePage';
import TaskDetailPage from './pages/TaskDetailPage';
import LandingPage from './pages/LandingPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
      <NotificationProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardPage />}>
              <Route path="/dashboard" element={<DashboardHome />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/tasks/:id" element={<TaskDetailPage />} />
              <Route path="/report" element={<ReportPage />} />
              <Route element={<RoleGuardedRoute allowedRoles={['admin', 'reviewer']} />}>
                <Route path="/create-task" element={<CreateTaskPage />} />
                <Route path="/user-management" element={<UserManagementPage />} />
              </Route>
              <Route path="/account" element={<AccountPage />} />
              <Route path="/profile/:userId" element={<ProfilePage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </NotificationProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
