import { lazy, Suspense, useEffect } from 'react';
import {
  BrowserRouter, Route, Routes, useLocation,
} from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { ToastProvider } from '../components';
import { AuthProvider } from './context/AuthContext';
import { AppStoreProvider } from './store/AppStore';
import RequireAuth from './routes/RequireAuth';
import AppShell from './layouts/AppShell';
import AdminLayout from './layouts/AdminLayout';
import AuthPage from './pages/auth/AuthPage';
import FeedPage from './pages/feed/FeedPage';
import ProfilePage from './pages/profile/ProfilePage';
import MamPage from './pages/assistant/MamPage';
import DiscoverPage from './pages/discover/DiscoverPage';
import SavedPage from './pages/SavedPage';
import ComingSoonPage from './pages/ComingSoonPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminHomePage from './pages/admin/AdminHomePage';
import VerificationPage from './pages/admin/VerificationPage';
import MembersPage from './pages/admin/MembersPage';
import './app.css';

// Review Kit chỉ tải khi mở /kit
const ReviewKit = lazy(() => import('../kit/ReviewKit'));

// Chuyển trang → cuộn về đầu (trừ khi link trỏ tới #bài-viết)
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

/*
  Sơ đồ trang
  ─────────────────────────────────────────────────────────────
  /login, /register            ID02  Đăng nhập · Đăng ký
  /                            ID01  Bảng tin (trang chính sau đăng nhập)
  /profile/:userId             ID03  Trang cá nhân "Hộ chiếu chay"
  /discover                          Khám phá: "Hôm nay nấu gì?" (quẹt thẻ)
  /assistant                         Trợ lý Mầm (chatbot AI)
  /saved                             Bài đã lưu
  /admin                       ID04  Trang chủ quản trị
  /admin/verification          ID05  Duyệt bài viết & xác minh quán
  /admin/members               ID06  Quản lý thành viên
  /kit                               Review Kit – xem component
  Phím tắt: Ctrl/⌘ + K mở bảng lệnh ở mọi trang của thành viên.
*/
export default function App() {
  return (
    // AuthProvider bọc ngoài cùng: AppStore cần biết ai đang đăng nhập
    <AuthProvider>
      <AppStoreProvider>
        {/* reducedMotion="user": tự tắt hiệu ứng nếu người dùng bật "giảm chuyển động" */}
        <MotionConfig reducedMotion="user">
          <ToastProvider>
            <BrowserRouter>
              <ScrollToTop />
              <Routes>
                <Route path="/login" element={<AuthPage mode="login" />} />
                <Route path="/register" element={<AuthPage mode="register" />} />

                <Route element={<RequireAuth><AppShell /></RequireAuth>}>
                  <Route index element={<FeedPage />} />
                  <Route path="profile/:userId" element={<ProfilePage />} />
                  <Route path="discover" element={<DiscoverPage />} />
                  <Route path="assistant" element={<MamPage />} />
                  <Route path="saved" element={<SavedPage />} />
                  <Route path="explore/:section" element={<ComingSoonPage />} />
                </Route>

                <Route path="/admin" element={<RequireAuth role="admin"><AdminLayout /></RequireAuth>}>
                  <Route index element={<AdminHomePage />} />
                  <Route path="verification" element={<VerificationPage />} />
                  <Route path="members" element={<MembersPage />} />
                </Route>

                <Route path="/kit" element={<Suspense fallback={null}><ReviewKit /></Suspense>} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </MotionConfig>
      </AppStoreProvider>
    </AuthProvider>
  );
}
