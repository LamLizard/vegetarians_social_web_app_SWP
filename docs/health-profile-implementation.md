# Hồ sơ sức khỏe cá nhân — ghi nhận triển khai Sprint 2

Tài liệu này tổng hợp quá trình hình thành và các thay đổi đã thực hiện cho tab **Hồ sơ sức khỏe** trong trang User Profile, từ lần triển khai ban đầu đến đợt hoàn thiện consent và bảo vệ dữ liệu gần nhất.

> Đây là hồ sơ ghi nhận trạng thái code/schema tại thời điểm viết tài liệu, không phải tư vấn y tế. Các chỉ số được ứng dụng tính chỉ mang tính tham khảo.

## 1. Mục tiêu và phạm vi

Tab Hồ sơ sức khỏe cho phép Member tự quản lý một hồ sơ riêng, gồm một số thông tin nhân khẩu học/sinh lý, chỉ số cơ thể, mục tiêu năng lượng và danh sách dị ứng hoặc thực phẩm cần kiêng.

Phạm vi đã triển khai:

- Tích hợp tab sức khỏe vào User Profile hiện có.
- Đọc, cập nhật và thu hồi consent xử lý dữ liệu sức khỏe.
- Lưu hồ sơ và danh sách dị ứng/kiêng vào PostgreSQL.
- Tính trước BMI, BMR, TDEE và mức năng lượng mục tiêu theo dữ liệu hiện có.
- Bảo vệ hồ sơ cũ chưa có consent bằng cách không trả nội dung cho client cho đến khi người dùng đồng ý.
- Yêu cầu xác nhận cảnh báo trước khi lưu hồ sơ của người dưới 18 tuổi.
- Bổ sung định nghĩa schema để môi trường mới có thể dựng các bảng/kiểu mà tính năng sử dụng.

Chưa thuộc phạm vi hoàn tất:

- Tự động loại món ăn hoặc nguyên liệu dựa trên danh sách dị ứng/kiêng.
- Tạo gợi ý món ăn cá nhân hóa từ hồ sơ sức khỏe.
- Xác nhận tính đúng đắn y khoa của công thức hoặc dùng công thức năng lượng cho trẻ vị thành niên.
- Kiểm thử end-to-end trên browser bằng tài khoản Member thật.

## 2. Tiến trình hình thành

### 2.1. Đưa Hồ sơ sức khỏe vào User Profile

Trong kế hoạch Sprint 2, User Profile được mở rộng từ hồ sơ tài khoản thành giao diện có hai tab:

1. **Thông tin tài khoản** — thông tin tài khoản hiện có.
2. **Hồ sơ sức khỏe** — dữ liệu sức khỏe riêng của Member.

Tab mới nằm trong trang hiện có; dữ liệu được tải/lưu qua service và API, không để component UI tự gọi trực tiếp `fetch`/`axios`.

### 2.2. Chốt quyết định nghiệp vụ

| Chủ đề | Quyết định được áp dụng |
|---|---|
| Consent | Cần có consent trước khi lưu/đọc hồ sơ sức khỏe qua ứng dụng; lưu lại phiên bản và nội dung chính sách đã đồng ý. |
| Dữ liệu có sẵn nhưng chưa có consent | Giữ dữ liệu nguyên trạng, không hiển thị nội dung cho ứng dụng cho đến khi chủ tài khoản đồng ý lại. Không tự xóa hoặc ghi nhận consent hồi tố. |
| Rút consent | Ghi sự kiện `withdrawn`, sau đó xóa hồ sơ và danh sách dị ứng/kiêng trong cùng transaction. |
| Giới tính `other` | Vẫn tính BMI nếu đủ chiều cao/cân nặng; không tự chọn công thức BMR nam/nữ và không lấy trung bình để suy đoán TDEE. |
| Người dưới 18 tuổi | Hiện cảnh báo; người dùng phải xác nhận mới được lưu. Xác nhận được kiểm tra cả ở backend. |
| Trường dữ liệu | Các trường là tùy chọn; thiếu dữ liệu cần thiết thì để chỉ số tương ứng trống, không tự điền giá trị mặc định. |

Thông báo cảnh báo tuổi được yêu cầu hiển thị:

> Bạn chưa đủ 18 tuổi , công thức năng lượng và chỉ số BMI có thể bị áp dụng sai cho trẻ vị thành niên . Thông tin chỉ mang tính tham khảo !

