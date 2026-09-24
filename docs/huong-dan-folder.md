Hướng dẫn cấu trúc thư mục — Vegetarian Social
File này để làm gì? Để mọi thành viên biết file mình cần viết nằm ở đâu — hết cảnh hỏi nhau "folder này sinh ra để làm gì thế" 

Nguyên tắc vàng: trước khi tạo file mới, tự hỏi "File này LÀ GÌ / ĐỂ LÀM GÌ?" rồi tra 2 bảng dưới. Phân vân giữa 2 chỗ → để chỗ hẹp hơn (phục vụ 1 trang) trước; khi có người thứ 2 xài thì mới "thăng cấp" lên shared.

🗺️ Bức tranh tổng
client/ — Giao diện React (chạy trong browser). Người dùng nhìn thấy gì → ở đây.
server/ — Máy chủ Express (chạy trên Render). Xử lý dữ liệu, nói chuyện với DB → ở đây.
docs/ — Tài liệu dự án (không ảnh hưởng chạy code).
Root: README.md (hướng dẫn chạy), .gitignore, các file .env.example.

🎨 client/src — FE để đâu
pages/
• Để làm gì: Mỗi MÀN HÌNH 1 file — lắp ghép components + gọi services
• Ví dụ: HomePage.jsx, LoginPage.jsx, ProfilePage.jsx

components/
• Để làm gì: Khối UI tái dùng ở ≥2 trang, KHÔNG gọi API (nhận dữ liệu qua props)
• Ví dụ: PostCard.jsx, Avatar.jsx, Navbar.jsx, Button.jsx

services/
• Để làm gì: NƠI DUY NHẤT gọi API (axios/fetch) — đổi URL server chỉ sửa đúng 1 file
• Ví dụ: api.js (axios + gắn Bearer token), auth.service.js, post.service.js

context/
• Để làm gì: State dùng chung toàn app
• Ví dụ: AuthContext.jsx — giữ user + token sau khi login

hooks/
• Để làm gì: Custom hook tái dùng logic
• Ví dụ: useAuth.js, useDebounce.js

utils/ (2/4)
• Để làm gì: Hàm thuần (không UI, không API)
• Ví dụ: formatDate.js, validateEmail.js

assets/
• Để làm gì: Ảnh/icon được import trong code
• Ví dụ: logo.svg, default-avatar.png

client/public/ (nằm ngoài src/) — file phục vụ nguyên trạng qua URL, KHÔNG import: favicon.ico, robots.txt.

⚙️ server/src — BE để đâu
routes/
• Để làm gì: "Bảng chỉ đường": URL nào → hàm nào. KHÔNG viết logic ở đây
• Ví dụ: auth.routes.js: POST /login → authController.login

controllers/
• Để làm gì: Logic xử lý request: đọc req → gọi model → trả res
• Ví dụ: auth.controller.js — login(): tìm user → so password → ký JWT → res

models/
• Để làm gì: NƠI DUY NHẤT nói chuyện với DB — mọi câu query nằm đây
• Ví dụ: user.model.js (findByEmail, create), post.model.js

middlewares/
• Để làm gì: "Trạm gác" chạy TRƯỚC controller
• Ví dụ: auth.js (verify token → gắn req.user), error.js (bắt lỗi chung)

utils/
• Để làm gì: Hàm dùng chung
• Ví dụ: jwt.js (sign/verify), password.js (hash/compare bằng bcrypt)

config/
• Để làm gì: Cấu hình đọc 1 lần lúc khởi động
• Ví dụ: env.js (gom process.env), db.js (pool kết nối Postgres)

📚 docs — để gì ở đây
SRS.md — đặc tả yêu cầu (môn học thường bắt buộc có)
wireframes/ — ảnh phác thảo màn hình
meeting-notes/ — biên bản họp nhóm (2026-09-23.md, 2026-09-30.md, ...)
hinh-demo/ — ảnh chụp màn hình để làm báo cáo/slide



🧭 VÍ DỤ
1) Thêm tính năng LIKE bài viết:
BE: routes/post.routes.js thêm route → controllers/post.controller.js viết hàm likePost() → models/post.model.js viết câu query cập nhật like
FE: services/post.service.js thêm hàm likePost() → nút Like: nếu nhiều trang xài chung thì để components/PostCard.jsx, chỉ 1 trang xài thì để luôn trong page đó
❌ Đừng: viết câu SQL thẳng trong controller, hay gọi axios rải rác trong component(3/4)
2) Sửa trang Login (đổi chữ, sửa thông báo lỗi...):
Chữ/layout hiển thị → pages/LoginPage.jsx
Logic gọi API lúc bấm nút → services/auth.service.js
Câu thông báo lỗi server trả về → server/controllers/auth.controller.js

3) Thêm ảnh:
Icon/ảnh trang trí dùng trong code → client/src/assets/ (import)
Ảnh do user upload (avatar, ảnh món ăn) → đẩy lên Cloudinary (ngoài repo), DB chỉ lưu URL

🚫 4 lỗi "kinh điển" tránh xa
Nhét logic DB vào controller, controller vào routes → rối không gỡ được. Nhớ nhịp: routes (đường đi) → controllers (xử lý) → models (DB).
Component gọi API trực tiếp → đổi URL/API phải sửa 20 chỗ. Mọi call đi qua services/.
Commit .env lên GitHub → lộ hết secret. Chỉ commit .env.example.
Để file "tạm thời" lung tung ở root → thống nhất luôn theo cấu trúc này ngay từ đầu.