# UI Kit — quy tắc sử dụng và catalog

Phạm vi: UI dùng chung trong ứng dụng chính. Quy ước code nằm trong [development guide](development-guide.md).

## 1. Sử dụng thư viện

- Chọn component đã có trước khi tạo mới; thay đổi/thêm biến thể dùng chung cần thống nhất với nhóm.
- Quy tắc phân tầng và dữ liệu nằm trong [development guide](development-guide.md#4-frontend-và-ui), không lặp lại ở đây.
- Catalog xác định nơi tra cứu, không chép lại toàn bộ props. Đọc JSDoc/chữ ký và cách sử dụng trong source trước khi bind dữ liệu.
- [Barrel export](../client/src/components/index.js) là điểm tra component được export; component khác trong thư mục có thể được import trực tiếp nếu phù hợp phạm vi sử dụng.
- Vite hiện chưa cấu hình alias `@`: dùng import tương đối đúng vị trí, ví dụ `import { Button } from '../components';` từ file trong `client/src/pages/`.
- Form của kit trả giá trị trực tiếp qua callback (giá trị/boolean/mảng tùy component); kiểm tra chữ ký cụ thể, không mặc định nhận DOM event.
- `ToastProvider/useToast` dùng cho thông báo tạm; `Notice` cho thông báo trong trang; `ConfirmDialog` cho xác nhận; `Modal` cho nội dung/form.
- `ThemeToggle` dùng cơ chế theme của thư viện; [theme](../client/src/styles/theme.scss) và [tiện ích theme](../client/src/utils/theme.js) là nơi đối chiếu style dùng chung.
- `StatusBadge` nhận đúng `entity` và `status`. [Status constants](../client/src/constants/status.js) là map hiển thị, không phải bằng chứng schema hay quyết định nghiệp vụ; xử lý khác biệt theo contract thực tế.
- Catalog này không quy định enum database, quota, chính sách duyệt hoặc lời thoại riêng của từng module.

## 2. Chọn component và mở source

Catalog đối chiếu barrel export ngày 07/10/2026; cập nhật khi thư viện thay đổi. Một hàng có thể chứa nhiều export cùng source; helper và hằng số đi kèm tra trong file tương ứng.

### Nền tảng và phản hồi

| Component / export | Dùng cho |
|---|---|
| [Button](../client/src/components/Button/Button.jsx) | Nút có chữ; trạng thái loading và các biến thể. |
| [IconButton](../client/src/components/IconButton/IconButton.jsx) | Nút chỉ có icon, kèm nhãn truy cập. |
| [Spinner](../client/src/components/Spinner/Spinner.jsx) | Báo đang tải ở một khu vực nhỏ. |
| [Skeleton](../client/src/components/Skeleton/Skeleton.jsx) / [SkeletonCard](../client/src/components/Skeleton/Skeleton.jsx) | Khung giữ chỗ khi đang tải. Khung giữ chỗ dạng card. |
| [Avatar](../client/src/components/Avatar/Avatar.jsx) | Ảnh đại diện và chữ dự phòng. |
| [Photo](../client/src/components/Photo/Photo.jsx) | Ảnh với trạng thái dự phòng. |
| [StatusBadge](../client/src/components/StatusBadge/StatusBadge.jsx) | Nhãn trạng thái theo entity. |
| [Chip](../client/src/components/Chip/Chip.jsx) | Nhãn, bộ lọc hoặc lựa chọn nhỏ. |
| [HighlightChip](../client/src/components/HighlightChip/HighlightChip.jsx) | Nhãn nhấn mạnh. |
| [Notice](../client/src/components/Notice/Notice.jsx) | Thông báo nằm trong trang. |
| [ToastProvider](../client/src/components/Toast/Toast.jsx) | Provider thông báo tạm; gọi qua useToast. |
| [Modal](../client/src/components/Modal/Modal.jsx) | Hộp thoại chứa nội dung hoặc form. |
| [ConfirmDialog](../client/src/components/ConfirmDialog/ConfirmDialog.jsx) | Xác nhận hành động; hỗ trợ lý do/loading. |
| [Menu](../client/src/components/Menu/Menu.jsx) | Menu thả xuống. |
| [Tabs](../client/src/components/Tabs/Tabs.jsx) | Chuyển tab nội dung. |
| [Panel](../client/src/components/Panel/Panel.jsx) | Khối nội dung có tiêu đề. |
| [EmptyState](../client/src/components/EmptyState/EmptyState.jsx) | Danh sách/khu vực chưa có dữ liệu. |
| [ThemeToggle](../client/src/components/ThemeToggle/ThemeToggle.jsx) | Đổi theme bằng cơ chế theme hiện có. |

### Form và danh sách

| Component / export | Dùng cho |
|---|---|
| [Field](../client/src/components/Field/Field.jsx) | Khung label, hint và lỗi cho ô nhập. |
| [TextField](../client/src/components/TextField/TextField.jsx) | Ô nhập một dòng. |
| [TextArea](../client/src/components/TextArea/TextArea.jsx) | Ô nhập nhiều dòng. |
| [PasswordField](../client/src/components/PasswordField/PasswordField.jsx) | Ô mật khẩu có nút hiện/ẩn. |
| [Select](../client/src/components/Select/Select.jsx) | Chọn một giá trị. |
| [RadioGroup](../client/src/components/RadioGroup/RadioGroup.jsx) | Chọn một trong các lựa chọn hiển thị. |
| [Checkbox](../client/src/components/Checkbox/Checkbox.jsx) | Lựa chọn boolean hoặc switch. |
| [CategoryPicker](../client/src/components/CategoryPicker/CategoryPicker.jsx) | Chọn nhiều danh mục. |
| [ChipInput](../client/src/components/ChipInput/ChipInput.jsx) | Nhập danh sách giá trị dạng chip. |
| [NumberStepper](../client/src/components/NumberStepper/NumberStepper.jsx) | Tăng/giảm và nhập số. |
| [ImageUpload](../client/src/components/ImageUpload/ImageUpload.jsx) | Chọn ảnh, xem trước; trang cấp hàm onUpload. |
| [SearchInput](../client/src/components/SearchInput/SearchInput.jsx) | Nhập và gửi từ khóa tìm kiếm. |
| [Pagination](../client/src/components/Pagination/Pagination.jsx) | Chọn trang; số trang bắt đầu từ 1. |

### Bài đăng

| Component / export | Dùng cho |
|---|---|
| [PostCard](../client/src/components/PostCard/PostCard.jsx) | Thẻ bài đăng ở dạng card/row. |
| [YouTubeEmbed](../client/src/components/YouTubeEmbed/YouTubeEmbed.jsx) | Hiển thị video YouTube. |
| [VoteButton](../client/src/components/VoteButton/VoteButton.jsx) | Hiển thị vote và chuyển callback lên trang. |
| [CommentSection](../client/src/components/Comment/CommentSection.jsx) | Ghép danh sách và các thao tác bình luận. |
| [CommentItem](../client/src/components/Comment/CommentItem.jsx) | Một bình luận và thao tác tương ứng. |
| [CommentComposer](../client/src/components/Comment/CommentComposer.jsx) | Ô soạn bình luận. |
| [ReportDialog](../client/src/components/ReportDialog/ReportDialog.jsx) | Form gửi báo cáo vi phạm. |
| [LoginPrompt](../client/src/components/LoginPrompt/LoginPrompt.jsx) | Lời mời đăng nhập/đăng ký. |
| [PostComposer](../client/src/components/PostComposer/PostComposer.jsx) | Khu vực bắt đầu soạn bài. |

### Món, công thức và quán

| Component / export | Dùng cho |
|---|---|
| [DishCard](../client/src/components/DishCard/DishCard.jsx) | Thẻ món ăn. |
| [RecipeCard](../client/src/components/RecipeCard/RecipeCard.jsx) | Thẻ công thức. |
| [RecipeFacts](../client/src/components/RecipeView/RecipeView.jsx) / [IngredientList](../client/src/components/RecipeView/RecipeView.jsx) / [RecipeSteps](../client/src/components/RecipeView/RecipeView.jsx) | Thông số nhanh của công thức. Danh sách nguyên liệu. Danh sách bước nấu. |
| [IngredientEditor](../client/src/components/IngredientEditor/IngredientEditor.jsx) | Nhập/chỉnh danh sách nguyên liệu. |
| [StepEditor](../client/src/components/StepEditor/StepEditor.jsx) | Nhập/chỉnh các bước nấu. |
| [ShopCard](../client/src/components/ShopCard/ShopCard.jsx) | Thẻ quán và liên kết địa chỉ. |
| [ShopMenuItem](../client/src/components/ShopMenuItem/ShopMenuItem.jsx) | Một dòng món trong menu quán. |

### Chat, quản trị và khung trang

| Component / export | Dùng cho |
|---|---|
| [ChatBubble](../client/src/components/ChatBubble/ChatBubble.jsx) | Một tin nhắn và trạng thái hiển thị. |
| [ChatThread](../client/src/components/ChatThread/ChatThread.jsx) | Khung danh sách tin nhắn. |
| [ChatComposer](../client/src/components/ChatComposer/ChatComposer.jsx) | Ô soạn tin nhắn. |
| [PromptChip](../client/src/components/PromptChip/PromptChip.jsx) | Gợi ý có thể chọn. |
| [AiTip](../client/src/components/AiTip/AiTip.jsx) | Khối gợi ý của trợ lý. |
| [AiProgress](../client/src/components/AiProgress/AiProgress.jsx) | Các bước và tiến độ xử lý. |
| [DayTabs](../client/src/components/DayTabs/DayTabs.jsx) | Chọn ngày trong kế hoạch. |
| [MealCard](../client/src/components/MealCard/MealCard.jsx) | Thẻ bữa ăn. |
| [CalorieSummary](../client/src/components/CalorieSummary/CalorieSummary.jsx) | Tổng hợp calo. |
| [StatCard](../client/src/components/StatCard/StatCard.jsx) | Một chỉ số thống kê. |
| [DataTable](../client/src/components/DataTable/DataTable.jsx) | Bảng; callback cho lọc/sort/chọn dòng. |
| [NotificationList](../client/src/components/NotificationList/NotificationList.jsx) | Danh sách thông báo và callback đọc. |
| [PageHeader](../client/src/components/PageHeader/PageHeader.jsx) | Tiêu đề và hành động của màn hình. |
| [AppShell](../client/src/components/AppShell/AppShell.jsx) | Khung ứng dụng. |
| [Logo](../client/src/components/AppShell/Logo.jsx) | Logo ứng dụng. |
| [AdminSidebar](../client/src/components/AdminSidebar/AdminSidebar.jsx) | Thanh điều hướng quản trị. |
| [AdminLayout](../client/src/components/AdminLayout/AdminLayout.jsx) | Khung trang quản trị. |
