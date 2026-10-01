# Skill: UI Kit — chọn đúng component (skill-ui-kit)

> Dùng khi AI viết giao diện cho repo này (page, component, form, modal, thông báo...). Mục tiêu: **luôn tái sử dụng thư viện component của nhóm**, chọn đúng em, không tự chế.

## 0. Luật bắt buộc
- LUÔN ưu tiên component có sẵn trong `client/src/components/` trước khi nghĩ đến viết mới.
- Import gọn: `import { Button, TextField } from '@/components';` (hoặc đường dẫn tương đối `'../../components'`).
- Component của kit **KHÔNG gọi API, KHÔNG đọc store** — dữ liệu truyền vào qua props (page/service lo).
- CẤM tự dựng lại những thứ đã có (Button, Modal, ConfirmDialog, Toast, TextField...). Thiếu component phù hợp → **hỏi lại trước**, đừng tự chế.
- Muốn sửa/thêm biến thể cho component kit → bàn với nhóm (dùng chung toàn app), không tự ý sửa.
- Trong bản kế hoạch UI, **liệt kê component sẽ dùng theo danh mục này TRƯỚC khi code**.
- Props chi tiết: mở file component tương ứng — JSDoc trong đó rất đầy đủ.

### Lưu ý trạng thái Post cập nhật ngày 28/09/2026

- Nguồn chuẩn là `database/ERD_SWP_PostgreSQL_v4_1.sql`: Post chỉ có `pending/public/reported/deleted`; Report có `pending/accepted/rejected`.
- Từ chối/gỡ Post dùng `deleted`, kèm lý do và AdminLog; không truyền `rejected/hidden` cho `StatusBadge entity="post"`.
- Danh mục dưới đây mô tả component hiện có. `constants/status.js` còn lệch schema: thiếu Post `reported`, thừa `rejected/hidden`; cần thống nhất tích hợp trước khi sửa code dùng chung.
- `ReportDialog` dùng để thành viên gửi báo cáo; Admin xử lý báo cáo qua trang quản trị và `ConfirmDialog`, không dùng `ReportDialog` làm hộp xử lý.

<!-- Tung's code: Bổ sung quy tắc hiển thị reported và ngôn ngữ quyết định đã được người dùng chốt. -->
- Post `reported` vẫn hiển thị công khai. Bảng tin/search cần lấy cả `public/reported`, loại `pending/deleted`; không hiểu reported là bị ẩn.
- Trong module của Tung, dùng Chip hiện có với nhãn Công khai — có báo cáo; nhãn Report dùng Chấp nhận gỡ bài/Từ chối gỡ bài. Enum và component kit dùng chung giữ nguyên.
<!-- Tung's code: Kết thúc ghi chú; không thay đổi code thư viện dùng chung. -->

