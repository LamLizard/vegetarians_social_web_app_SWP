# Tùng — Sprint 2: SQL migration Shop qua Neon Editor, 07/10/2026

Bộ này nâng cấp **DB đang có dữ liệu** cho Shop Register / Verify / Management. Tùng tự chạy SQL; agent chỉ đã đọc metadata và dữ liệu liên quan trong transaction READ ONLY. Các SQL bên dưới **chưa được thực thi hoặc kiểm thử**. Không dùng schema/seed/reset `04_10` để nâng cấp DB hiện có.

## Chạy theo thứ tự

Trong Neon SQL Editor, chọn branch và database cần nâng cấp. Mỗi bước copy **toàn bộ nội dung một file**, gồm BEGIN/COMMIT, vào editor rồi Run; chờ bước đó hoàn tất trước bước tiếp theo. Không chạy riêng một đoạn giữa file migration.

| Bước | File | Cách đọc kết quả |
|---|---|---|
| 1 | [SWP_PostgreSQL_07_10_shop_preflight.sql](SWP_PostgreSQL_07_10_shop_preflight.sql) | Chỉ SELECT. Mọi dòng `BLOCKER` phải có `issue_count=0`. `INFO` pending không chặn migration; cần bước 3 để quán cũ vào queue mới. |
| 2 | [SWP_PostgreSQL_07_10_shop_migration.sql](SWP_PostgreSQL_07_10_shop_migration.sql) | Chạy một lần. Phải hoàn tất COMMIT, không có lỗi. Tự kiểm tra lại dữ liệu dưới lock trước khi ALTER/backfill. |
| 3 | [SWP_PostgreSQL_07_10_shop_recapture_pending.sql](SWP_PostgreSQL_07_10_shop_recapture_pending.sql) | Bước riêng nếu muốn đưa quán pending cũ `shop_id=4`, **Bếp Hạt Và Rau**, owner `10`, vào hàng chờ duyệt. Tạo hồ sơ tại thời điểm chạy và notification cho Admin. Có history rồi thì bỏ qua, không tạo trùng. |
| 4 | [SWP_PostgreSQL_07_10_shop_verify.sql](SWP_PostgreSQL_07_10_shop_verify.sql) | Chỉ SELECT để Tùng tự kiểm tra. Mọi `installed=true`, các `issue_count=0`; lịch đủ `7 × số quán`. |

Nếu không chạy bước 3, Shop 4 vẫn pending nhưng **chưa xuất hiện trong queue hồ sơ mới**. Đây là trạng thái dữ liệu cần xử lý trước khi nghiệm thu Verify cho quán cũ. Script bước 3 có guard exact Shop/owner/name và trạng thái; không áp tự động cho các pending mới hoặc database khác.

Nếu bước 2/3 báo lỗi, dừng chuỗi. Nếu editor còn session báo `current transaction is aborted`, chạy riêng:

```sql
-- Tùng — Sprint 2: kết thúc transaction lỗi chưa COMMIT.
ROLLBACK;
```

`ROLLBACK` chỉ kết thúc transaction chưa commit; không đảo lại migration đã commit. Script migration không hỗ trợ chạy lại sau thành công: nó báo schema đã có để tránh ghi đè. Muốn xác định đã cài đủ thì chạy bước 4; không xóa bảng/cột/trigger để chạy lại. Lỗi lock timeout nghĩa chưa lấy được lock trong 10 giây; chạy lại sau khi transaction khác đã kết thúc. Không tự kill session từ script.

## Các thay đổi SQL