### 2.3. Đợt hoàn thiện gần nhất

Sau khi rà soát trạng thái ban đầu, đã xử lý các điểm sau:

- Phân biệt consent đã được ghi nhận trong DB với checkbox consent người dùng đang chọn nhưng chưa gửi.
- Thêm API riêng để ghi consent trước khi mở dữ liệu hồ sơ cũ.
- Chặn GET trả nội dung hồ sơ khi chưa có consent hợp lệ, đã rút consent hoặc phiên bản consent không còn hiện hành.
- Không ghi đè hồ sơ cũ khi người dùng cấp consent lần đầu hoặc đồng ý lại do đổi phiên bản; trả hồ sơ cũ để người dùng xem lại trước.
- Bắt buộc cờ xác nhận cảnh báo tuổi ở backend nếu ngày sinh cho thấy tuổi dưới 18.
- Sửa lỗi ngày sinh trống bị chuyển thành tuổi `0` trong phép tính preview phía client.
- Thêm regression tests cho dữ liệu thiếu, tuổi 0, giới tính `other` và số đo không hợp lệ.
- Bổ sung DDL các enum/bảng sức khỏe và bảng sự kiện consent vào schema khởi tạo.

## 3. Dữ liệu trong hồ sơ

### 3.1. Trường Profile

Các trường được dùng trong form/model:

- `gender`: `male`, `female`, `other`.
- `date_of_birth`: ngày sinh; có thể không nhập.
- `height_cm`: chiều cao cm; có thể không nhập.
- `weight_kg`: cân nặng kg; có thể không nhập.
- `bmi`, `bmi_category`: chỉ số và nhóm BMI được backend tính.
- `activity_level`: `sedentary`, `light`, `moderate`, `active`.
- `health_goal`: `lose_weight`, `gain_muscle`, `maintain`.
- `tdee_kcal`, `target_calories_kcal`: chỉ số năng lượng backend tính và lưu.
- `created_at`, `updated_at`: thời điểm tạo/cập nhật.

Một tài khoản có tối đa một bản ghi `profile` theo unique constraint trên `account_id`.

### 3.2. Dị ứng và thực phẩm cần kiêng

Danh sách được lưu thành nhiều hàng trong bảng `allergy`, gắn với `profile_id`. Giao diện nhận tối đa 50 mục; mỗi mục tối đa 120 ký tự. Backend chuẩn hóa Unicode/khoảng trắng và loại mục trùng không phân biệt hoa thường tiếng Việt.

Hiện các mục là văn bản tự do. Chúng được lưu và tải lại trong hồ sơ nhưng **chưa được dùng để lọc món ăn hoặc kiểm tra nguyên liệu**.

### 3.3. Sự kiện consent

Bảng `health_consent_event` lưu lịch sử cấp/rút consent:

- `event_id`: định danh sự kiện.
- `account_id`: tài khoản liên quan.
- `action`: `granted` hoặc `withdrawn`.
- `policy_version`: phiên bản chính sách.
- `policy_text`: nội dung consent được hiển thị.
- `occurred_at`: thời điểm sự kiện.

Trạng thái hiện hành được xác định từ sự kiện mới nhất theo `occurred_at`, sau đó dùng `event_id` để phân định nếu thời điểm trùng nhau. Consent hiện hành phải có `action = granted` và `policy_version` trùng phiên bản backend đang dùng (`health-profile-v1`).

## 4. Quy tắc tính chỉ số

Backend là nguồn chính thức để tính và lưu dữ liệu. Client tính preview để người dùng xem trước; các hệ số/công thức cần được giữ đồng bộ.

### 4.1. Tuổi

Tuổi được tính theo ngày sinh đầy đủ đến ngày hiện tại, có xét người dùng đã qua sinh nhật trong năm hay chưa. Ngày sinh trống hoặc không hợp lệ không được quy đổi thành tuổi 0.

### 4.2. BMI

`BMI = cân nặng (kg) / chiều cao (m)^2`

- Làm tròn một chữ số thập phân.
- Không tính nếu thiếu dữ liệu, số đo không hữu hạn hoặc chiều cao/cân nặng không dương.
- Phân nhóm hiện dùng:
  - `< 18.5`: `underweight`
  - `< 25`: `normal`
  - `< 30`: `overweight`
  - Còn lại: `obese`

Các ngưỡng này là phân loại tham khảo người lớn; không được diễn giải là chẩn đoán, đặc biệt với trẻ vị thành niên.

