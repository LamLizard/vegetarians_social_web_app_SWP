# Server – API đăng nhập (Express + PostgreSQL/Neon)

## Chạy lần đầu
```bash
cd server
npm install
npm run db:init   # tạo bảng account + auth_session (nếu chưa có) + 2 tài khoản demo
npm run dev       # API ở http://localhost:5000
```
Rồi ở thư mục `client`: `npm install` → `npm run dev` → mở http://localhost:5173

## API (`/api/auth`)
| Method | Đường dẫn | Cần token | Body | Trả về |
|---|---|---|---|---|
| POST | `/register` | – | `{ fullName, email, password }` | 201 `{ token, user }` · 400/409 `{ field, message }` |
| POST | `/login` | – | `{ email, password, remember }` | 200 `{ token, user }` · 401 sai thông tin · 403 `{ locked }` |
| GET | `/me` | ✓ | – | `{ user }` |
| PATCH | `/password` | ✓ | `{ currentPassword, newPassword }` | `{ message }` (đăng xuất các thiết bị khác) |
| POST | `/logout` | ✓ | – | `{ message }` (thu hồi phiên hiện tại) |

Token gửi qua header `Authorization: Bearer <token>`. Mỗi lần đăng nhập tạo 1 dòng `auth_session`
(chỉ lưu hash của token), nên đăng xuất / đổi mật khẩu / bị khoá là token cũ hết dùng được ngay.

## Cấu trúc
```
src/
  server.js                      khởi động Express, gắn /api/auth
  config/db.js                   Pool kết nối Postgres (DATABASE_URL)
  routes/auth.routes.js          POST /register, POST /login, GET /me, PATCH /password, POST /logout
  controllers/auth.controller.js register, login, me, logout, changePassword
  middlewares/auth.js            requireAuth (verify JWT + phiên), requireRole('admin')
  models/user.model.js           SQL bảng account: findByEmail, findById, create, updatePassword
  models/session.model.js        SQL bảng auth_session: create, findActive, revoke, revokeOthers
  utils/jwt.js                   signToken / verifyToken / hashToken
db/schema.sql, db/init.js        tạo bảng + tài khoản demo
```
`.env` chứa mật khẩu DB và JWT_SECRET → đã có trong `.gitignore`, đừng commit.
