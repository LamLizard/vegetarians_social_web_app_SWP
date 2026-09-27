import { useEffect, useState } from 'react';
import AdminMemberManagementPage from './pages/AdminMemberManagementPage';
import LoginPage from './pages/LoginPage';
import UserProfilePage from './pages/UserProfilePage';
import { logout } from './services/auth.service';

function getSavedUser() {
  try {
    return sessionStorage.getItem('accessToken')
      ? JSON.parse(sessionStorage.getItem('currentUser') || 'null')
      : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState(getSavedUser);
  const [page, setPage] = useState('profile');

  useEffect(() => {
    const handleExpiredSession = () => {
      sessionStorage.removeItem('currentUser');
      setUser(null);
    };
    window.addEventListener('auth:expired', handleExpiredSession);
    return () => window.removeEventListener('auth:expired', handleExpiredSession);
  }, []);

  const handleLogin = (currentUser) => {
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    setUser(currentUser);
    setPage(currentUser.role === 'admin' ? 'members' : 'profile');
  };

  const handleLogout = () => {
    logout();
    sessionStorage.removeItem('currentUser');
    setUser(null);
  };

  if (!user) return <LoginPage onLoggedIn={handleLogin} />;

  return (
    <div className="bg-body-tertiary min-vh-100">
      <header className="bg-body border-bottom">
        <div className="container py-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <strong>Vegetarian Social</strong>
          <nav className="d-flex align-items-center gap-2" aria-label="Điều hướng chính">
            <button type="button" className={`btn btn-sm ${page === 'profile' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setPage('profile')}>
              Hồ sơ
            </button>
            {user.role === 'admin' && (
              <button type="button" className={`btn btn-sm ${page === 'members' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setPage('members')}>
                Thành viên
              </button>
            )}
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleLogout}>
              Đăng xuất
            </button>
          </nav>
        </div>
      </header>
      <main>
        {page === 'members' && user.role === 'admin'
          ? <AdminMemberManagementPage />
          : <UserProfilePage />}
      </main>
    </div>
  );
}
