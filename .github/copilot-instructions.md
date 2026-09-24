# Quy tắc gen code — Vegetarian Social (React Vite + Express + Postgres)

Khi được yêu cầu viết code cho repo này, BẮT BUỘC tuân thủ:

## 1. Tên file — in đường dẫn đầy đủ TRƯỚC khi viết code
- Component/Page/Context: PascalCase → `PostCard.jsx`, `LoginPage.jsx`, `AuthContext.jsx`
- Hook: `useXxx.js` → `useAuth.js`
- Service: `x.service.js` → `auth.service.js`
- Util: camelCase → `formatDate.js`
- Ảnh/icon: kebab-case → `default-avatar.png`
- BE: `x.routes.js`, `x.controller.js`, `x.model.js`; middleware/config tên ngắn (`auth.js`, `db.js`)
- Tên file = tên export chính. KHÔNG dấu tiếng Việt, KHÔNG khoảng trắng, KHÔNG `file1.js` / `temp.js` / `NewFile2.jsx`

## 2. Vị trí file — nói rõ folder + lý do, KHÔNG tự tạo folder mới
- FE: màn hình → `client/src/pages/` • UI dùng ≥2 nơi → `client/src/components/` • gọi API → `client/src/services/` • state chung → `context/` • hàm phụ → `utils/`
- BE: route → `server/src/routes/` • logic → `controllers/` • query DB → `models/` • middleware → `middlewares/` • config → `config/`

## 3. UI phải tách component — vẽ cây trước khi code
- Mỗi màn hình chia thành cây component: `LoginPage → (Logo, Input ×2, Button)`
- 1 component = 1 việc, 1 file riêng, export trùng tên file
- Component CHỈ nhận props — KHÔNG gọi API trong component (dữ liệu đi qua pages/ + services/)
- Dùng ≥2 nơi → tách ra `components/`; chỉ 1 nơi dùng → để trong page

## 4. Format trả lời bắt buộc (thiếu mục = chưa đạt)
📁 Vị trí file → 🧩 Cây component → 💻 Code → ✅ Checklist (tên file đúng? folder đúng? component tách? props rõ? không API call trong component?)

## 5. CẤM
- Nhồi mọi thứ vào `App.jsx` • đặt sai folder • tên tự chế (`abc.js`,`NewFile2.jsx`) • component tự gọi fetch/axios • tạo folder mới không hỏi
- Thiếu thông tin (props gì, dữ liệu từ đâu, style nào) → hỏi lại tối đa 2 câu NGẮN trước khi code

> Chi tiết đầy đủ + ví dụ: `docs/skill-ai-gen-code.md`, `docs/quy-uoc-dat-ten.md`, `docs/huong-dan-folder.md`