| Đối tượng | Thay đổi |
|---|---|
| `shop_schedule` | Bảng mới: `shop_id`, `day_of_week`, `is_closed`, `open_time`, `close_time`. PK Shop/ngày, ngày 1=T2..7=CN; giờ theo phút trong cùng ngày, ngày nghỉ NULL giờ; deferred triggers bắt đủ 7 ngày và ít nhất 1 ngày mở. |
| `shop_submission` | Bảng mới 11 cột: `shop_submission_id`, `shop_id`, `submission_type`, `before_value`, `after_value`, `status`, `submitted_by`, `submitted_at`, `reviewed_by`, `reviewed_at`, `review_note`. Immutable snapshots/history, mỗi Shop một pending và một lần chuyển terminal. |
| `shop` | `row_version BIGINT NOT NULL DEFAULT 1`, CHECK dương, trigger tăng khi UPDATE. Giữ status/verification/owner và các cột lịch cũ. |
| `shop_dish` | `row_version`; price NOT NULL, số nguyên VNĐ ≥0, không NaN; UNIQUE Shop/Dish; trigger giữ keys và tăng version. Giá 0 hợp lệ. |
| `notification` | `metadata JSONB` nullable, nếu có phải là object. Thêm enum `shop_identity_edit_pending`, `shop_identity_edit_accepted`, `shop_identity_edit_rejected`. |

Giữ các trigger `updated_at` hiện có. Backfill lịch chạy trước trigger mới để không cập nhật `shop.updated_at` và để version quán cũ bắt đầu từ `1`. Version là token concurrency, không phải số lần người dùng đã chỉnh sửa.

Enum mới chỉ được sử dụng sau COMMIT; migration không INSERT notification có enum mới trong cùng transaction. Đây là giới hạn của [PostgreSQL ALTER TYPE](https://www.postgresql.org/docs/current/sql-altertype.html).

Không tạo role Owner, không đổi operating/verification enum, không seed lại Account/Dish/Shop/menu, không ghi AdminLog, không xóa bảng hoặc dữ liệu hiện có. Triggers storage không thay thế kiểm tra session/role của backend và không tự áp dụng quyết định review lên Shop.

## Dữ liệu hiện tại và backfill

Snapshot đọc ngày 07/10/2026 13:40 giờ Việt Nam: 5 quán, 20 menu links, 131 notifications. Không thấy giá NULL/âm/lẻ/NaN hoặc link trùng. Lịch có đúng 4 `T2-CN` và 1 `T2-T7`, giờ theo phút và cùng ngày:

- `T2-CN`: mở đủ 7 ngày theo giờ chung hiện có.
- `T2-T7`: mở T2..T7 theo giờ chung; CN nghỉ, giờ NULL.

Dự kiến backfill 35 dòng lịch. Không đoán encoding khác, không điền giờ mặc định; nếu dữ liệu đã thay đổi thì SQL kiểm tra lại và dừng khi không chuyển được.

Migration chính để `shop_submission` rỗng. Quán verified/rejected cũ giữ nguyên trạng thái và không được tạo lịch sử giả. Bước recapture Shop 4 chụp **bản hiện tại** thành `registration/pending`, `before_value=NULL`, `submitted_by=owner_account_id`; `submitted_at` lấy `clock_timestamp()` lúc chạy. Attribution owner phục vụ contract hồ sơ, không khẳng định owner vừa thao tác trên UI. Notification có `metadata.source=legacy_pending_recapture_2026_10_07` để nhận diện nguồn chuyển đổi. Không lùi timestamp về ngày tạo Shop, không tạo accepted/rejected history.

## Tự kiểm tra sau import

File bước 4 kiểm tra metadata/constraints/indexes/triggers và SELECT dữ liệu; không thay đổi DB. Đối chiếu số Shop/menu trước và sau; nếu chưa có hoạt động mới thì vẫn 5/20. Sau bước 2: 35 dòng lịch, 0 hồ sơ. Sau bước 3: 1 hồ sơ pending Shop 4, notification tăng theo số Admin; Shop status/verification/giá/menu không đổi. Danh sách pending thiếu hồ sơ phải rỗng sau recapture nếu không có pending mới phát sinh.

Kết quả SQL kiểm tra cấu trúc không chứng minh workflow API/UI đã pass. Các module hiện còn cần nối mounts/routes và navigation trong cầu riêng BRIDGE-01/02; public Search/Info Shop của Lâm đọc lịch canonical theo BRIDGE-03. Agent chưa chạy test/lint/build hoặc bộ verify này.
