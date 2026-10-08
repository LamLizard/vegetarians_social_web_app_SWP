# Quy ước phát triển chung — Vegetarian Social

Áp dụng cho code mới và phần code được giao chỉnh sửa trong ứng dụng chính. Đây là nguồn chung về naming, vị trí file và trách nhiệm từng tầng.

## 1. Phạm vi và nguồn tra cứu

- Ứng dụng chính: React/Vite ở `client/`, Express ở `server/`, dữ liệu PostgreSQL.
- `client_template/` và `server_template/` là nguồn tham khảo; kiểm tra mã đang chạy trước khi chọn file sửa.
- File này là nguồn chung về naming, vị trí file và trách nhiệm từng tầng. Chọn component theo [UI Kit](skill-ui-kit.md); chữ ký hàm/props tra trong source tương ứng.

## 2. Đặt tên

Tên file tiếng Anh, không dấu/khoảng trắng, rõ chức năng; tránh tên tạm như `file1.js`, `NewFile2.jsx`. Export chính của component, hook và util dùng cùng tên với file; file service/model có thể xuất nhiều hàm liên quan.

| Loại | Quy ước | Ví dụ |
|---|---|---|
| Component / page / context | PascalCase; page có hậu tố Page, context có hậu tố Context | `PostCard.jsx`, `AuthPage.jsx`, `AuthContext.jsx` |
| Hook | camelCase, bắt đầu bằng use | `useAuth.js` |
| Service | camelCase + .service.js | `auth.service.js` |
| Util / middleware / config | camelCase, tên ngắn và rõ chức năng | `formatDate.js`, `auth.js`, `db.js` |
| Backend route / controller / model | tên tài nguyên + hậu tố; model dùng số ít | `post.routes.js`, `post.controller.js`, `account.model.js` |
| CSS của component | Khớp tên component; CSS Module thêm .module.css | `PostCard.css`, `PostCard.module.css` |
| Asset / tài liệu hướng dẫn | kebab-case; tài liệu môn học giữ tên đã thống nhất | `default-avatar.png`, `development-guide.md` |
| Hằng số | SCREAMING_SNAKE_CASE | `MAX_UPLOAD_MB` |
| Nhánh / commit | Nhánh theo mẫu nhóm thống nhất; commit mô tả hành động | `feat/them-trang-profile`, `fix: sửa validate form login` |

Giữ chính xác hoa/thường của tên file và import. Theo convention ở các file cùng loại; việc tinh gọn tài liệu không yêu cầu đổi tên hàng loạt code cũ.

## 3. Chọn vị trí file

Ưu tiên thư mục có sẵn. Logic chỉ phục vụ một màn hình đặt gần màn hình đó; khi có nhiều nơi dùng mới đưa thành phần dùng chung vào vị trí thích hợp. Thêm thư mục ứng dụng mới cần thống nhất với nhóm.

| Vị trí | Trách nhiệm |
|---|---|
| `client/src/pages/` | Lắp ghép màn hình, quản lý luồng dữ liệu và gọi service |
| `client/src/components/` | UI tái sử dụng; dữ liệu nghiệp vụ nhận qua props |
| `client/src/services/` | Gọi API; cấu hình/request chung đi qua wrapper đang có |
| `client/src/context/` | State và provider dùng chung |
| `client/src/hooks/` | Custom hook dùng lại logic |
| `client/src/utils/` | Hàm tiện ích; giữ nhóm hàm thuần tách khỏi UI/API |
| `client/src/assets/` / `client/public/` | Asset import / file được phục vụ trực tiếp qua URL |
| `server/src/routes/` | Khai báo endpoint và middleware, nối tới controller |
| `server/src/controllers/` | Nhận request, điều phối nghiệp vụ và trả response |
| `server/src/models/` | Truy cập database, query và thao tác dữ liệu |
| `server/src/middlewares/` | Xác thực, phân quyền và xử lý request dùng chung |
| `server/src/config/` / `server/src/utils/` | Cấu hình / hàm tiện ích backend |
| `docs/` | Hướng dẫn, đặc tả và tài liệu chung |
| `database-seed/` | SQL và hướng dẫn thực thi đi kèm |

Theo entry và cấu trúc hiện có khi khởi động ứng dụng: [client main](../client/src/main.jsx), [server entry](../server/server.js). Không suy ra vị trí entry từ template.

## 4. Frontend và UI

- Mỗi component có trách nhiệm rõ; chia màn hình thành các phần phù hợp, không dồn toàn bộ ứng dụng vào `App.jsx`.
- Page lấy dữ liệu qua service và truyền props/callback xuống component. UI dùng chung không tự gọi API hoặc truy cập trực tiếp store nghiệp vụ; state UI cục bộ vẫn thuộc component.
- Component được tái sử dụng ở ít nhất hai nơi đặt trong thư viện chung. Thành phần chỉ dùng một màn hình ưu tiên đặt gần page.
- Props/callback đặt theo ý nghĩa, như `post`, `onLike`; không đặt `data1`, `handleXyz`.
- Tái sử dụng UI Kit theo [quy tắc và catalog](skill-ui-kit.md), không dựng lại component đã có.

## 5. Backend và dữ liệu

- Luồng chính: route → middleware/controller → model → database. Route không chứa nghiệp vụ; controller không viết query SQL trực tiếp.
- Giữ contract API và thuật ngữ tại ranh giới đang dùng. Domain account giữ tên `account`; payload UI có trường `user` thì giữ đúng contract, không đổi tên chỉ để đồng nhất từ.
- Trong auth hiện tại, [middleware](../server/src/middlewares/auth.js) gán `req.account`; kiểm tra actor/quyền tại server, không chỉ ẩn nút trên UI.
- Đối chiếu source và schema thực tế trước khi dùng tên bảng, cột, trạng thái. Catalog UI không xác lập enum hoặc chính sách nghiệp vụ.
- Tiếp tục dùng `post`, `comment`, `like`, `follow`, `feed`, `profile`, `avatar`, `recipe`, `notification` cho các khái niệm tương ứng; tránh tên đồng nghĩa hoặc viết tắt mơ hồ.
- Cấu hình bí mật nằm ngoài Git; chia sẻ cấu hình mẫu bằng `.env.example`. Theo cơ chế upload hiện có; database lưu URL thay vì đưa ảnh người dùng vào source.

## 6. Checklist review

- [ ] Tên file/import đúng convention; file nằm trong đúng tầng và phạm vi sử dụng.
- [ ] Page/service và route/controller/model có trách nhiệm tách rõ.
- [ ] Component dùng chung được tái sử dụng; props/callback khớp source.
- [ ] Thay đổi thư viện dùng chung hoặc cấu trúc ứng dụng đã được nhóm thống nhất.
- [ ] Contract, quyền truy cập và trạng thái được đối chiếu với nguồn thực tế.
- [ ] Các kiểm tra phù hợp với thay đổi đã thực hiện; thông tin cấu hình bí mật không nằm trong commit.
