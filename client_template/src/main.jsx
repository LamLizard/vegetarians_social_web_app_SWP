import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';

// Font tự host (không cần mạng khi chạy) – 1 font duy nhất, tiêu đề chỉ khác độ đậm
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/be-vietnam-pro/800.css';
import '@fontsource/be-vietnam-pro/400-italic.css';
import '@fontsource/be-vietnam-pro/700-italic.css';

import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/theme.scss'; // Bootstrap đã đổi màu theo theme A + C (+ chế độ Đêm)
import { initTheme } from './app/utils/theme';

initTheme(); // gắn data-theme trước khi vẽ → không nháy màu

// `npm run build:kit` → chỉ đóng gói Review Kit; còn lại chạy app đầy đủ.
const Root = import.meta.env.MODE === 'kit'
  ? lazy(() => import('./kit/ReviewKit'))
  : lazy(() => import('./app/App'));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </StrictMode>,
);
