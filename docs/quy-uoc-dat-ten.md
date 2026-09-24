# ✏️ Quy ước đặt tên file — Vegetarian Social

> **Mục đích:** cả nhóm đặt tên giống nhau → tìm file nhanh, import không lỗi, review code đỡ cãi nhau.
> **Doc đi kèm:** `huong-dan-folder.md` (quy định file nào để ĐÂU — còn doc này quy định file TÊN GÌ).
>
> **Quy tắc vàng:** *Tên file = tên thứ quan trọng nhất nó export.* `PostCard.jsx` phải export `PostCard`; `useAuth.js` export `useAuth`.

## 1. Luật chung (áp dụng mọi nơi)

- ✅ Tiếng **Anh**, **không dấu**, **không khoảng trắng**: `post-card`, KHÔNG `thẻ bài viết`, `the bai viet`
- ✅ Không viết tắt mơ hồ: `usrCtrl.js` ❌ → `user.controller.js` ✅ (viết tắt quen thuộc như `auth`, `api`, `db`, `id` thì OK)
- ✅ Hoa/thường phải chuẩn — git phân biệt hoa thường còn Windows thì không → đặt sai là lỗi lạ ngay
- ❌ Không để tên kiểu: `file1.js`, `main2.js`, `abc.js`, `test-xong-roi.js`
- ✅ **Nhất quán cả repo** — phân vân thì nhìn 2 file hàng xóm mà theo, đừng sáng tạo style mới
- ✅ Quy ước áp cho file MỚI; file cũ hơi lệch thì đổi khi rảnh (đừng mass-rename giữa sprint)

## 2. Bốn kiểu chữ hoa/thường — nhớ mặt

| Kiểu | Ví dụ | Dùng cho |
|---|---|---|
| **PascalCase** | `PostCard`, `LoginPage` | Component, Page, Context |
| **camelCase** | `useAuth`, `formatDate` | Hook, util, service, config, hàm/biến |
| **kebab-case** | `default-avatar`, `huong-dan-folder` | Ảnh/asset, file docs |
| **SCREAMING_SNAKE** | `MAX_UPLOAD_MB` | Hằng số |

## 3. Client (React)

| Loại | Quy ước | Ví dụ ✅ | Tránh ❌ |
|---|---|---|---|
| Component | PascalCase, trùng tên component | `PostCard.jsx` | `postCard.jsx`, `post_card.jsx` |
| Page | PascalCase + hậu tố `Page` | `LoginPage.jsx` | `login.jsx`, `loginpage.jsx` |
| Hook | camelCase + prefix `use` | `useAuth.js` | `useauth.js`,`AuthHook.js` |
| Service | camelCase + `.service.js` | `auth.service.js` | `authservice.js`, `AuthService.js` |
| Context | PascalCase + `Context` | `AuthContext.jsx` | `authContext.jsx` |
| Util | camelCase, tên = hàm chính | `formatDate.js` | `format_date.js`, `utils1.js` |
| CSS Module (nếu xài) | PascalCase khớp component | `PostCard.module.css` | `postcard.css` |
| Ảnh/icon | kebab-case, không dấu | `default-avatar.png` | `Default Avatar.png`, `ảnh.jpg` |

*(Kiểu `authService.js` cũng phổ biến, NHƯNG nhóm chốt 1 kiểu là `auth.service.js` cho khỏi lẫn.)*

## 4. Server (Node/Express)

| Loại | Quy ước | Ví dụ ✅ | Tránh ❌ |
|---|---|---|---|
| Route | `<tài-nguyên>.routes.js` | `auth.routes.js`, `post.routes.js` | `authRoute.js`, `routes_auth.js` |
| Controller | `<tài-nguyên>.controller.js` | `auth.controller.js` | `AuthController.js`, `authctrl.js` |
| Model | `<tài-nguyên>.model.js` (số ÍT) | `user.model.js` | `Users.model.js`, `userModel.js` |
| Middleware | tên chức năng ngắn | `auth.js`, `error.js` | `checkTokenFull.js`, `middleware1.js` |
| Config | tên ngắn | `env.js`, `db.js` | `config-final.js`, `env2.js` |
| Entry | cố định | `server.js` | `index-final-v2.js` |

## 5. docs/

| Loại | Quy ước | Ví dụ |
|---|---|---|
| Hướng dẫn nội bộ | kebab-case không dấu | `huong-dan-folder.md`, `quy-uoc-dat-ten.md` |
| Biên bản họp | `meeting-notes/YYYY-MM-DD.md` | `meeting-notes/2026-09-23.md` |
| Tài liệu môn học | giữ tên chuẩn giảng viên quen | `SRS.md` |
| Wireframe / ảnh demo | kebab-case | `wireframes/login-page.png` |

## 6. Từ vựng thống nhất — cả nhóm dùng CHUNG một từ

| Tiếng Việt | Từ dùng trong code | KHÔNG dùng |
|---|---|---|
| người dùng | `user` | `nguoidung`, `account` (lẫn lộn) |
| bài viết | `post` | `article`, `baiViet` |
| bình luận | `comment` | `cmt`, `binhLuan` |
| lượt thích | `like` | `heart`, `tym` |
| theo dõi | `follow` | `subscribe`, `theoDoi` |
| bảng tin | `feed` | `newsfeed`, `timeline` |
| trang cá nhân | `profile` | `page`, `trangCaNhan` |
| ảnh đại diện | `avatar` | `picture`, `hinhDaiDien` |
| công thức (nếu có) | `recipe` | `congThuc`, `food` |
| thông báo | `notification` | `noti`, `thongBao` |

## 7. Tự kiểm 30 giây trước khi commit file mới

1. Tên có khoảng trắng / dấu tiếng Việt / ký tự lạ không? → sửa ngay
2. Hoa/thường đúng bảng chưa? (Component = Pascal, còn lại camel/kebab)
3. Tên file có **trùng tên export** không? (`PostCard.jsx` export `PostCard`)
4. File này đặt đúng folder chưa? → tra `huong-dan-folder.md`
5. So 2 file hàng xóm — style giống chưa?

## 8. (Bonus) Nhánh git & commit

- Nhánh: `feat/them-trang-profile`, `fix/loi-dang-nhap` — kebab-case, không dấu, mô tả ngắn
- Commit theo conventional: `feat: thêm nút like`, `fix: sửa validate form login`