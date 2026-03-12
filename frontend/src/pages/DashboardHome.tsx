import { useAuth } from '../context/AuthContext';
import AdminDashboardHome from './AdminDashboardHome';
import ReviewerDashboardHome from './ReviewerDashboardHome';
import UserDashboardHome from './UserDashboardHome';

function DashboardHome() {
  const { user } = useAuth();

  if (user?.role === 'admin') return <AdminDashboardHome />;
  if (user?.role === 'reviewer') return <ReviewerDashboardHome />;
  return <UserDashboardHome />;
}

export default DashboardHome;
