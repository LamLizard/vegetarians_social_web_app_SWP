# PostgreSQL Sprint 2 — bộ local ngày 04/10/2026

Bộ SQL tạo **database mới trên schema trống**, đã kiểm tra bằng PostgreSQL nhúng PGlite 0.5.8 trong memory local. **Chưa triển khai lên Neon.** Chờ người phụ trách kiểm tra và duyệt trước khi chọn môi trường triển khai. Đây không phải migration cập nhật database đang có dữ liệu.

## Khác biệt với bộ đang dùng ngày 01/10

Folder không có file tạo schema mang tên 01/10. Bộ 01/10 có seed/verify 50 bài viết, dùng cấu trúc `SWP_PostgreSQL_30_09.sql`. So sánh schema mới với baseline đó:

| Phần | Baseline | Bản mới |
|---|---|---|
| Số bảng ứng dụng | 27 | 29; giữ 27 bảng, thêm hai bảng bên dưới |
| `shop_submission` | Chưa có | 11 cột, FK tới Shop và Account; registration/resubmission/identity_edit; pending/accepted/rejected; một pending/Shop; snapshot và lịch sử bất biến |
| `shop_schedule` | Một cặp giờ chung trong Shop | Bảy dòng/Shop, thứ 1–7 = T2–CN; mỗi ngày có giờ riêng hoặc nghỉ; ít nhất một ngày mở, đủ cặp, đóng > mở, không qua đêm |
| Phiên bản dữ liệu | Chỉ `updated_at` | `shop.row_version` và `shop_dish.row_version`; cập nhật lịch tăng version Shop, chống ghi đè bằng expectedVersion ở API |
| Menu | Giá nullable, chưa UNIQUE pair | Giá bắt buộc, nguyên VNĐ >=0, chặn NaN; UNIQUE Shop/Dish; không đổi Shop/Dish của dòng đã tạo |
| Notification | Ba loại xác minh Shop chung | Thêm metadata JSONB nullable và ba loại shop_identity_edit_pending/accepted/rejected, phân biệt yêu cầu sửa với trạng thái Shop |
| Hàm/trigger | 3 hàm, 11 trigger | Thêm 6 hàm và 6 trigger, giữ toàn bộ hàm/trigger cũ |
| Trạng thái Shop | Hoạt động và xác minh | Giữ hai enum/cột cũ; trạng thái hồ sơ nằm riêng, không có verified-lần2 |

Giữ cột giờ chung để tương thích cấu trúc cũ. `shop_schedule` là nguồn chuẩn cho consumer mới. Khi giờ khác nhau theo ngày, API phải trả lịch từng ngày; không lấy giờ chung để hiển thị sai. Không đổi cấu trúc nghiệp vụ Account/Post/Report/Recipe/MealPlan/Dish.

## File và thứ tự chạy trên DB demo trống

1. `SWP_PostgreSQL_04_10_sprint2.sql` — toàn bộ schema mới.
2. `SWP_PostgreSQL_04_10_sprint2_seed.sql` — base demo seed tái dùng, có bổ sung Shop.
3. `SWP_PostgreSQL_01_10_social_50_seed.sql` — dùng nguyên bản để thêm 50 bài viết.
4. `SWP_PostgreSQL_01_10_social_50_verify.sql` — dùng nguyên bản kiểm tra batch social.
5. `SWP_PostgreSQL_04_10_sprint2_verify.sql` — kiểm tra tổng dataset và storage Shop; tất cả `passed` phải true.

Chạy từng file đầy đủ, theo thứ tự, dừng ngay nếu có lỗi. Schema/base seed chỉ chạy trên DB trống; không rerun chúng để cập nhật DB đang có dữ liệu. Social seed có marker nên rerun là no-op.

`SWP_PostgreSQL_04_10_sprint2_reset.sql` là **reset phá dữ liệu demo**, chạy thủ công chỉ khi đã kiểm tra đúng target dùng một lần. Không có script tự gọi reset hoặc tự chọn Neon. Không dùng CASCADE; dependency ngoài phạm vi làm toàn bộ reset rollback.

## Phần seed được tái sử dụng

Base seed lấy từ local Git commit `c03a4069eb5639dfee9591164aa90086f45239e9`, path `database-seed/SWP_PostgreSQL_30_09_seed.sql`. Dataset cũ được giữ trong bản tên mới; không ghi đè file SQL cũ. Bản mới thay đổi:

