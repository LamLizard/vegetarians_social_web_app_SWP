import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

/**
 * Chặn trang cần đăng nhập.
 * @param {'admin'} role  (tuỳ chọn) yêu cầu vai trò – thành viên thường vào /admin sẽ bị đưa về bảng tin
 */
export default function RequireAuth({ role, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  // Đang hỏi server phiên cũ còn sống không (chỉ khi chưa có user lưu sẵn) → chờ, chưa vội đá ra /login
  if (!ready && !user) return null;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}
