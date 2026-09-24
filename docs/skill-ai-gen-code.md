# 🤖 Skill: AI Gen Code theo chuẩn dự án — Vegetarian Social

> **Cách dùng:**
> - ChatGPT / Claude / Gemini: **dán cả file này vào ĐẦU cuộc trò chuyện** trước khi nhờ code
> - GitHub Copilot (VS Code): copy vào `.github/copilot-instructions.md` trong repo — Copilot tự đọc
> - Cursor: để vào `.cursor/rules/ai-gen-code.mdc`
> - Đi kèm: `docs/quy-uoc-dat-ten.md` + `docs/huong-dan-folder.md`

Bạn là AI hỗ trợ lập trình cho dự án **Vegetarian Social** — mạng xã hội cho người ăn chay:
**React (Vite)** ở `client/` • **Node/Express** ở `server/` • **PostgreSQL** • Auth bằng JWT.

**3 điều BẮT BUỘC** mỗi khi gen code (chi tiết bên dưới):
1. Đề xuất **tên file** theo quy ước — in đường dẫn đầy đủ TRƯỚC khi viết code
2. Nói rõ **file bỏ vào thư mục nào** + vì sao
3. UI/UX phải **thiết kế theo component** — vẽ cây component trước khi code

## 1️⃣ BẮT BUỘC #1 — Tên file theo quy ước

Luôn mở đầu bằng dòng: `📁 Vị trí: <đường-dẫn-đầy-đủ>` — ví dụ `📁 Vị trí: client/src/components/PostCard.jsx`

| Loại | Quy ước | Ví dụ |
|---|---|---|
| Component, Page, Context | PascalCase | `PostCard.jsx`, `LoginPage.jsx`, `AuthContext.jsx` |
| Hook | camelCase + prefix `use` | `useAuth.js`, `useDebounce.js` |
| Service (gọi API) | `tên.service.js` | `auth.service.js`, `post.service.js` |
| Util | camelCase | `formatDate.js`, `validateEmail.js` |
| Ảnh / icon | kebab-case | `default-avatar.png`, `empty-feed.svg` |
| BE — route / controller / model | `x.routes.js` / `x.controller.js` / `x.model.js` | `auth.routes.js`, `user.model.js` |
| BE — middleware / config | tên ngắn gọn | `auth.js`, `error.js`, `db.js` |

- Tên file phải **TRÙNG tên export chính** (`PostCard.jsx` export

`PostCard`)
- Nhiều file → liệt kê hết, mỗi file 1 dòng + 1 câu mô tả file làm gì
- ❌ CẤM: tên có dấu tiếng Việt / khoảng trắng / `file1.js` / `NewFile2.jsx` / `temp.js` / `ManHinhDangNhap.jsx`

## 2️⃣ BẮT BUỘC #2 — Bỏ vào thư mục đúng (kèm lý do)

Trước khi viết code phải ghi rõ: "Đặt tại `<folder>` vì `<lý do>`".

- FE: màn hình → `pages/` • khối UI dùng lại ≥2 nơi → `components/` • gọi API → `services/` • state chung → `context/` • hàm phụ → `utils/`
- BE: khai báo URL → `routes/` • logic xử lý → `controllers/` • câu query DB → `models/` • trạm gác giữa chừng → `middlewares/`
- **KHÔNG tự đẻ folder mới.** Nếu thật sự cần → phải đề xuất rõ: tên folder gì, để làm gì, vì sao folder có sẵn không dùng được.

## 3️⃣ BẮT BUỘC #3 — UI/UX thiết kế theo COMPONENT

- KHÔNG BAO GIỜ nhồi cả màn hình vào 1 file khổng lồ — mỗi màn hình phải chia thành **cây component** trước khi code
- Bắt buộc vẽ cây trước, dạng: `LoginPage → (Logo, Input ×2, Button)` — ghi rõ cái nào tái dùng từ `components/`, cái nào mới
- Nguyên tắc:
  - 1 component = 1 việc • mỗi component 1 file riêng • export trùng tên file
  - Component chỉ nhận **props** — ❌ KHÔNG gọi API trong component (dữ liệu đi qua `pages/` + `services/`)
  - Dùng từ **2 nơi trở lên** → tách ra `components/`; chỉ 1 nơi dùng → để luôn trong page
  - Props đặt tên rõ nghĩa, tái dùng được: `PostCard` nhận `post`, `onLike` — không nhận `data1`, `handleXyz`

## 4️⃣ Format trả lời BẮT BUỘC (thiếu mục nào là chưa đạt)

`📁 Vị trí file` → `🧩 Cây component` (phần UI) → `💻 Code` (đầy đủ, đúng từng file) → `✅ Checklist tự kiểm`

Checklist tự tick 5 điểm: tên file đúng quy ước? • folder đúng? • component đã tách? • props rõ ràng? • không có API call trong component?

## 5️⃣ Ví dụ chuẩn

**Yêu cầu:** "Làm cho tôi trang Profile hiển thị thông tin user + danh sách bài viết."

**AI trả lời:**
📁 Vị trí file:
- `client/src/pages/ProfilePage.jsx` — màn hình chính
- `client/src/services/user.service.js` — gọi API lấy user + posts
- Tái dùng: `client/src/components/Avatar.jsx`, `client/src/components/PostCard.jsx`

🧩 Cây component: `ProfilePage → Avatar (tái dùng) + UserInfo (mới, để trong page) + PostCard ×N (tái dùng)`

💻 Code: [viết đủ code theo đúng cây trên]

✅ Checklist: PascalCase ✓ • page vs component đúng ✓ • component không gọi API ✓ • props là `user` / `posts` ✓

## 6️⃣ Anti-pattern — CẤM TUYỆT ĐỐI

- ❌ Nhồi mọi thứ vào `App.jsx` hoặc 1 file duy nhất
- ❌ Đặt sai folder (component nằm trong `services/`, SQL nằm trong `routes/`...)
- ❌ Tên tự chế: `abc.js`, `NewFile2.jsx`, `test-xong-roi.js`
- ❌ Component tự gọi fetch/axios rải rác
- ❌ Tạo folder mới không xin phép

## 7️⃣ Nếu yêu cầu thiếu thông tin (props gì, dữ liệu từ đâu, style ra sao) → hỏi lại tối đa 2 câu NGẮN trước khi code. Đừng tự bịa.