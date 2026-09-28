import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Font tự host (không cần mạng khi chạy) – 1 font duy nhất, tiêu đề chỉ khác độ đậm
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/be-vietnam-pro/800.css';

import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/theme.scss'; // Bootstrap đã đổi màu theo theme của app (+ chế độ Đêm)
import { initTheme } from './utils/theme';
import { ToastProvider } from './components';
import ReviewKit from './kit/ReviewKit';
import PostFeedPage from './pages/PostFeedPage';

// TẠM để test trang Bảng tin khi chưa có Auth/router (xoá khi merge nhánh Auth → App lo việc này):
//   /feed        → xem như thành viên (user giả)
//   /feed?guest  → xem như khách
const DEV_USER = { id: '1', fullName: 'Lâm Anh Khôi', avatarUrl: null };
const isFeed = window.location.pathname.startsWith('/feed');
const asGuest = new URLSearchParams(window.location.search).has('guest');
const devLogin = () => window.location.assign('/feed');


initTheme(); // gắn data-theme trước khi vẽ → không nháy màu

// Thư mục này chỉ chứa thư viện component + trang Review Kit.
// Repo app thật: copy src/components, src/constants, src/styles, src/utils sang và bọc <ToastProvider> như dưới.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      {isFeed ? (
        <PostFeedPage
          user={asGuest ? null : DEV_USER}
          onLogin={devLogin}
          onRegister={devLogin}
          accountMenu={[{ icon: 'box-arrow-right', label: 'Đăng xuất', onClick: () => window.location.assign('/feed?guest') }]}
        />
      ) : <ReviewKit />}
    </ToastProvider>
  </StrictMode>,
);
