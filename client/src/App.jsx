// Gốc app: chọn màn hình theo trạng thái đăng nhập + vai trò (account.role).
// Chưa có react-router nên điều hướng bằng render theo điều kiện;
// khi nhóm thêm react-router thì thay đúng chỗ này bằng <Routes>.
import { Button, EmptyState, ROLE, Spinner } from './components';
import useAuth from './hooks/useAuth';
import AuthPage from './pages/AuthPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

// Tung's code: Trang duyệt bài viết và xử lý báo cáo, dùng chung phiên đăng nhập Admin.
import AdminModerationPage from './pages/AdminModerationPage';


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

  // Chưa đăng nhập → màn Đăng nhập / Đăng ký
  if (!isAuthenticated) return <AuthPage />;

  // Tung's code: Sau khi khôi phục phiên và kiểm tra đăng nhập, chỉ Admin được mở
  // trang kiểm duyệt tại /admin/moderation (chấp nhận cả dấu / ở cuối URL).
  // Trang mới tự đọc query type=post/report và stale=1 từ các link trên dashboard.
  // Các URL Admin khác tiếp tục đi vào nhánh dashboard hiện có bên dưới.
  if (isAdmin && window.location.pathname.replace(/\/$/, '') === '/admin/moderation') {
    return <AdminModerationPage />;
  }
  // Tung's code: Kết thúc điểm nối trang kiểm duyệt.

  // Quản trị viên → khu quản trị
  if (isAdmin) return <AdminDashboardPage />;

  // TODO: thay bằng trang chủ thành viên (M-01) khi nhóm làm xong
  return (
    <main className="container py-5">
      <EmptyState
        icon="cone-striped"
        title="Khu thành viên chưa làm"
        action={<Button variant="outline" icon="box-arrow-right" onClick={logout}>Đăng xuất</Button>}
      >
        Bạn đang đăng nhập với vai trò <b>{ROLE[user?.role] ?? user?.role}</b>. Trang chủ thành viên sẽ làm ở bước sau.
      </EmptyState>
    </main>
  );
}
