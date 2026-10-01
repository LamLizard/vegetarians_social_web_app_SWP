# Ngữ cảnh dự án cho kiểm duyệt report theo case

> Tài liệu bàn giao ngày 2026-09-30. Đây là mô tả trạng thái code và hợp đồng schema dự kiến, không phải xác nhận schema Neon mới đã hoàn thành.

## Phạm vi

- Ứng dụng Vegetarian Social: client React 19/Vite; server Express/PostgreSQL (Neon), đăng nhập JWT.
- Người dùng đã có thể báo cáo post và comment qua các API ở server/src/routes/post.routes.js. Logic ghi report nằm trong server/src/models/post.model.js, thuộc phần Bảng tin của Khôi.
- Trang Admin hiện ở client/src/pages/AdminModerationPage.jsx. Hiện có tab duyệt post và report post; danh sách report đang hiển thị từng report, cũ nhất trước. API hiện tại ở server/src/routes/postModeration.routes.js chỉ xử lý report post theo report_id.
- client/src/App.jsx điều hướng bằng pathname, chưa dùng React Router. Khu kiểm duyệt là /admin/moderation. AdminDashboardPage.jsx đã có link ?type=report; phải giữ key này cho tab report post.
- server/src/models/admin.model.js hiện đếm report riêng lẻ trong dashboard; số này chưa phải số case. Đổi ý nghĩa dashboard cần được bàn riêng vì đây là code chung.

## Nghiệp vụ đã chốt

1. Post và comment bị nhiều người báo cáo sẽ có tối đa một case đang pending cho mỗi cặp target_type + target_id.
2. Mỗi report vẫn giữ người gửi, lý do và thời gian. Một quyết định xử lý toàn bộ report của case trong một giao dịch.
3. Chấp nhận case post: gỡ post. Chấp nhận case comment: chuyển comment sang deleted và giảm post.comment_count đúng một lần nếu comment trước đó là public. Từ chối: giữ nội dung; post reported có thể trở lại public theo điều kiện nghiệp vụ cũ.
4. Case đóng rồi thì report mới về đối tượng còn hiển thị sẽ mở case mới. Người đã báo cáo case cũ có thể báo cáo lại trong case mới, nhưng không gửi trùng trong cùng case.
5. Admin xem một dòng cho mỗi case. Sắp theo report mới nhất của case: created_at DESC, report_id DESC, case_id DESC; phân trang sau khi sắp. Case vừa nhận report sẽ lên đầu trang 1.
6. Thêm tab Báo cáo bình luận ngay sau Báo cáo bài viết. Phân quyền trực theo ngày chưa nằm trong lượt này; role vẫn là admin.

## Hợp đồng schema mới được dùng trong tài liệu

- Bảng report_case: case_id BIGINT khóa chính; target_type dùng report_target_type_enum; target_id BIGINT; status dùng report_status_enum (pending/accepted/rejected); created_at; handled_by; handled_at; resolution_note.
- report.case_id BIGINT NOT NULL, FK tới report_case.case_id.
- Unique index một case pending cho mỗi (target_type, target_id).
- Unique index (case_id, reporter_id) ngăn cùng người gửi trùng trong một case.
- Không có FK vật lý từ target_id tới cả post và comment vì target đa hình. Server kiểm tra target khi nhận report và khi xử lý.
- Nếu schema mới do chat khác tạo có tên cột hoặc constraint khác, đối chiếu lại trước khi chép mã từ tài liệu hướng dẫn.
- Thư mục database-seed/ đang được làm riêng và chưa theo Git trong workspace này; seed report cũ chưa có case_id, không chạy nguyên trạng trên schema mới bắt buộc case_id.

## Ranh giới chỉnh sửa

- Chỉ sửa source thuộc nhiệm vụ kiểm duyệt report. Khi thêm code vào file chung hoặc code của thành viên khác, ghi chú Tung's code.
- Nếu phải thay hoặc xóa code của thành viên khác, hỏi ý kiến trước. Riêng câu INSERT report cũ trong post.model.js sẽ phải thay để điền case_id nếu cột này NOT NULL; tài liệu hướng dẫn không tự áp dụng thay đổi đó.
- Page mới phải có comment đầu file nêu người viết, chức năng và luồng kết nối. Giữ tên file theo docs/quy-uoc-dat-ten.md.
- Lượt hiện tại chỉ viết tài liệu Markdown, không sửa source/Neon và không chạy test.

## Tài liệu đi kèm

- docs/report-case-implementation-guide.md: nghiệp vụ, hợp đồng API và mã/hướng dẫn áp dụng thủ công.
- docs/report-case-manual-test.md: thứ tự test bằng UI/API và câu SQL chỉ đọc để đối chiếu.
