# Hồ sơ sức khỏe cá nhân — ghi nhận triển khai Sprint 2

Tài liệu này mô tả trạng thái hiện tại của tab Hồ sơ sức khỏe sau khi bỏ luồng consent và bỏ bảng `health_consent_event` khỏi schema khởi tạo. Các chỉ số chỉ mang tính tham khảo, không thay thế tư vấn y tế.

## 1. Phạm vi hiện tại

Tab Hồ sơ sức khỏe nằm trong User Profile và cho Member:

- Xem, tạo và cập nhật thông tin sức khỏe của chính tài khoản.
- Nhập giới tính dùng cho công thức năng lượng, ngày sinh, chiều cao, cân nặng, mức vận động, mục tiêu và dị ứng/thực phẩm cần kiêng.
- Xem trước BMI, TDEE và mức năng lượng mục tiêu.
- Nhận cảnh báo trước khi lưu nếu ngày sinh xác định người dùng dưới 18 tuổi.

Giao diện bố trí hai khối cạnh nhau trên màn hình rộng và xếp dọc trên màn hình nhỏ:

- **Thông tin cơ bản:** các trường giới tính dùng cho công thức, ngày sinh, chiều cao và cân nặng được trình bày theo hàng nhãn/ô nhập. Bên dưới là mức vận động, mục tiêu và dị ứng/kiêng. Mức vận động có mô tả ngắn kèm ví dụ để người không chuyên chọn gần đúng.
- **Chỉ số sức khỏe ước tính:** hiển thị riêng BMI, BMR, TDEE và mục tiêu năng lượng cùng giá trị hiện tại hoặc lý do chưa tính được. Cạnh các kết quả là phần giải thích thuật ngữ bằng ngôn ngữ phổ thông; nhấn mạnh đây là ước tính, không phải chẩn đoán hay chỉ định ăn uống.

Đã bỏ checkbox consent, trạng thái consent, thao tác rút consent/xóa hồ sơ theo consent, các endpoint consent, việc ẩn hồ sơ legacy vì thiếu consent, và DDL bảng `health_consent_event` khỏi schema khởi tạo.

Chưa triển khai lọc món ăn theo dị ứng/kiêng hoặc gợi ý món cá nhân hóa. Danh sách dị ứng hiện là văn bản tự do.

## 2. Cấu trúc dữ liệu

### `profile`

Một tài khoản có tối đa một profile theo unique constraint trên `account_id`. Các cột được dùng:

- `profile_id`: khóa chính.
- `account_id`: tài khoản sở hữu hồ sơ.
- `gender`: `male`, `female`, `other`.
- `date_of_birth`: ngày sinh.
- `height_cm`, `weight_kg`: chiều cao và cân nặng hiện tại.
- `bmi`, `bmi_category`: BMI và nhóm do backend tính.
- `activity_level`: `sedentary`, `light`, `moderate`, `active`.
- `health_goal`: `lose_weight`, `gain_muscle`, `maintain`.
- `tdee_kcal`, `target_calories_kcal`: chỉ số năng lượng do backend tính.
- `created_at`, `updated_at`: thời điểm tạo và cập nhật.

Các cột sức khỏe trên đã có trong baseline ERD v4.2 đã chọn. Không thêm cột consent vào `profile`.

### `allergy`

Lưu từng tên dị ứng/thực phẩm cần kiêng thành một hàng riêng:

- `allergy_id`: khóa chính.
- `profile_id`: profile sở hữu mục dị ứng.
- `name`: tên dị ứng/kiêng, tối đa 120 ký tự.

Backend chuẩn hóa Unicode/khoảng trắng, loại mục trùng và giới hạn tối đa 50 mục trong một lần lưu.

### Bảng consent

Không còn bảng consent trong schema khởi tạo mới. Cụ thể, DDL `public.health_consent_event` và index `health_consent_event_account_idx` đã được gỡ khỏi `server_template/db/schema.sql`.

Nếu bảng từng được tạo trong database đang chạy, sửa file schema không tự xóa bảng đó. Script xóa riêng là `server_template/db/drop-health-consent-event.sql`; script này xóa bảng và toàn bộ lịch sử consent, chỉ chạy sau khi đã xác nhận muốn loại bỏ dữ liệu đó.

## 3. Quy tắc tính toán

Backend là nguồn chính thức để tính và lưu chỉ số; client chỉ hiển thị preview.

### Tuổi và BMI

- Tuổi tính theo ngày sinh đầy đủ và ngày hiện tại. Ngày sinh thiếu/không hợp lệ không bị đổi thành tuổi 0.
- `BMI = cân nặng (kg) / chiều cao (m)^2`, làm tròn một chữ số thập phân.
- Không tính BMI nếu thiếu dữ liệu hoặc số đo không dương/không hữu hạn.
- Phân nhóm: `<18.5 underweight`, `<25 normal`, `<30 overweight`, còn lại `obese`.
- Các ngưỡng BMI này là tham khảo cho người lớn; không phải chẩn đoán và có thể không phù hợp cho trẻ vị thành niên.

