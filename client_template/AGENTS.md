# Hướng dẫn cho trợ lý AI (Claude, Cursor, Copilot, Codex...)

Dự án: app cộng đồng ăn chay (SWP391). React 19 + Vite + Bootstrap 5.3 SCSS + CSS Modules + Bootstrap Icons + motion.

## Giao diện

Trước khi tạo hoặc sửa bất kỳ trang, component hay CSS nào, **đọc `.claude/skills/an-chay-ui/SKILL.md`** và file hướng dẫn của component liên quan trong `.claude/skills/an-chay-ui/components/`.

Tóm tắt luật cứng:
- Dùng component có sẵn trong `src/components` trước khi viết mới.
- Màu chỉ lấy từ token `var(--ac-...)`, không viết mã hex. App có chế độ Đêm.
- Một font duy nhất: Be Vietnam Pro. Một màu chính: rêu `--ac-moss`.
- Icon chỉ dùng Bootstrap Icons. Không cài thêm thư viện UI.
- Bài công thức phải ghi rõ có trứng/sữa hay không (BR-01).

## Lệnh

- `npm run dev`: chạy app. Mở `/kit` để xem toàn bộ component.
- `npm run build`: kiểm tra build trước khi commit.

## Dữ liệu

- Đăng nhập / đăng ký chạy thật qua server (`../server`, Express + Postgres). URL API ở `client/.env` (`VITE_API_URL`).
  - Gọi API: `src/app/services/api.js` (fetch wrapper) → `src/app/services/auth.service.js`.
  - Phiên đăng nhập: `src/app/context/AuthContext.jsx`, dùng qua hook `useAuth()` (`src/app/hooks/useAuth.js`).
  - Trang: `src/app/pages/auth/AuthPage.jsx` (+ `AuthPage.css`).
- Các nghiệp vụ khác chưa có API: dữ liệu mẫu ở `src/app/store/mockData.js`, thao tác ở `src/app/store/AppStore.jsx`, trợ lý AI giả lập ở `src/app/features/assistant/assistantEngine.js`.
