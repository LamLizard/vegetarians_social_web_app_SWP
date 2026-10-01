# Hướng dẫn test thủ công kiểm duyệt report theo case

> Người soạn: Tung's code (tài liệu test), 2026-09-30.
> Tài liệu để người dùng tự chạy sau khi áp dụng schema và source; chưa có bài test nào được chạy trong lượt tạo tài liệu.

## 1. Chuẩn bị

- Neon đang dùng đúng branch/schema mới có report_case và report.case_id; source đã áp dụng theo docs/report-case-implementation-guide.md.
- Có ít nhất ba tài khoản Member: A và B làm người báo cáo, C là tác giả post/comment. Có hai phiên Admin riêng để thử xung đột.
- Có post P public của C, comment K public của C dưới P, và thêm một post/comment công khai khác để thử phân trang, lọc và mở case mới.
- Ghi lại trước khi thử: post_id, comment_id, post.comment_count, account_id của A/B/C, và report_case_id mới tạo. Không dùng dữ liệu thật khó hoàn tác.
- Các thao tác ghi dữ liệu trong checklist dưới đây là thao tác test bạn chủ động thực hiện; các câu SQL ở mục 4 chỉ đọc.

## 2. Checklist từng chức năng

| Mã | Thao tác thủ công | Kết quả cần thấy |
|---|---|---|
| T01 | Member A báo cáo post P; Member B báo cáo lại P với lý do khác | Một case pending cho P, hai report riêng, post chuyển reported nhưng vẫn xuất hiện trên feed; Admin tab Báo cáo bài viết chỉ một dòng, reportCount=2 |
| T02 | A báo cáo P lần nữa khi case còn pending | HTTP 409/thông báo đã báo cáo; số report và case không tăng |
| T03 | C thử báo cáo post/comment do C viết | Bị từ chối; không tạo report hoặc case |
| T04 | A rồi B báo cáo comment K | Một case pending cho K, hai lý do riêng; comment vẫn public, post.comment_count chưa đổi; tab Báo cáo bình luận hiển thị một dòng |
| T05 | Mở chi tiết case post/comment | Xem đủ mọi reporter, lý do, nội dung, thời gian; report mới nhất ở đầu danh sách; chi tiết comment có bài cha và tác giả |
| T06 | Tạo nhiều case hơn một trang, rồi thêm report mới vào case cũ | Case cũ vừa nhận report lên đầu trang 1; không tăng số case; các case không trùng hoặc mất giữa trang 1/2 |
| T07 | Lọc pending/accepted/rejected/all, tìm kiếm và lọc quá 48 giờ | Số dòng là số case; điều kiện lọc đúng; tuổi chờ dựa case.created_at, thêm report mới không đặt lại tuổi case |
| T08 | Admin từ chối case comment K, nhập lý do | Case và mọi report rejected cùng người/thời gian/lý do; comment còn public, comment_count không đổi; A/B mỗi người nhận một kết quả |
| T09 | Sau T08, A báo cáo lại K | Tạo case mới với ID mới; case cũ còn lịch sử, không mở lại; A được gửi vì đây là case khác |
| T10 | Admin chấp nhận case comment mới | Comment chuyển deleted, biến khỏi danh sách bình luận công khai; post.comment_count giảm đúng 1; C nhận một comment_removed, mỗi reporter trong case nhận một report_result |
| T11 | Thử quyết định lại case ở T10 hoặc gửi report mới vào K đã deleted | Quyết định lại trả 409, không giảm count/gửi thông báo thêm; report mới không được tạo |
| T12 | Admin từ chối case post P | Case/reports rejected; nếu P chỉ ở reported do case này và không có quyết định chặn khác, P về public và còn trên feed |
| T13 | Tạo case post mới trên P rồi Admin chấp nhận | Post chuyển deleted, không còn trên feed; tất cả report cùng case accepted; tác giả nhận một post_removed, mỗi reporter nhận một report_result |
| T14 | Hai Admin cùng mở một case pending và bấm hai quyết định khác nhau gần như đồng thời | Chỉ một quyết định được lưu; Admin còn lại thấy 409/tải lại; trạng thái case và mọi report thống nhất, không có tác động gỡ/counter/thông báo trùng |
| T15 | Gửi report mới đúng lúc Admin đóng case | Report hoặc thuộc case cũ và nhận cùng quyết định, hoặc thuộc case mới nếu target vẫn công khai; không có report thiếu case hoặc case pending trùng target |
| T16 | Member/khách thử gọi API Admin; thử ID, action, note sai | Khách 401, Member 403, dữ liệu sai 400; không đổi dữ liệu |
| T17 | Mở /admin/moderation?type=report từ dashboard và đổi sang tab comment | Link cũ vẫn mở Báo cáo bài viết; tab comment mở đúng danh sách, không có bộ lọc Loại bài |
| T18 | Case đã pending nhưng target bị xóa vật lý/mất trước lúc Admin xử lý | Chi tiết vẫn xem được report; không cho chấp nhận gỡ target không tồn tại; có thể từ chối để đóng case |

Với comment đã hidden hoặc deleted do luồng khác trước khi quyết định: chấp nhận case được phép đóng ở accepted nhưng không giảm counter/gửi thông báo gỡ thêm khi comment đã deleted; từ chối không đổi comment. Hãy đối chiếu chính sách thực tế trong source trước T18 nếu nhóm quyết định khác đi.