### Năng lượng

Khi đủ tuổi, chiều cao, cân nặng và lựa chọn công thức hỗ trợ, backend dùng Mifflin–St Jeor:

- Male: `BMR = 10 × kg + 6.25 × cm − 5 × tuổi + 5`.
- Female: `BMR = 10 × kg + 6.25 × cm − 5 × tuổi − 161`.
- `other`: không tự gán công thức nam/nữ và không lấy trung bình; BMI vẫn tính được nếu đủ dữ liệu nhưng BMR/TDEE/mục tiêu năng lượng để trống.

Hệ số hoạt động: `sedentary=1.2`, `light=1.375`, `moderate=1.55`, `active=1.725`.

Mục tiêu: giảm cân = TDEE × 0.85; duy trì = TDEE; tăng cơ = TDEE + 200 kcal. TDEE làm tròn kcal nguyên; mục tiêu làm tròn đến bội số 10 kcal gần nhất. Các quy tắc này chưa được chuyên gia y tế/dinh dưỡng xác nhận.

### Người dưới 18 tuổi

UI hiện cảnh báo:

> Bạn chưa đủ 18 tuổi , công thức năng lượng và chỉ số BMI có thể bị áp dụng sai cho trẻ vị thành niên . Thông tin chỉ mang tính tham khảo !

Người dùng phải xác nhận cảnh báo trước khi lưu. Backend kiểm tra `ageWarningAccepted: true` khi ngày sinh cho thấy người dùng chưa đủ 18. Xác nhận chỉ cho phép tiếp tục theo quyết định hiện tại; không đồng nghĩa công thức đã phù hợp cho trẻ vị thành niên.

## 4. API hiện tại

Router được mount tại `/api/users`; các endpoint sức khỏe yêu cầu xác thực và quyền Member.

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/api/users/me/health-profile` | Đọc profile và danh sách allergy của tài khoản hiện tại. |
| `PUT` | `/api/users/me/health-profile` | Kiểm tra đầu vào, tự tính chỉ số và lưu profile/allergy. |

Không còn endpoint `POST /api/users/me/health-profile/consent` hoặc `DELETE /api/users/me/health-profile/consent`.

## 5. Luồng lưu hiện tại

1. Client gọi GET để tải hồ sơ hiện có; backend không kiểm tra consent.
2. Người dùng nhập/chỉnh sửa thông tin.
3. Với người dưới 18, client yêu cầu xác nhận cảnh báo và gửi `ageWarningAccepted`; backend tự xác định tuổi và từ chối nếu thiếu xác nhận.
4. Backend kiểm tra enum, ngày sinh, số đo và danh sách allergy; sau đó tự tính các chỉ số.
5. Model dùng transaction để upsert `profile`, thay danh sách allergy bằng payload mới và trả dữ liệu đã lưu.

Việc bỏ consent đồng nghĩa ứng dụng không còn ghi nhận đồng ý/rút đồng ý, không khóa hồ sơ cũ theo trạng thái consent và không còn nút rút consent để xóa hồ sơ. Hiện hồ sơ được truy cập qua API sau khi xác thực và kiểm tra quyền Member.

## 6. Files liên quan

- [UserProfilePage.jsx](../client/src/pages/UserProfilePage.jsx) — tab sức khỏe, form, preview và cảnh báo tuổi.
- [user.service.js](../client/src/services/user.service.js) — gọi API tải/lưu hồ sơ.
- [health.js](../client/src/utils/health.js) — tính chỉ số preview phía client.
- [health-profile.model.js](../server/src/models/health-profile.model.js) — đọc/lưu profile và allergy.
- [user.controller.js](../server/src/controllers/user.controller.js) — validation, tính toán và xử lý API.
- [user.routes.js](../server/src/routes/user.routes.js) — route sức khỏe, xác thực và quyền Member.
- [schema.sql](../server_template/db/schema.sql) — schema khởi tạo các bảng/kiểu sức khỏe; không còn DDL consent.
- [drop-health-consent-event.sql](../server_template/db/drop-health-consent-event.sql) — script xóa bảng consent khỏi database đã có bảng đó.

## 7. Kiểm thử và việc còn lại

Các kiểm tra đã có trước khi gỡ consent gồm test tính BMI/tuổi, giới tính `other`, validation cảnh báo tuổi, lint/build và kiểm tra parity công thức. Sau thay đổi gỡ consent cần chạy lại test backend liên quan, client lint/build và kiểm tra không còn tham chiếu consent trong code.

Các phần cần nghiệm thu tiếp:

- Chạy end-to-end bằng tài khoản Member thật.
- Xác nhận chính sách lưu/xóa hồ sơ sức khỏe độc lập với consent.
- Xác nhận trước khi chạy script drop bảng nếu database hiện hữu đang chứa lịch sử consent cần giữ lại.
- Thiết kế mapping dị ứng với nguyên liệu trước khi thực hiện lọc món.
- Rà soát công thức và cách hiển thị với chuyên gia phù hợp.
