# Shop reset + ảnh riêng + lịch nhiều ca — 07/10/2026

Tùng tự thực hiện trên **Neon SQL Editor**. Bộ này cập nhật DB đã có Shop migration 07/10 hoặc fresh schema Sprint 2 04/10; không tạo lại schema chung. Agent chỉ chuẩn bị file, chưa chạy Neon.

## Thay đổi và phạm vi reset

- `shop.avt_shop_url TEXT NOT NULL`, không rỗng, không default ảnh Account.
- Giữ `shop_schedule`, mỗi ca một row; thêm `slot_no SMALLINT > 0`, PK `(shop_id,day_of_week,slot_no)`.
- Đủ bảy ngày Mở/Nghỉ, ít nhất một ngày mở. Ngày nghỉ đúng một row slot1/NULL giờ; ngày mở một hoặc nhiều ca hợp lệ, không overlap, cho phép ca tiếp giáp.
- Update các schedule/submission guards và form snapshot validator; giữ immutable history/one pending/one terminal.
- Reset **shop/shop_dish/shop_schedule/shop_submission** và Shop-only Notification/AdminLog. Không seed lại.
- Account/auth/profile, catalog Dish, Post/Recipe/Health/report và các feature khác giữ nguyên; sequence IDs giữ nguyên. Asset Cloudinary giữ nguyên.

## Thứ tự chạy

1. Chọn đúng Neon branch/database. Dừng thao tác ghi từ app trong lúc chạy và giữ luồng đăng ký quán đóng tới khi BE/FE mới sẵn sàng. DB mới bắt buộc ảnh và slots; code cũ chưa tương thích.
2. Copy **toàn bộ** [preflight](SWP_PostgreSQL_07_10_shop_avatar_schedule_preflight.sql) vào SQL Editor rồi Run. Tất cả dòng `BLOCKER` phải có `issue_count=0`. Lưu counts `*_to_reset`/`*_to_clear` để đối chiếu; counts không bị hardcode theo demo.
3. Copy **toàn bộ** [reset + migration](SWP_PostgreSQL_07_10_shop_avatar_schedule_reset_migration.sql) rồi Run **một lần**. Script khóa sáu bảng, kiểm tra lại preconditions, snapshot dữ liệu ngoài scope/sequence, cleanup/reset, ALTER và verify trong một transaction.
4. Kết quả trước COMMIT phải có `revision=shop_avatar_schedule_v1`, `passed=true`, `removed_rows` phù hợp counts preflight và số nhóm bảo toàn/sequence đã kiểm chứng. Run thành công toàn file mới xác nhận COMMIT; nếu thấy lỗi COMMIT/serialization/timeout thì không coi dòng SELECT trước COMMIT là bằng chứng đã commit.
5. Copy toàn bộ [verify](SWP_PostgreSQL_07_10_shop_avatar_schedule_verify.sql) rồi Run **ngay sau migration, trước đăng ký mới**. Mọi `passed=true`; bốn counts Shop bằng 0. File này READ ONLY, JSON samples chỉ chạy SELECT, không feed test data.
6. Giữ output preflight/migration/verify để bàn giao tiếp bước BE/FE. Sau khi code/config mới sẵn sàng, Tùng đăng ký thủ công qua từng Account và tự test luồng upload/duyệt/lịch.

## Khi script báo lỗi

- Lỗi bất kỳ bước nào làm transaction không commit; chạy `ROLLBACK;` nếu SQL Editor giữ session đang aborted rồi dừng xử lý. Không chạy riêng phần cuối file để bỏ qua preconditions.
- Nếu đã có avatar/slot_no/helper function hoặc partial delta: script dừng **trước cleanup** để tránh reset lại dữ liệu mới. Chạy verify để xác định trạng thái; không xóa cột/function để ép chạy lại.
- FK/trigger/rule/RLS/partition/inheritance ngoài baseline gây BLOCKER. Gửi output schema/preflight để đối chiếu; không tự CASCADE hoặc tắt trigger.
- Lock timeout/statement timeout không phải lý do chạy phần reset riêng. Đọc nguyên lỗi, xử lý writer/busy state rồi chạy lại toàn file chỉ khi lần trước thực sự chưa commit.

Không chạy fresh reset toàn schema, seed hoặc recapture hồ sơ cũ của bộ 04/10/07/10 sau migration này.

## Contract BE/FE cần dùng sau migration

Schedule JSON có đúng bảy day objects theo thứ tự T2–CN:

```json
{"dayOfWeek":1,"isClosed":false,"slots":[{"openTime":"08:00","closeTime":"12:00"},{"openTime":"13:00","closeTime":"21:00"}]}
```

Ngày nghỉ có `isClosed:true,slots:[]`. BE sort ca và derive slot_no từ 1; không nhận slot_no từ client. DB rows có thể >7, BE nhóm về bảy ngày, không giữ `rows.length===7`.

Registration/resubmission snapshot chứa `{name,address,phone,avtShopUrl,schedule}`. Identity snapshots cho fields đổi trong `{name,address,phone,avtShopUrl}`, không chứa lịch/menu. Cloudinary upload/proof được BE kiểm chứng trước khi nhận URL; DB không thay upload API, ảnh verified chỉ đổi khi Admin accept.

## Kiểm chứng của agent

Đã qua **36/36 ca trên mỗi baseline** trong PostgreSQL cục bộ chạy trong bộ nhớ: fresh schema Sprint 2 04/10 và base schema đi qua migration Shop 07/10 đã bàn giao. Các ca gồm reset dữ liệu có sẵn, bảo toàn dữ liệu ngoài Shop/sequence, rollback toàn bộ data và DDL khi lỗi, chặn partial/replay/FK/RLS/trigger lạ, index pending sai cột và thiếu CHECK ngày 1–7; cùng avatar bắt buộc, nhiều ca/tiếp giáp/overlap, snapshot và lịch sử bất biến. Fixture local đều rollback, không feed vào database của Tùng.

Review độc lập đã hoàn tất, hai lỗi kiểm tra baseline đã sửa và kiểm chứng lại. Agent chưa kết nối hoặc chạy SQL trên Neon, chưa chạy app test/lint/build; quyền Neon và chạy đồng thời nhiều session chưa được kiểm chứng bằng môi trường local một connection. Kết quả SQL không thay thế tự test BE/FE/Cloudinary.