## 1. Chọn nhanh — "cần gì → dùng em nào"
- Nút có chữ → **Button** (primary / outline / subtle / alert)
- Nút chỉ có icon (tim, chuông...) → **IconButton**
- Ô nhập 1 dòng (email, tiêu đề...) → **TextField** · Ô mật khẩu (hiện/ẩn) → **PasswordField** · Ô nhập dài → **TextArea**
- Bọc ô nhập (label / hint / báo lỗi) → **Field** (đã bọc sẵn trong TextField/TextArea/PasswordField; ghép tay chỉ khi ô custom)
- Chọn 1 mục trong danh sách → **Select** · Ít lựa chọn hiện hết → **RadioGroup** · Bật/tắt → **Checkbox**
- Nhập nhiều từ khoá dạng chip → **ChipInput** · Chọn danh mục → **CategoryPicker** · Tăng/giảm số → **NumberStepper**
- Tải ảnh lên (có preview) → **ImageUpload** · Hiện ảnh → **Photo** · Avatar → **Avatar**
- Ô tìm kiếm → **SearchInput** · Danh sách dài + phân trang → **Pagination**
- Hỏi "Bạn chắc chắn?" → **ConfirmDialog** · Hộp thoại có nội dung/form riêng → **Modal**
- Thông báo tạm "Đã lưu" → **Toast** (`useToast()`) · Cảnh báo cần đọc/hành động trong trang → **Notice** ⚠️ đừng lộn 2 em này
- Trạng thái (chờ duyệt / đã duyệt...) → **StatusBadge** · Tag nhỏ → **Chip** · Tag nổi bật → **HighlightChip**
- Đang tải → **Spinner** (nhỏ) / **Skeleton** + **SkeletonCard** (khung xương) · Danh sách trống → **EmptyState**
- Thả xuống → **Menu** · Tab → **Tabs** · Khung nội dung có tiêu đề → **Panel** · Đầu trang → **PageHeader**
- Bảng dữ liệu → **DataTable** · Số liệu nổi bật → **StatCard** · Tổng calo → **CalorieSummary**
- Card bài đăng → **PostCard** · Soạn bài → **PostComposer** · Bình luận → **Comment** (+Composer/Item/Section)
- Card món ăn → **DishCard** · Công thức → **RecipeCard / RecipeView** · Quán → **ShopCard / ShopMenuItem**
- Chat → **ChatBubble** + **ChatComposer** + **ChatThread** · Danh sách thông báo → **NotificationList**
- Video → **YouTubeEmbed** · Nút vote → **VoteButton** · Báo cáo vi phạm → **ReportDialog**
- Layout admin → **AdminLayout** · Vỏ app (nav + logo) → **AppShell** · Chưa đăng nhập → **LoginPrompt**
- Sửa nguyên liệu → **IngredientEditor** · Sửa bước → **StepEditor** · Chọn ngày → **DayTabs** · Gợi ý AI → **AiTip / AiProgress**

## 2. Danh mục đầy đủ (theo nhóm)
### Đợt 1 · Nền tảng & phản hồi
- **Button** — Nút bấm có chữ. Mọi prop khác (onClick, disabled, form, aria-*) truyền thẳng xuống thẻ gốc. · props: variant, size, icon, iconPosition, iconOnly, loading, block, as, type, disabled, className, children …
- **IconButton** — Nút tròn chỉ có icon (header, góc thẻ bài viết, khung chat). · props: icon, label, badge, variant, size, active, className, type, …rest
- **Spinner** — Vòng xoay đang tải. Dùng cho: nút đang gửi (Button tự dùng khi loading), chờ AI trả lời, tải danh sách. · props: size, label, showLabel, className
- **Skeleton / SkeletonCard** — Khung xám nhấp nháy giữ chỗ khi đang tải dữ liệu (thay cho màn hình trắng). Dùng khi: tải danh sách bài, danh sách quán, chờ AI tạo thực đơn. Mẹo:… · props: shape, lines, width, height, className
- **Avatar** — Ảnh đại diện; không có ảnh → hiện chữ cái đầu của tên. · props: src, name, size, className
- **Photo** — Ảnh có dự phòng: không có src hoặc tải lỗi → nền lá xanh thay thế (không bao giờ hiện ảnh vỡ). Dùng cho mọi ảnh món, ảnh bài blog, ảnh quán, ảnh bìa… · props: src, alt, ratio, shape, className, style, …rest
- **StatusBadge** — Nhãn trạng thái của một đối tượng (bài đăng, món, quán, tài khoản, báo cáo...). Chữ, màu và icon lấy từ src/constants/status.js, khớp đúng giá trị… · props: entity, status, label, size, className
- **Chip** — Nhãn nhỏ. Dùng để hiển thị Category ("Món nước", "Món khô") và làm bộ lọc bấm được. (Thay cho Tag cũ – v4.0 đã bỏ entity Tag, chỉ còn Category.) Hai… · props: icon, selected, onClick, onRemove, disabled, className, children
- **HighlightChip** — Nhãn ĐIỂM NHẤN màu vàng cúc (theme C) – kéo mắt người dùng. Quy tắc: mỗi khu vực tối đa 1 chip này. Dùng cho "AI gợi ý", "MỚI", thành tích. · props: icon, variant, className, children
- **Notice** — Thông báo nằm cố định trong trang (không tự ẩn). Dùng cho: tài khoản bị khoá, lý do bài bị từ chối/ẩn, lỗi tải dữ liệu, cảnh báo "không thay thế tư… · props: tone, title, action, onDismiss, className, children
- **ToastProvider + useToast()** — Thông báo nhỏ góc dưới màn hình, tự ẩn ("Đã lưu", "Bài đang chờ duyệt"...). 1. Bọc app 1 lần trong main.jsx: <ToastProvider><App /></ToastProvider>… · props: children
- **Modal** — Hộp thoại (dùng thẻ <dialog> gốc → tự giữ focus bên trong, Esc để đóng). Nội dung chỉ được vẽ khi mở → form bên trong tự làm mới mỗi lần mở lại. Muốn… · props: open, onClose, title, description, size, placement, footer, dismissible, className, children
- **ConfirmDialog** — Hộp thoại xác nhận trước hành động khó hoàn tác. Dùng cho: xoá bài / bình luận / công thức, khoá tài khoản, từ chối bài, ẩn nội dung, bác báo cáo.… · props: open, title, message, confirmLabel, cancelLabel, tone, loading, reason, onConfirm, onCancel
- **Menu** — Menu thả xuống (nút "…" trên bài viết, menu tài khoản, thông báo). Bấm ra ngoài hoặc Esc để đóng. phần tử { divider: true } = đường kẻ ngăn cách · props: renderTrigger, items, align, side, width, className, children
- **Tabs** — Thanh tab gạch chân trong trang (Bài của tôi: Blog/Video, Moderation Center: Post/Dish/Shop/Report...). Trên điện thoại tự cuộn ngang. Bàn phím: ← →… · props: items, value, onChange, label, className
- **Panel** — Khung thẻ có tiêu đề – dùng cho các khối ở cột phải bảng tin, trang hồ sơ, trang quản trị. · props: title, icon, action, flush, as, className, children, …rest
- **EmptyState** — Trạng thái trống: chưa có bài, không tìm thấy kết quả, hàng chờ duyệt đã xử lý hết... · props: icon, title, action, className, children
- **ThemeToggle** — Đổi nền Sáng / Tối. Tự đọc và lưu lựa chọn (utils/theme.js), trang KHÔNG cần truyền state. - variant="icon" : nút tròn mặt trăng / mặt trời, bấm là… · props: variant, buttonVariant, size, label, showHint, className