## 3. Kiểm tra kết quả ngay sau thao tác

Sau mỗi lần chấp nhận/từ chối, xem đồng thời:

1. UI: dòng case đổi trạng thái, nút quyết định biến mất, lý do xử lý và người xử lý hiện đúng.
2. DB: report_case và mọi report có cùng status, handled_by, handled_at, resolution_note.
3. Target: post/comment chỉ bị gỡ theo quyết định chấp nhận; comment_count giảm đúng một lần khi comment từ public sang deleted.
4. Notification: mỗi reporter đúng một report_result tham chiếu report_id của họ; tác giả đúng một post_removed/comment_removed khi target vừa bị gỡ.
5. Audit: quyết định trên từng report dùng target_type=report; thao tác gỡ target dùng target_type=post/comment. Không ghi trùng khi gọi lại PATCH.

Dashboard hiện có thể vẫn đếm **số report** ở card/hàng đợi cũ, trong khi trang kiểm duyệt đếm **số case**. Đây là giới hạn ngoài phạm vi sửa source lần này; không coi hai số khác nhau là lỗi dữ liệu.

## 4. SQL chỉ đọc để đối chiếu

Chạy trên đúng Neon branch đang test. Các truy vấn dưới đây không thay dữ liệu.

**Không có hai case pending cho cùng target:**

~~~sql
SELECT target_type, target_id, count(*) AS pending_cases
FROM report_case
WHERE status = 'pending'
GROUP BY target_type, target_id
HAVING count(*) > 1;
~~~

Kết quả mong đợi: 0 dòng.

**Report không lạc case, không lệch target hoặc trạng thái:**

~~~sql
SELECT r.report_id, r.case_id, r.target_type, r.target_id, r.status
FROM report r
LEFT JOIN report_case c ON c.case_id = r.case_id
WHERE c.case_id IS NULL
   OR r.target_type <> c.target_type
   OR r.target_id <> c.target_id
   OR r.status <> c.status;
~~~

Kết quả mong đợi: 0 dòng.

**Không có reporter trùng trong cùng case:**

~~~sql
SELECT case_id, reporter_id, count(*) AS times_reported
FROM report
GROUP BY case_id, reporter_id
HAVING count(*) > 1;
~~~

Kết quả mong đợi: 0 dòng.

**Thứ tự đúng theo report mới nhất:**

~~~sql
SELECT c.case_id, c.target_type, c.target_id, c.status,
       counts.report_count,
       latest.created_at AS latest_report_at,
       latest.report_id AS latest_report_id
FROM report_case c
JOIN LATERAL (
  SELECT count(*) AS report_count FROM report r
  WHERE r.case_id = c.case_id
) counts ON true
JOIN LATERAL (
  SELECT r.created_at, r.report_id
  FROM report r WHERE r.case_id = c.case_id
  ORDER BY r.created_at DESC, r.report_id DESC LIMIT 1
) latest ON true
ORDER BY latest.created_at DESC, latest.report_id DESC, c.case_id DESC
LIMIT 20;
~~~

Lọc thêm c.target_type='post' hoặc 'comment' khi so với từng tab. Nếu hai report cùng timestamp, report_id mới nhất dùng để phá hòa.

**Xem case vừa xử lý, mọi report và notification của reporter:**

~~~sql
SELECT c.case_id, c.status AS case_status, c.handled_by, c.handled_at,
       c.resolution_note, r.report_id, r.reporter_id,
       r.status AS report_status, r.handled_at AS report_handled_at,
       count(n.notification_id) FILTER (WHERE n.type = 'report_result') AS result_notifications
FROM report_case c
JOIN report r ON r.case_id = c.case_id
LEFT JOIN notification n
  ON n.ref_type = 'report' AND n.ref_id = r.report_id
 AND n.account_id = r.reporter_id
WHERE c.case_id = :case_id
GROUP BY c.case_id, r.report_id
ORDER BY r.created_at DESC, r.report_id DESC;
~~~

Thay :case_id bằng ID số trước khi chạy. Với fixture mới, mỗi report đã xử lý cần đúng một result_notifications. Dữ liệu cũ có thể đã có notification trước đó nên phải so mốc trước/sau khi test.

**Counter của post so với số comment public:**

~~~sql
SELECT p.post_id, p.comment_count,
       count(c.comment_id) FILTER (WHERE c.status = 'public') AS public_comments
FROM post p
LEFT JOIN comment c ON c.post_id = p.post_id
GROUP BY p.post_id
HAVING p.comment_count <> count(c.comment_id)
  FILTER (WHERE c.status = 'public');
~~~

Ghi nhận sai lệch nền trước T10; chỉ quy lỗi cho tính năng nếu sai lệch xuất hiện mới sau quyết định.

## 5. Khi test lỗi, ghi lại

Ghi URL/tab, case_id, target_type + target_id, account đang đăng nhập, thao tác, thời gian, HTTP status/thông báo, ảnh màn hình và kết quả các truy vấn chỉ đọc ở mục 4. Không chép token, DATABASE_URL hoặc mật khẩu vào biên bản.