### 4.3. BMR, TDEE và mục tiêu năng lượng

Backend sử dụng công thức Mifflin–St Jeor khi có đủ tuổi, chiều cao, cân nặng và lựa chọn công thức hỗ trợ:

- Công thức male: `BMR = 10 × cân nặng + 6.25 × chiều cao − 5 × tuổi + 5`
- Công thức female: `BMR = 10 × cân nặng + 6.25 × chiều cao − 5 × tuổi − 161`

`other` không bị ánh xạ sang male/female; do đó BMR, TDEE và mục tiêu năng lượng để trống. BMI vẫn được tính độc lập nếu đủ dữ liệu.

TDEE được ước tính từ BMR nhân hệ số hoạt động:

| Mức hoạt động | Hệ số |
|---|---:|
| Ít vận động (`sedentary`) | 1.2 |
| Vận động nhẹ (`light`) | 1.375 |
| Vận động vừa (`moderate`) | 1.55 |
| Vận động cao (`active`) | 1.725 |

Điều chỉnh theo mục tiêu:

| Mục tiêu | Cách tính |
|---|---|
| Giảm cân (`lose_weight`) | TDEE × 0.85 (giảm 15%) |
| Duy trì (`maintain`) | Bằng TDEE |
| Tăng cơ (`gain_muscle`) | TDEE + 200 kcal |

TDEE được làm tròn đến kcal nguyên; mục tiêu năng lượng được làm tròn đến bội số 10 kcal gần nhất. Đây là các quy tắc đã được chọn để triển khai, **chưa được chuyên gia dinh dưỡng/y tế xác nhận**.

## 5. Luồng hoạt động và bảo vệ dữ liệu

### 5.1. Tải trang

1. Client tải hồ sơ tài khoản và gọi `GET /users/me/health-profile`.
2. Backend kiểm tra sự kiện consent mới nhất trước khi tải chi tiết `profile`/`allergy`.
3. Nếu consent đúng phiên bản hiện tại, backend trả trạng thái consent và hồ sơ.
4. Nếu chưa có consent hợp lệ, backend không trả nội dung hồ sơ; chỉ trả `hasUnconsentedProfile` để UI thông báo rằng có dữ liệu cũ đang được giữ kín.
5. Khi có dữ liệu cũ bị khóa, các trường form bị disable cho đến khi người dùng đồng ý.

### 5.2. Cấp consent và xem hồ sơ cũ

1. Người dùng chọn đồng ý với thông báo xử lý dữ liệu.
2. Client gọi `POST /users/me/health-profile/consent`.
3. Backend yêu cầu `consentAccepted: true`, ghi sự kiện `granted` nếu chưa có consent đúng phiên bản, rồi mới trả hồ sơ.
4. Việc cấp consent không tự sửa hoặc xóa dữ liệu cũ.
5. Nếu người dùng nhấn lưu khi consent cần được cấp lại và hồ sơ cũ đang tồn tại, model ghi nhận consent rồi trả `requiresReview` cùng dữ liệu cũ, không thực hiện upsert trong request đó.

### 5.3. Lưu hồ sơ

1. Client gửi dữ liệu form, `consentAccepted: true`, và `ageWarningAccepted: true` nếu cần xác nhận cảnh báo tuổi.
2. Backend xác thực enum, ngày sinh, số đo, danh sách dị ứng/kiêng, consent và xác nhận tuổi.
3. Backend tự tính BMI/BMR/TDEE/mục tiêu năng lượng; không tin các chỉ số do client gửi lên.
4. Model dùng một transaction để upsert `profile`, thay danh sách `allergy` bằng danh sách mới và trả hồ sơ đã lưu.
5. Nếu bất kỳ thao tác DB nào thất bại, transaction được rollback.

### 5.4. Rút consent

1. UI yêu cầu người dùng xác nhận thao tác thu hồi.
2. Client gọi `DELETE /users/me/health-profile/consent`.
3. Backend ghi sự kiện `withdrawn`, xóa các hàng `allergy` và `profile` của tài khoản trong cùng transaction.
4. Lịch sử sự kiện consent được giữ lại; hồ sơ sức khỏe và danh sách dị ứng/kiêng bị xóa theo nội dung consent đã thông báo.

### 5.5. Cảnh báo người dưới 18 tuổi