### Đợt 2 · Form (mọi ô nhập: onChange nhận THẲNG giá trị)
- **Field** — Khung chung cho mọi ô nhập: nhãn + dấu * bắt buộc + dòng gợi ý / lỗi + bộ đếm ký tự. TextField, Select, CategoryPicker... đều dùng Field bên trong.… · props: id, label, hint, error, required, counter, as, className, children
- **TextField** — Ô nhập 1 dòng: tiêu đề bài, email, tên quán, số cân nặng... Mọi prop khác (name, autoComplete, min, max, step, onBlur, inputMode...) truyền thẳng… · props: label, value, onChange, type, hint, error, required, maxLength, icon, suffix, size, id …
- **TextArea** — Ô nhập nhiều dòng, tự cao lên theo nội dung: nội dung blog, mô tả món, hướng dẫn nấu, bình luận. · props: label, value, onChange, hint, error, required, maxLength, rows, maxRows, id, className, …rest
- **PasswordField** — Ô mật khẩu có nút hiện/ẩn. Dùng cho Đăng ký, Đăng nhập (M-17). Đăng nhập: current-password · Đăng ký: new-password (trình duyệt gợi ý mật khẩu mạnh) · props: label, value, onChange, hint, error, required, autoComplete, id, className, …rest
- **Select** — Hộp chọn 1 giá trị (dùng <select> gốc → chạy tốt trên điện thoại). Dùng cho: mức vận động, giới tính, lý do báo cáo, sắp xếp "Mới nhất / Xem nhiều".… · props: label, options, value, onChange, placeholder, hint, error, required, size, id, className, …rest
- **RadioGroup** — Chọn 1 trong vài lựa chọn, hiện hết ra màn hình. 3 kiểu: - 'list' : dọc, nút tròn truyền thống (giới tính, lý do báo cáo) - 'segmented' : thanh gộp… · props: label, options, value, onChange, variant, hint, error, required, disabled, name, className
- **Checkbox** — Ô tick có / không. Dùng cho: đồng ý thu thập dữ liệu sức khoẻ (BR-08, profile.consent_at), "Ghi nhớ đăng nhập", món trong menu quán "Đang bán"… · props: checked, onChange, children, hint, error, switch, disabled, required, id, className, …rest
- **CategoryPicker** — Chọn nhiều Category bằng chip bấm được (Post N-M Category, Dish N-M Category). Dùng cho: form Viết Blog, Đăng Video, Tạo món; bộ lọc trang tìm kiếm.… · props: label, options, value, onChange, max, searchFrom, hint, error, required, disabled, className
- **ChipInput** — Nhập nhiều giá trị chữ tự do, mỗi giá trị thành 1 chip. Dùng cho: dị ứng / món kiêng trong Profile (allergy), nguyên liệu có sẵn khi tạo Meal Plan.… · props: label, value, onChange, suggestions, max, maxLength, placeholder, hint, error, required, disabled, id …
- **NumberStepper** — Chọn số nhỏ bằng nút − / +, vẫn gõ tay được. Dùng cho: số ngày Meal Plan (1 đến 7), số bữa mỗi ngày (mặc định 3), khẩu phần công thức. · props: label, value, onChange, min, max, step, unit, hint, error, required, disabled, id …
- **ImageUpload** — Chọn / kéo thả ảnh, xem trước, thanh tiến độ, báo lỗi, thử lại. Component KHÔNG biết ảnh lên cloud nào: trang truyền vào hàm `onUpload`. Database chỉ… · props: label, value, onChange, onUpload, multiple, max, maxSizeMB, accept, ratio, hint, error, required …
- **SearchInput** — Ô tìm kiếm có kính lúp + nút xoá nhanh. Dùng cho: thanh trên (tìm bài), trang kết quả M-02, danh sách quán, bảng admin. · props: value, onChange, onSearch, placeholder, label, size, loading, className, …rest
- **Pagination** — Phân trang. Dùng cho: kết quả tìm Post, danh sách quán, bảng admin. Trang bắt đầu từ 1 (khớp ?page=1 của API). · props: page, totalPages, onChange, totalItems, pageSize, itemLabel, className

