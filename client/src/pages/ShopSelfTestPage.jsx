// Tùng — Sprint 2: preview ba trang qua auth thật, không sửa main/App hay mock dữ liệu.
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/be-vietnam-pro/800.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../styles/theme.scss';
import { AuthProvider } from '../context/AuthContext';
// Tùng — Sprint 2: BRIDGE-02A harness dùng cùng provider navbar như ứng dụng chính.
import { ShopNavigationProvider } from '../context/ShopNavigationContext';
import useAuth from '../hooks/useAuth';
import { ToastProvider } from '../components/Toast/Toast';
import Button from '../components/Button/Button';
import Notice from '../components/Notice/Notice';
import Spinner from '../components/Spinner/Spinner';
import { initTheme } from '../utils/theme';
import AuthPage from './AuthPage';
import ShopRegisterPage from './ShopRegisterPage';
import ShopVerifyPage from './ShopVerifyPage';
import ShopManagementPage from './ShopManagementPage';

const VIEWS = { register: 'Shop Register', verify: 'Shop Verify', manage: 'Shop Management' };
const PATH_VIEWS = { '/shops/register': 'register', '/shops/manage': 'manage', '/admin/shops/verify': 'verify', '/login': 'login' };

export default function ShopSelfTestPage() {
  const { user, isCheckingSession, isAuthenticated, logout } = useAuth();
  const [view, setView] = useState(() => new URLSearchParams(window.location.search).get('view') || 'register');
  const changeView = next => {
    setView(next);
    const url = new URL(window.location.href);
    url.searchParams.set('view', next);
    window.history.replaceState(null, '', url);
  };
  // Chỉ harness ánh xạ link Shop về view; không thay router của ứng dụng.
  const captureLink = event => {
    const anchor = event.target.closest('a');
    if (!anchor || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const url = new URL(anchor.href, window.location.origin);
    const next = PATH_VIEWS[url.pathname.replace(/\/$/, '')];
    if (url.origin === window.location.origin && next) { event.preventDefault(); changeView(next); }
  };
  return <div onClickCapture={captureLink}>
    <div className="container py-3 d-flex flex-wrap gap-2 align-items-center" style={{ position: 'relative', zIndex: 40 }}>
      <b>Tùng · Shop self-test</b>
      {Object.entries(VIEWS).map(([key, label]) => <Button key={key} size="sm" variant={key === view ? 'primary' : 'outline'} onClick={() => changeView(key)}>{label}</Button>)}
      <Button size="sm" variant="subtle" onClick={() => { logout(); changeView('login'); }}>Đổi tài khoản</Button>
      <span className="small">{user ? `${user.fullName || user.email} · ${user.role}` : 'Khách'}</span>
    </div>
    {isCheckingSession ? <div className="container"><Spinner showLabel /></div>
      : !isAuthenticated || view === 'login' ? <AuthPage onAuthenticated={() => changeView('register')} />
        : view === 'verify' ? <ShopVerifyPage /> : view === 'manage' ? <ShopManagementPage />
          : view === 'register' ? <ShopRegisterPage /> : <Notice>Chọn một trang Shop ở thanh tự test.</Notice>}
  </div>;
}

initTheme();
createRoot(document.getElementById('root')).render(
  // Tùng — Sprint 2: giữ auth thật và Shop state chung khi đổi view/tài khoản tự test.
  <StrictMode><ToastProvider><AuthProvider><ShopNavigationProvider><ShopSelfTestPage /></ShopNavigationProvider></AuthProvider></ToastProvider></StrictMode>,
);