Ngày sinh được kiểm tra ở backend. Nếu tuổi tính được nhỏ hơn 18 mà payload không có `ageWarningAccepted: true`, API từ chối lưu với lỗi validation. Client chỉ ghi nhận xác nhận cho ngày sinh cụ thể; nếu ngày sinh thay đổi, cảnh báo cần được xác nhận lại.

Việc xác nhận chỉ cho phép tiếp tục theo quyết định nghiệp vụ hiện tại; **không biến công thức người lớn thành công thức phù hợp cho trẻ vị thành niên**. Chỉ số vẫn phải được xem là tham khảo.

## 6. API được thêm/đang dùng

Các endpoint nằm dưới router `/users`; route health yêu cầu đăng nhập và quyền Member.

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/api/users/me/health-profile` | Đọc trạng thái consent và hồ sơ nếu có quyền đọc hợp lệ. |
| `POST` | `/api/users/me/health-profile/consent` | Ghi nhận đồng ý hiện hành trước khi mở hồ sơ cũ. Body cần `{ "consentAccepted": true }`. |
| `PUT` | `/api/users/me/health-profile` | Validate, tính toán và lưu hồ sơ; cần `consentAccepted: true`; người dưới 18 cần thêm `ageWarningAccepted: true`. |
| `DELETE` | `/api/users/me/health-profile/consent` | Thu hồi consent, giữ sự kiện và xóa profile/allergy trong transaction. |

Các route được khai báo trong `server/src/routes/user.routes.js` và được mount dưới `/api/users` trong `server/app.js`; xử lý request/validation ở `server/src/controllers/user.controller.js`; persistence ở `server/src/models/health-profile.model.js`.

## 7. Thay đổi database và quan hệ với ERD

Baseline Sprint 2 được chọn là ERD v4.2 hiện có trong repository. Bảng `profile` và `allergy` là các thực thể sức khỏe đã có trong mô hình ứng dụng; schema khởi tạo trong repo trước đó chưa mô tả đầy đủ các kiểu/bảng mà model cần.

Thay đổi schema đã ghi nhận:

- Thêm/đảm bảo enum `profile_gender_enum`, `bmi_category_enum`, `activity_level_enum`, `health_goal_enum`.
- Thêm/đảm bảo bảng `profile`, khóa ngoại đến `account` và unique `account_id`.
- Thêm/đảm bảo bảng `allergy`, khóa ngoại đến `profile`.
- Bổ sung `health_consent_event` và index theo account/thời điểm để lưu lịch sử consent.

`health_consent_event` là phần mở rộng so với ERD v4.2 nhằm đáp ứng yêu cầu bằng chứng consent. Cần đưa thay đổi này vào ERD/tài liệu dữ liệu chính thức khi tổng kết Sprint 2.

Theo lần kiểm tra database đã được ghi nhận trước đó:

- Database hiện có `profile`/`allergy`; thiếu bảng lịch sử consent.
- Bảng `public.health_consent_event` và index `health_consent_event_account_idx` đã được tạo theo hướng additive.
- Không đọc nội dung hồ sơ sức khỏe trong lần kiểm tra metadata/đường đọc với account ID không tồn tại.
- Không xóa hoặc cập nhật bản ghi health cũ trong quá trình bổ sung schema.

> `server_template/db/schema.sql` là schema khởi tạo để dựng môi trường mới; cập nhật file này không tự áp dụng thay đổi lên các database đang chạy. Database hiện hữu cần được cập nhật bằng migration phù hợp trước khi dùng endpoint trên môi trường đó.

## 8. Các file liên quan

### Frontend

- [UserProfilePage.jsx](../client/src/pages/UserProfilePage.jsx) — hai tab tài khoản/sức khỏe, trạng thái consent, cảnh báo tuổi, form và chỉ số preview.
- [user.service.js](../client/src/services/user.service.js) — các hàm gọi API health profile, cấp consent, lưu và thu hồi consent.
- [health.js](../client/src/utils/health.js) — tính toán phía client để preview.
- [health.test.js](../client/src/utils/health.test.js) — regression tests phép tính và dữ liệu thiếu.

### Backend

- [user.routes.js](../server/src/routes/user.routes.js) — endpoint và middleware đăng nhập/quyền Member.
- [user.controller.js](../server/src/controllers/user.controller.js) — payload validation, cảnh báo tuổi và điều phối API.
- [health-profile.model.js](../server/src/models/health-profile.model.js) — transaction, consent gating, đọc/lưu/xóa profile và allergy.
- [health-profile.model.test.js](../server/src/models/health-profile.model.test.js) — test khóa/mở dữ liệu legacy và bảo toàn dữ liệu lúc cấp consent.
- [user.controller.test.js](../server/src/controllers/user.controller.test.js) — test controller, consent và xác nhận tuổi.
- [health.js](../server/src/utils/health.js) — phép tính phía server.

### Database

- [schema.sql](../server_template/db/schema.sql) — kiểu enum và DDL phục vụ dựng schema sức khỏe/consent.

## 9. Kiểm thử và trạng thái xác minh

Theo kết quả xác minh của đợt hoàn thiện gần nhất:

- Test backend tập trung cho controller/model liên quan: **12/12 đạt**.
- Test tính toán sức khỏe phía client: **5/5 đạt**.
- So sánh một số ca đại diện giữa client và server: **4 ca đạt**.
- `npm run lint`: đạt.
- `npm run build`: đạt; còn cảnh báo Sass `@import` deprecation không liên quan đến hồ sơ sức khỏe.
- Syntax checks backend và `git diff --check`: đạt.
- Chưa chạy browser end-to-end với tài khoản Member thật.
- Toàn bộ test suite backend có lỗi đã được ghi nhận ở test moderation không thuộc phạm vi health; lần này chỉ chạy test health/profile tập trung.

## 10. Giới hạn và việc còn cần làm

1. **Nghiệm thu giao diện/runtime:** chạy thử bằng tài khoản Member thật các luồng tải trang, tạo hồ sơ, refresh, consent lại hồ sơ legacy, xác nhận cảnh báo dưới 18 tuổi, rút consent và đăng nhập lại.
2. **Tích hợp dị ứng:** hiện lưu văn bản tự do; cần thiết kế mapping nguyên liệu/alias và quy tắc xử lý món có thành phần chưa xác định trước khi lọc món.
3. **Chính sách dữ liệu thiếu:** hiện có thể lưu hồ sơ mà nhiều hoặc toàn bộ trường tùy chọn đang để trống. Chưa có quyết định chặn hồ sơ rỗng.
4. **Audit cảnh báo tuổi:** xác nhận tuổi được kiểm tra trong request lưu nhưng chưa tạo event audit riêng.
5. **Công thức:** cần chuyên gia phù hợp rà soát hệ số, mức điều chỉnh mục tiêu, ngưỡng BMI và cách hiển thị, nhất là khi người dùng dưới 18 tuổi.
6. **Phiên bản consent:** khi nội dung/chính sách consent thay đổi đáng kể, tăng `HEALTH_CONSENT.version` để yêu cầu đồng ý lại; không thay nội dung nhưng giữ nguyên version nếu cần thu lại đồng ý.
7. **ERD:** cập nhật tài liệu ERD chính thức để thể hiện `health_consent_event`, các trường, quan hệ và chính sách lưu lịch sử.
8. **Schema/migration:** xác nhận script cập nhật schema cho từng môi trường và chạy thử schema bootstrap trên database mới sạch; không dùng schema khởi tạo để ghi đè database đang có dữ liệu.

## 11. Checklist nghiệm thu đề xuất

- [ ] Member mở User Profile và thấy hai tab đúng.
- [ ] Khi chưa có hồ sơ/consent, không có chỉ số năng lượng sai do trường trống.
- [ ] Tạo hồ sơ yêu cầu consent; dữ liệu được lưu và tải lại sau refresh.
- [ ] API không trả nội dung hồ sơ cũ trước consent.
- [ ] Cấp consent cho hồ sơ cũ chỉ mở dữ liệu xem lại, không ghi đè dữ liệu.
- [ ] Tài khoản dưới 18 tuổi thấy đúng cảnh báo; không thể lưu qua API nếu thiếu xác nhận.
- [ ] `other` vẫn tính BMI khi đủ dữ liệu nhưng không có BMR/TDEE/mục tiêu năng lượng.
- [ ] Mục dị ứng/kiêng được lưu lại và hiện đúng sau khi tải lại.
- [ ] Rút consent xóa `profile`/`allergy` nhưng giữ event `withdrawn`.
- [ ] Tài khoản không có quyền Member không truy cập được các API sức khỏe.
- [ ] Schema mới được dựng trên database thử nghiệm sạch; migration database hiện hữu không làm mất dữ liệu.
