// Gốc app: chọn màn hình theo trạng thái đăng nhập + vai trò (account.role).
// Chưa có react-router nên điều hướng bằng render theo điều kiện;
// khi nhóm thêm react-router thì thay đúng chỗ này bằng <Routes>.
import { Spinner } from './components';
import useAuth from './hooks/useAuth';
import AuthPage from './pages/AuthPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminMemberManagementPage from './pages/AdminMemberManagementPage';

// Tung's code: Trang duyệt bài viết và xử lý báo cáo, dùng chung phiên đăng nhập Admin.
import AdminModerationPage from './pages/AdminModerationPage';

// Khoi's code: Trang Bảng tin (ID01) — trang chủ của khách và thành viên.
import PostFeedPage from './pages/PostFeedPage';


export default function App() {
  const { user, isAuthenticated, isCheckingSession, logout } = useAuth();

  // 'admin' là key trong ROLE (constants/domain.js) — DB: role 2 = admin
  const isAdmin = user?.role === 'admin';

  // Đang gọi /auth/me để khôi phục phiên từ token trong localStorage
  if (isCheckingSession) {
    return (
      <main className="d-flex justify-content-center align-items-center min-vh-100">
        <Spinner label="Đang kiểm tra phiên đăng nhập..." showLabel />
      </main>
    );
  }

  // Khoi's code: điều hướng tạm bằng URL (chưa có react-router)
  //   /  hoặc /feed          → Bảng tin (khách: 3 bài cố định · thành viên: lướt vô hạn)
  //   /login · /register     → trang Đăng nhập / Đăng ký
  //   URL khác khi chưa đăng nhập (vd /admin/...) → trang Đăng nhập như cũ
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const isFeedPath = path === '/' || path === '/feed';
  const goTo = (url) => window.location.assign(url);

  if (!isAuthenticated) {
    if (isFeedPath) return <PostFeedPage user={null} onLogin={() => goTo('/login')} onRegister={() => goTo('/register')} />;
    const isAuthPath = path === '/login' || path === '/register';
    return (
      <AuthPage
        initialMode={path === '/register' ? 'register' : 'login'}
        // Đăng nhập xong ở /login → đổi URL về trang chủ (không tải lại trang)
        onAuthenticated={() => { if (isAuthPath) window.history.replaceState(null, '', '/'); }}
      />
    );
  }

  const feed = (
    <PostFeedPage
      user={user}
      accountMenu={[{ icon: 'box-arrow-right', label: 'Đăng xuất', tone: 'alert', onClick: logout }]}
    />
  );
  // Khoi's code: Admin vẫn vào dashboard như cũ; muốn xem Bảng tin thì mở /feed
  if (isAdmin && path === '/feed') return feed;
  // Khoi's code: Kết thúc điểm nối điều hướng.

  // Tung's code: Sau khi khôi phục phiên và kiểm tra đăng nhập, chỉ Admin được mở
  // trang kiểm duyệt tại /admin/moderation (chấp nhận cả dấu / ở cuối URL).
  // Trang mới tự đọc query type=post/report và stale=1 từ các link trên dashboard.
  // Các URL Admin khác tiếp tục đi vào nhánh dashboard hiện có bên dưới.
  if (isAdmin && window.location.pathname.replace(/\/$/, '') === '/admin/moderation') {
    return <AdminModerationPage />;
  }
  if (isAdmin && path === '/admin/accounts') {
    return <AdminMemberManagementPage />;
  }
  // Tung's code: Kết thúc điểm nối trang kiểm duyệt.

  // Quản trị viên → khu quản trị
  if (isAdmin) return <AdminDashboardPage />;

  // Khoi's code: Thành viên → Bảng tin (thay cho "Khu thành viên chưa làm")
  return feed;
}