- Sửa hai chỗ tính/kiểm tra comment_count để chỉ đếm bình luận public; dữ liệu bình luận bị ẩn vẫn giữ.
- Chuyển lịch của năm quán demo thành 35 dòng; chỉ dùng mapping đã biết T2-CN/T2-T7, không đoán encoding khác.
- Thêm hai hồ sơ demo mới tại thời điểm chạy seed: registration cho Bếp Hạt Và Rau, identity_edit đổi tên An Nhiên Vegan. Đây là fixtures hiện tại, không backdate hay dựng lại lịch sử thật. Quán verified/rejected cũ không bị thêm lịch sử accepted/rejected giả.
- Thêm tám thông báo cho bốn Admin của hai hồ sơ này. Menu 20 dòng, giá và availability cũ được giữ.

Hai file social ngày 01/10 giữ nguyên byte/hash. Sau hai seed có 58 accounts, 82 posts, 197 comments, 5 Shops, 20 menu rows, 35 schedule rows và 2 pending submissions. Các con số này chỉ áp dụng dataset demo.

## Contract cần dùng khi triển khai API

`shop_submission`: shop_submission_id, shop_id, submission_type, before_value, after_value, status, submitted_by, submitted_at, reviewed_by, reviewed_at, review_note. BIGINT ra JSON dạng string. Snapshot registration/resubmission có `{name,address,phone,schedule}`; schedule đủ bảy `{dayOfWeek,isClosed,openTime,closeTime}`, giờ HH:mm hoặc null ngày nghỉ. Identity snapshot chỉ các khóa thực sự đổi trong name/address/phone, trước/sau cùng tập khóa.

DB enforce shape, pending uniqueness, immutable snapshots và một outcome cuối. Backend còn phải xác thực Member owner/Admin, validate số Việt Nam và raw price nguyên trước SQL; lock Shop trước hồ sơ/lịch, kiểm tra expectedSubmissionId và expectedVersion, so identity hiện tại với before snapshot khi accept. Không dùng toàn bộ Shop version để reject identity chỉ vì owner vừa sửa lịch.

Submit/review phải transaction gồm Shop khi cần, hồ sơ, Notification và AdminLog. Identity pending/rejected giữ Shop verified; accept chỉ apply keys được gửi và giữ menu/lịch/metadata xác minh cũ. Registration/retry accept/reject mới cập nhật metadata xác minh Shop. DB trigger không tự apply patch hoặc tạo audit/notification thay API. AdminLog target Shop, action phân biệt loại hồ sơ; Notification ref Shop, metadata có submissionId dạng string/submissionType.

Menu public: Shop verified AND Dish active AND shop_dish.is_available=true. Owner vẫn giữ link tới Dish mất active. Món owner đề xuất pending không được link trước khi Duy duyệt; server kiểm tra điều kiện catalog trong transaction.

Giá vẫn NUMERIC(10,2), phạm vi tương thích cũ tới 99,999,999 VNĐ nguyên. PostgreSQL có thể làm tròn raw 0.001 trước CHECK, nên API bắt buộc kiểm tra raw integer. Giờ lưu TIME địa phương Asia/Ho_Chi_Minh, phút 00–59, không nhận 24:00/giây. No-delete menu là luật API Sprint 2; DB không cấm thao tác bảo trì được cấp quyền riêng.

## Kết quả và giới hạn kiểm tra

Ngày 04/10/2026: **56 kiểm tra hành vi + 188 boolean assertions của verifiers đều pass**. Dựng schema, cả hai seed, social rerun no-op, reject/retry giữ Shop/menu/history, identity accept/reject giữ lịch/menu, snapshot bất biến, một pending/outcome, constraints lịch/giá/UNIQUE/version, rollback audit/notification và reset/rebuild đều được kiểm tra local. Reset gặp dependency ngoài phạm vi đã từ chối và rollback.

PGlite là một session nhúng; chưa kiểm chứng cuộc đua hai PostgreSQL connections, auth/API thực tế, consumer đọc lịch mới hoặc hành vi Neon. Các integration đó là việc tiếp theo trước khi đưa feature vào sử dụng. Nếu sau này nâng DB hiện có, cần migration/preflight riêng cho menu lỗi/trùng, lịch encoding khác và Shop pending chưa có submission; không dùng bộ fresh này để suy ra lịch sử production.
