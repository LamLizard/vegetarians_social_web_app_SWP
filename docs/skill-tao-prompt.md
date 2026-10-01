# Skill: Tạo prompt giao việc cho AI — dự án Vegetarian Social (SWP391)

> Dùng khi người dùng nhờ: "tạo prompt để làm X", "viết prompt giao việc...".
> Khi chạy skill này, bạn (AI) sẽ ĐỌC repo hiện tại rồi xuất ra MỘT prompt hoàn chỉnh — dán vào chat mới là thực thi được ngay.

## 1. Trước khi viết prompt — thu thập ngữ cảnh (bắt buộc)
- Đọc file liên quan tới việc sắp làm (đúng đường dẫn THẬT, không đoán tên file/hàm): file sẽ sửa, file lân cận, service/API liên quan.
- Đối chiếu quy ước: docs/skill-ai-gen-code.md (đặt tên, vị trí file) · docs/skill-ui-kit.md (chọn component) · docs/quy-uoc-dat-ten.md.
- Việc chạm BE: nêu rõ endpoint/model/controller hiện có (hoặc xác nhận chưa có) + cột DB liên quan.
- Mơ hồ chỗ nào → hỏi lại người dùng TỐI ĐA 3 CÂU ngắn trước khi viết.

## 2. Khung prompt chuẩn — 6 phần, đúng thứ tự
1) TIÊU ĐỀ — 1 dòng, động từ rõ ("Thêm phân trang...", "Sửa lỗi đăng nhập lần đầu...").
2) ĐỌC TRƯỚC — danh sách #file: cụ thể (file liên quan + skill dự án) + mục "KHÔNG đụng:" liệt kê file/thư mục cấm.
3) VIỆC CẦN LÀM — đánh số từng mục; mỗi mục: file đích → thay đổi cụ thể → tiêu chí hoàn thành.
4) RÀNG BUỘC — không cài package mới (trừ khi cho phép rõ); không sửa ngoài phạm vi; giữ quy ước; text tiếng Việt; gặp đụng độ thì DỪNG báo lại.
5) KIỂM TRA — lệnh chạy cụ thể (npm run build / script / curl) + kịch bản kiểm tay từng bước.
6) FORMAT TRẢ LỜI — 📁 Vị trí file → 📋 Bảng "file nào sửa gì" → 💻 Code đầy đủ → ✅ Checklist tự kiểm.

## 3. Nguyên tắc viết
- Mệnh lệnh, ngắn, rõ. Cấm mô tả cảm tính: "làm đẹp hơn" ❌ → "đổi layout 2 cột, màu lấy từ token var(--ac-*)..." ✔