### Đợt 3 · Bài đăng
- **PostCard** — Thẻ bài đăng Blog / Video. - layout="card": bảng tin trang chủ (M-01), gợi ý liên quan - layout="row" : kết quả tìm kiếm (M-02), Bài của tôi (M-07),… · props: layout, postType, title, excerpt, href, linkAs, thumbnailUrl, youtubeVideoId, author, createdAt, categories, voteCount …
- **YouTubeEmbed** — Video YouTube kiểu "tải nhẹ": ban đầu chỉ hiện ảnh bìa + nút Play, bấm mới tải trình phát. → Trang có nhiều video vẫn nhanh. Ảnh bìa lỗi / link sai →… · props: videoId, url, title, autoLoad, shape, className
- **VoteButton** — Nút bình chọn một chiều cho bài (post_vote): bấm để thích, bấm lại để bỏ (UC-06, FR-08). Component chỉ hiển thị. Trang gọi API rồi cập nhật voted +… · props: voted, count, onToggle, size, disabled, className
- **CommentSection** — Khu bình luận hoàn chỉnh dưới bài (M-03, M-04): tiêu đề + ô viết + danh sách + xem thêm + xác nhận xoá. Bình luận phẳng, mới nhất ở trên. Có sẵn… · props: comments, total, currentUser, onCreate, onUpdate, onDelete, onReport, onRequireLogin, loading, hasMore, loadingMore, onLoadMore …
- **CommentItem** — 1 bình luận. Bình luận phẳng, KHÔNG có trả lời lồng nhau (nhóm đã chốt). Chủ bình luận: menu Sửa / Xoá, sửa ngay tại chỗ. Người khác: menu Báo cáo.… · props: author, content, createdAt, edited, status, isOwner, onSave, onDelete, onReport, maxLength, className
- **CommentComposer** — Ô viết bình luận. Gửi xong tự xoá trắng. Ctrl + Enter để gửi nhanh. Ném lỗi (throw new Error('Bình luận chứa từ ngữ không phù hợp')) → hiện câu lỗi,… · props: currentUser, onSubmit, onRequireLogin, maxLength, placeholder, className
- **ReportDialog** — Hộp báo cáo vi phạm (FR-24): chọn lý do + ghi chú. Báo cáo vào hàng chờ Admin (report.status = 'pending'). reasonCode = report.reason_code ('spam',… · props: open, targetType, targetTitle, onSubmit, onClose
- **LoginPrompt** — Mời khách đăng nhập (chặn mềm, BR-04): đóng được, không khoá cứng trang. - reason="posts": khách mở bài thứ 4 trong ngày (UC-02) - reason="chat" :… · props: open, reason, onLogin, onRegister, onClose
- **PostComposer** — Câu mở đầu gợi ý. Bấm chip → điền sẵn vào ô chính. Trang có thể truyền `prompts` khác. · props: currentUser, categories, onSubmit, onUpload, onOpenBlogEditor, onOpenVideoEditor, onRequireLogin, prompts, maxCategories, className

### Đợt 4 · Món, công thức, quán
- **DishCard** — Thẻ món ăn dùng chung (Dish). Món là "danh mục món", mỗi món có nhiều công thức của cộng đồng (BR-09). - layout="card": danh mục món, kết quả tìm… · props: layout, name, description, imageUrl, href, linkAs, categories, recipeCount, shopCount, status, showStatus, moderationNote …
- **RecipeCard** — Thẻ công thức (Recipe) của 1 thành viên cho 1 món (Dish). - layout="row" : danh sách công thức trong Dish Detail (M-13), "Công thức của tôi" -… · props: layout, title, description, imageUrl, href, linkAs, author, createdAt, cookTimeMinutes, servings, calories, ingredientCount …
- **RecipeFacts** — Dòng thông số nhanh của công thức: thời gian · khẩu phần · calo. Dùng trong RecipeCard và đầu trang chi tiết công thức. Thiếu số nào thì ẩn số đó. · props: cookTimeMinutes, servings, calories, size, className
- **IngredientEditor** — Nhập danh sách nguyên liệu cho công thức (M-19, UC-11): tên + số lượng + đơn vị. Lưu vào recipe_ingredient (amount, unit) + ingredient (name). - Tên:… · props: value, onChange, suggestions, rowErrors, max, label, hint, error, required, disabled, className
- **StepEditor** — Nhập các bước nấu (M-19). Mỗi bước 1 ô, đánh số tự động, đổi thứ tự bằng nút ↑ ↓. Database chỉ có recipe.instructions (TEXT) → gửi API:… · props: value, onChange, max, maxLength, label, hint, error, required, disabled, className
- **ShopCard** — Link tìm địa chỉ trên Google Maps (không cần toạ độ; v4.0 không lưu lat/lng). · props: layout, name, imageUrl, address, phone, openTime, closeTime, now, href, linkAs, dishCount, matchedDish …
- **ShopMenuItem** — 1 món trong menu quán (shop_dish): gắn với 1 Dish, có giá, ghi chú thành phần, còn bán hay tạm hết. Đặt trong <ul> (mỗi item là 1 <li>). - Khách xem… · props: name, price, ingredientNote, showPhoto, imageUrl, isAvailable, dishHref, linkAs, editable, onToggleAvailable, toggling, onEdit …

### Đợt 5 · AI, Admin, khung trang
- **ChatBubble** — 1 tin nhắn trong khung chat với trợ lý Mầm (M-12). Khớp bảng chat_message. filtered: câu hỏi bị lọc từ khoá · error: gọi AI lỗi, KHÔNG trừ lượt… · props: sender, status, content, time, typing, refPost, linkAs, onRetry, className, children
- **ChatThread** — Khung cuộn chứa các ChatBubble. Tự cuộn xuống cuối khi có tin mới (nếu người dùng đang đọc tin cũ ở trên thì KHÔNG giật xuống). Trống → hiện `empty`… · props: children, empty, label, className
- **ChatComposer** — Ô nhập câu hỏi cho trợ lý Mầm (M-12). Enter để gửi, Shift + Enter để xuống dòng. Tự cao lên tới 6 dòng. Khách dùng thử 3 lượt/ngày (BR-04): truyền… · props: onSend, busy, quota, onRequireLogin, showDisclaimer, placeholder, maxLength, disabled, className
- **PromptChip** — Câu hỏi gợi ý cho trợ lý AI – bấm vào là gửi câu hỏi đó. · props: icon, block, onClick, disabled, className, children
- **AiTip** — Hộp gợi ý từ trợ lý AI dinh dưỡng, kèm câu hỏi nhanh. · props: title, prompts, onPrompt, className, children
- **AiProgress** — Các bước khi Mầm lên thực đơn (UC-09 bước 3 → 4). · props: steps, current, title, error, onRetry, onCancel, className
- **DayTabs** — Nhãn ngày thứ n của thực đơn: có start_date → "T2 29/9", không có → "Ngày 1". · props: daysCount, value, onChange, startDate, todayNo, warnDays, renderSub, className
- **MealCard** — 1 bữa trong thực đơn (meal_plan_item) ở trang Kết quả Meal Plan (M-11). Mỗi item phải map tới 1 Dish hợp lệ (FR-13) → bấm tên / "Xem món" mở Dish… · props: slot, dishName, description, calories, nutritionGroup, imageUrl, dishHref, linkAs, isSwapped, originalDishName, warning, onSwap …
- **CalorieSummary** — Tổng calo của 1 ngày trong thực đơn so với calo mục tiêu (meal_plan.target_calories_kcal). Dữ liệu v4.0 chỉ có calo từng bữa… · props: total, target, bySlot, title, className
- **StatCard** — Ô số liệu: Admin Dashboard (M-14: Post chờ duyệt, Dish chờ duyệt, Shop chờ xác minh, Report chờ xử lý) và chỉ số sức khoẻ ở Meal Planner (BMI, TDEE,… · props: label, value, unit, icon, tone, hint, href, linkAs, onClick, loading, className
- **DataTable** — Bảng dữ liệu cho trang quản trị (M-14, M-15, M-16): danh sách chờ duyệt, báo cáo, tài khoản, danh mục. Không tự gọi API, không tự lọc/sắp xếp: bấm… · props: columns, rows, rowKey, sort, onSortChange, selectable, selected, onSelectionChange, bulkActions, loading, empty, caption …
- **NotificationList** — Danh sách thông báo (bảng notification). Thường đặt trong <Menu> mở từ nút chuông của AppShell. Icon và màu lấy theo notification.type… · props: items, onItemClick, onMarkAllRead, loading, linkAs, title, className
- **PageHeader** — Đầu trang thống nhất: đường dẫn (tuỳ chọn) · tiêu đề H1 · mô tả · nút thao tác bên phải. Mỗi trang chỉ 1 PageHeader (nó chứa thẻ <h1>). · props: title, description, breadcrumb, actions, linkAs, className
- **AppShell** — Khung cho mọi trang của khách và thành viên (giữ đúng bố cục bản app-an-chay-ui_1): - Máy tính (≥ 768px): dock dọc bên trái (logo, nút Đăng bài,… · props: nav, activeKey, linkAs, user, accountMenu, notificationCount, renderNotifications, onCreate, search, onSearchClick, mobileNavKeys, onLogin …
- **Logo** — Logo app: ô bo góc lệch + chiếc lá. showName = hiện chữ "Ăn Chay" bên cạnh. · props: href, linkAs, showName, size, className
- **AdminLayout** — Khung khu quản trị /admin (M-14, M-15, M-16): menu trái cố định + thanh trên có đường dẫn. Điện thoại / máy tính bảng (< 992px): menu trái ẩn, bấm… · props: nav, activeKey, linkAs, title, user, accountMenu, actions, contained, className, children
> (Danh mục sinh tự động từ thư viện thật — cập nhật khi nhóm thêm component mới.)
