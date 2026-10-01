# Hướng dẫn triển khai kiểm duyệt report theo case

> Người soạn: Tung's code (tài liệu hướng dẫn áp dụng thủ công), 2026-09-30.
> Phạm vi: report post, report comment và cách hiển thị hàng đợi kiểm duyệt. Không triển khai phân quyền theo lịch.
> Trạng thái: chỉ là tài liệu và mã mẫu; chưa chép vào source, chưa cập nhật Neon, chưa chạy test.

## 1. Hợp đồng schema phải có trước khi dùng mã

Bảng report_case có case_id BIGINT PK, target_type report_target_type_enum, target_id BIGINT, status report_status_enum mặc định pending, created_at TIMESTAMPTZ, handled_by BIGINT FK account, handled_at TIMESTAMPTZ, resolution_note VARCHAR(255). Bảng report có case_id BIGINT NOT NULL FK report_case. Cần:

~~~sql
CREATE UNIQUE INDEX uq_report_case_pending_target
ON report_case (target_type, target_id)
WHERE status = 'pending';

CREATE UNIQUE INDEX uq_report_case_reporter
ON report (case_id, reporter_id);

CREATE INDEX idx_report_case_latest
ON report (case_id, created_at DESC, report_id DESC);
~~~

Ràng buộc thứ hai có thể không tạo được nếu dữ liệu cũ chứa cùng reporter nhiều lần trong một case pending. Kiểm tra dữ liệu trước khi tạo index. Backend phải bảo đảm report.target_type/target_id khớp case tương ứng; nếu muốn DB tự bảo đảm, thêm unique key bộ ba trên report_case và composite FK từ report.

Report cũ đang pending cùng target_type + target_id được backfill vào một case. Report đã xử lý được backfill mỗi report một case. Migration chỉ chuyển dữ liệu, không chạy lại hành động gỡ, không gửi thông báo hoặc ghi log mới.

## 2. Quy tắc nghiệp vụ cố định

| Tình huống | Kết quả |
|---|---|
| Report đầu tiên cho post/comment đang hiển thị | Mở case pending và tạo report thuộc case |
| Người khác report cùng đối tượng khi case pending | Thêm report vào case cũ; case vẫn một dòng trên trang Admin |
| Cùng người report lại trong cùng case | HTTP 409; không tạo thêm report |
| Case bị từ chối, đối tượng vẫn công khai và có report mới | Mở case mới, kể cả cùng người từng report ở case cũ |
| Case được chấp nhận | Toàn bộ report của case accepted; post/comment bị gỡ theo quy tắc dưới |
| Case bị từ chối | Toàn bộ report rejected; comment giữ nguyên; post reported có thể về public |
| Hai Admin quyết định cùng case | Một giao dịch thành công, giao dịch còn lại HTTP 409 |
| Đối tượng bị xóa vật lý trước lúc xử lý | Không cho chấp nhận gỡ; cho từ chối để đóng case |

Không tự báo cáo nội dung của mình. Chỉ nhận report comment public thuộc post public/reported; report post chỉ cho post public/reported. Comment đang pending report vẫn hiển thị vì report chưa phải kết luận. Khi chấp nhận comment: chỉ chuyển từ public/hidden sang deleted; chỉ giảm post.comment_count nếu trạng thái trước đó là public. Comment đã deleted không bị giảm lại. Khi từ chối: không đổi comment. Với post, giữ quy tắc cũ: accept chuyển deleted; reject chỉ đổi reported về public khi bài đã xuất bản và không còn quyết định chặn.

Case và mọi report của case có cùng status, handled_by, handled_at, resolution_note sau khi đóng. Case là đơn vị quyết định; từng report vẫn là đơn vị ghi nhận người báo cáo và gửi kết quả.

## 3. Luồng API

| API | Dữ liệu/trách nhiệm |
|---|---|
| POST /api/posts/:id/report | Member gửi report post; response có report id và caseId |
| POST /api/posts/comments/:id/report | Member gửi report comment; response có report id và caseId |
| GET /api/admin/moderation/cases?targetType=post | Admin lấy một dòng/case post |
| GET /api/admin/moderation/cases?targetType=comment | Admin lấy một dòng/case comment |
| GET /api/admin/moderation/cases/:caseId | Case, toàn bộ report, target post/comment, post cha |
| PATCH /api/admin/moderation/cases/:caseId | Body action accept/reject, note 1–255 ký tự |

Ba API cases cần requireAuth + requireAdmin trên server. ID lấy từ URL, admin ID lấy từ req.account; không tin admin ID do client gửi. GET list trả {items,page,pageSize,totalItems,totalPages}. Một item cần tối thiểu: id, targetType, targetId, status, reportCount, createdAt, latestReportAt, targetLabel, postTitle, authorName. Detail trả {case,reports,post,comment}; mảng reports xếp mới nhất trước.

Giữ tab key report cho report post vì AdminDashboardPage.jsx đang liên kết ?type=report. Tab thứ ba dùng comment-report. Endpoint report theo reportId cũ phải được ngừng dùng khi client chuyển sang caseId; không để PATCH cũ tiếp tục quyết định một report đơn lẻ.

## 4. Thứ tự áp dụng thủ công theo file

1. Hoàn tất schema/migration ở chat DB; đối chiếu chính xác tên cột và index trong mục 1.
2. Viết hàm tạo/tìm case pending trong server/src/models/reportCase.model.js. Đây là file mới thuộc phần kiểm duyệt.
3. Tích hợp hàm đó vào server/src/models/post.model.js trước INSERT report. **Đây là code của Khôi: phải hỏi ý kiến trước khi thay câu INSERT hiện tại.** Đánh dấu Tung's code cho phần tích hợp. Nếu schema dùng report.case_id NOT NULL, chỉ thêm code sau INSERT sẽ không chạy được.
4. Đổi logic report theo case trong server/src/models/postModeration.model.js; controller và routes cùng module. Các file này thuộc phần kiểm duyệt của Tùng.
5. Đổi client/src/services/postModeration.service.js và trang AdminModerationPage.jsx/chi tiết cục bộ của trang. Không cần thay client/src/App.jsx hoặc AdminSidebar.jsx.
6. Không sửa AdminDashboardPage.jsx/admin.model.js trong lượt này: dashboard vẫn đếm report riêng lẻ. Nếu muốn dashboard đếm case, đây là thay đổi code chung cần chốt và hỏi trước.

### 4.1. Hàm tìm/mở case pending

Đặt tại server/src/models/reportCase.model.js:

~~~js
// Tung's code: Một case pending cho mỗi đối tượng bị báo cáo.
async function getOrCreatePendingCase(client, targetType, targetId) {
  const { rows } = await client.query(
    "INSERT INTO report_case (target_type, target_id) " +
    "VALUES ($1::report_target_type_enum, $2) " +
    "ON CONFLICT (target_type, target_id) WHERE status = 'pending' " +
    "DO UPDATE SET target_id = EXCLUDED.target_id " +
    "RETURNING case_id::text AS id",
    [targetType, targetId],
  );
  return rows[0].id;
}

module.exports = { getOrCreatePendingCase };
~~~

Unique partial index là điều kiện bắt buộc để ON CONFLICT ở trên hợp lệ. Câu UPDATE trong ON CONFLICT không đổi nghiệp vụ; nó lấy khóa cùng case khi hai request đến đồng thời.

### 4.2. Điểm tích hợp gửi report của Member

Trong hàm createReport của server/src/models/post.model.js: giữ kiểm tra target và tự report; lấy case trước khi INSERT, sau đó INSERT thêm case_id. Vì đây là thay câu SQL cũ của Khôi, chỉ áp dụng sau khi được đồng ý. Mẫu thay riêng khối INSERT:

~~~js
// Tung's code: Gắn mỗi report vào case pending của post/comment.
const caseId = await getOrCreatePendingCase(client, targetType, targetId);
const { rows } = await client.query(
  "INSERT INTO report (case_id, reporter_id, target_type, target_id, reason_code, reason_text) " +
  "VALUES ($1, $2, $3::report_target_type_enum, $4, $5::report_reason_code_enum, $6) " +
  "RETURNING report_id::text AS id",
  [caseId, reporterId, targetType, targetId, reasonCode, reasonText],
);
if (targetType === 'post') {
  await client.query(
    "UPDATE post SET status = 'reported', updated_at = now() " +
    "WHERE post_id = $1 AND status = 'public'",
    [targetId],
  );
}
return { ...rows[0], caseId };
~~~

Mẫu trên thay đúng khối INSERT/UPDATE/return cũ, không chạy thêm câu UPDATE post lần thứ hai. Thêm import getOrCreatePendingCase ở đầu file. Nên khóa dòng comment khi nhận report (FOR UPDATE OF c) để nó không được xử lý đồng thời với quyết định gỡ comment; đây cũng là thay đổi code của Khôi phải xin ý kiến. Duplicate trong cùng case trả 409; unique index (case_id, reporter_id) là lớp chặn cuối cùng nếu hai request đồng thời. Nếu PostgreSQL trả lỗi unique_violation cho index này, map thành HTTP 409 thay vì 500.

### 4.3. List một dòng/case, report mới nhất lên đầu

Trong model kiểm duyệt, count trên report_case, không count trên report. Lấy report mới nhất bằng LATERAL; không suy ra thời gian từ report_id:

~~~sql
SELECT rc.case_id::text AS id,
       rc.target_type AS "targetType",
       rc.target_id::text AS "targetId",
       rc.status,
       rc.created_at AS "createdAt",
       latest.created_at AS "latestReportAt",
       counts.report_count AS "reportCount",
       CASE WHEN rc.target_type = 'post'
         THEN COALESCE(p.title, 'Bài viết không còn tồn tại')
         ELSE COALESCE(LEFT(cm.content, 160), 'Bình luận không còn tồn tại')
       END AS "targetLabel",
       parent.title AS "postTitle",
       COALESCE(post_author.full_name, post_author.email,
                comment_author.full_name, comment_author.email) AS "authorName"
FROM report_case rc
JOIN LATERAL (
  SELECT r.created_at, r.report_id
  FROM report r
  WHERE r.case_id = rc.case_id
  ORDER BY r.created_at DESC, r.report_id DESC
  LIMIT 1
) latest ON true
JOIN LATERAL (
  SELECT count(*)::int AS report_count
  FROM report r
  WHERE r.case_id = rc.case_id
) counts ON true
LEFT JOIN post p
  ON rc.target_type = 'post' AND p.post_id = rc.target_id
LEFT JOIN account post_author ON post_author.account_id = p.account_id
LEFT JOIN comment cm
  ON rc.target_type = 'comment' AND cm.comment_id = rc.target_id
LEFT JOIN account comment_author ON comment_author.account_id = cm.author_id
LEFT JOIN post parent ON parent.post_id = cm.post_id
WHERE rc.target_type = $1::report_target_type_enum
  AND ($2::text = 'all' OR rc.status::text = $2)
  AND ($3::boolean = false OR
       (rc.status = 'pending' AND rc.created_at < now() - interval '48 hours'))
  AND ($4::text = 'all' OR rc.target_type = 'comment'
       OR p.post_type::text = $4)
  AND ($5::text = '' OR p.title ILIKE $5 OR cm.content ILIKE $5
       OR parent.title ILIKE $5
       OR EXISTS (
         SELECT 1 FROM report rr
         JOIN account reporter ON reporter.account_id = rr.reporter_id
         WHERE rr.case_id = rc.case_id
           AND (reporter.full_name ILIKE $5 OR reporter.email ILIKE $5)
       ))
ORDER BY latest.created_at DESC, latest.report_id DESC, rc.case_id DESC
LIMIT $6 OFFSET $7;
~~~

Tham số $4 là postType, $5 là pattern tìm kiếm đã escape ký tự wildcard rồi bọc bằng %. Với tab comment, $4='all'. Cùng điều kiện WHERE phải dùng trong SELECT count(*) trên report_case để totalItems/totalPages chính xác. Áp dụng ORDER BY trước LIMIT/OFFSET. Trường chờ quá 48 giờ dựa vào rc.created_at, không dựa latestReportAt; report mới không làm case cũ trẻ lại.

### 4.4. Detail và quyết định case

Detail đọc case theo caseId, đọc mọi report có cùng case_id với JOIN account reporter, xếp created_at DESC, report_id DESC; đọc post hoặc comment cùng post cha. Không lấy một report đại diện làm toàn bộ case. Nếu target đã mất, vẫn trả case/reports để Admin có thể từ chối và đóng case.

Quyết định chạy một transaction theo thứ tự cố định:

1. Đọc target_type/target_id của case theo caseId. Khóa target post/comment trước. Sau đó SELECT report_case FOR UPDATE và kiểm tra status còn pending; nếu đã đóng trả 409.
2. Đọc/khóa các report của case. Nếu accept mà target mất, trả 404/409; reject vẫn có thể đóng.
3. UPDATE report_case và UPDATE report cùng status, handled_by, handled_at, resolution_note. Dùng cùng một mốc thời gian lấy từ DB cho cả hai bảng.
4. Nếu accept post public/reported: đổi post sang deleted một lần, ghi audit target post, gửi post_removed cho tác giả. Nếu post đã deleted: không gỡ/gửi lại. Nếu reject post reported: chỉ về public theo quy tắc chặn cũ.
5. Nếu accept comment public/hidden: đổi comment sang deleted; chỉ khi trạng thái trước là public mới giảm post.comment_count một lần. Ghi audit target comment, gửi comment_removed cho tác giả khi vừa chuyển trạng thái. Nếu comment đã deleted: không giảm/gửi lại. Reject giữ nguyên comment.
6. Với từng report thuộc case, ghi audit theo target_type=report và target_id=report_id (enum admin_log hiện chưa có report_case); gửi một report_result tới reporter, ref_type=report, ref_id=report_id. Commit sau cùng. Lỗi ở bất cứ bước nào thì rollback toàn bộ.

Các câu UPDATE lõi:

~~~sql
UPDATE report_case
SET status = $1::report_status_enum,
    handled_by = $2, handled_at = $3,
    resolution_note = $4
WHERE case_id = $5 AND status = 'pending'
RETURNING case_id;

UPDATE report
SET status = $1::report_status_enum,
    handled_by = $2, handled_at = $3,
    resolution_note = $4
WHERE case_id = $5 AND status = 'pending'
RETURNING report_id, reporter_id;

UPDATE comment
SET status = 'deleted', updated_at = now()
WHERE comment_id = $1 AND status IN ('public', 'hidden')
RETURNING post_id, author_id, status;
~~~

Phải giữ trạng thái comment **trước** UPDATE để quyết định có giảm count hay không. Dùng GREATEST(comment_count - 1, 0) khi giảm; kiểm tra lại counter với dữ liệu seed vì DB hiện không có trigger tự đồng bộ. Case status là nguồn quyết định; không dùng PATCH theo reportId cũ sau khi đổi API.

### 4.5. Controller, route, service

Trong server/src/routes/postModeration.routes.js, thêm route cases trước route có tham số động; router đã gắn requireAuth/requireAdmin:

~~~js
// Tung's code: Duyệt theo case cho report post và comment.
router.get('/cases', controller.listCases);
router.get('/cases/:caseId', controller.getCase);
router.patch('/cases/:caseId', controller.decideCase);
~~~

Controller dùng parseId(caseId), validate targetType chỉ post/comment, dùng parseDecision(body,'report') và actor(req). Trường hợp case đã đóng trả 409. Có thể thêm các handler sau vào server/src/controllers/postModeration.controller.js và export chúng:

~~~js
// Tung's code: Case thay cho report_id trong luồng kiểm duyệt.
function parseTargetType(value) {
  if (value !== 'post' && value !== 'comment') {
    throw new ModerationError(400, 'Loại đối tượng báo cáo không hợp lệ.');
  }
  return value;
}

const listCases = handle((req) => model.listCases({
  ...parseListQuery(req.query, 'report'),
  targetType: parseTargetType(req.query.targetType),
}));
const getCase = handle((req) => model.getCase(parseId(req.params.caseId)));
const decideCase = handle((req) => model.decideCase(
  parseId(req.params.caseId), parseDecision(req.body, 'report'), actor(req),
));
~~~

Trong object trả về của createPostModerationModel, export thêm listCases, getCase, decideCase. Service client cần gửi targetType:

~~~js
// Tung's code: Case là đơn vị của danh sách, chi tiết và quyết định.
function caseListPath(filters) {
  const query = new URLSearchParams({
    targetType: filters.targetType,
    status: filters.status,
    search: filters.search || '',
    page: String(filters.page),
    limit: String(filters.limit || 20),
    stale: filters.stale ? '1' : '0',
  });
  if (filters.targetType === 'post') query.set('postType', filters.postType);
  return ROOT + '/cases?' + query;
}

~~~

Thêm ba field sau vào object postModerationService đang có:

~~~js
listCases: (filters, signal) => apiFetch(caseListPath(filters), { signal }),
getCase: (id, signal) => apiFetch(ROOT + '/cases/' + encodeURIComponent(id), { signal }),
decideCase: (id, action, note) => decide('cases', id, action, note),
~~~

Không dùng listReports/getReport/decideReport cũ trong UI mới.

## 5. Hướng dẫn giao diện Admin

Không tạo route/page mới. Trang client/src/pages/AdminModerationPage.jsx vẫn nằm ở /admin/moderation. Chỉnh riêng code của Tùng; không sửa shared Tabs/DataTable/AdminLayout:

~~~jsx
const TABS = [
  { key: 'post', label: 'Duyệt bài viết', icon: 'journal-text' },
  { key: 'report', label: 'Báo cáo bài viết', icon: 'flag' },
  { key: 'comment-report', label: 'Báo cáo bình luận', icon: 'chat-left-text' },
];

function readTab(params) {
  const type = params.get('type');
  return ['post', 'report', 'comment-report'].includes(type) ? type : 'post';
}
~~~

- Trong readLocation() hiện có, dùng readTab(params) thay điều kiện chỉ nhận report; thay các nhánh chọn danh sách/chi tiết/quyết định bằng caseId cho hai tab report:

~~~jsx
const targetType = query.tab === 'comment-report' ? 'comment' : 'post';
const isCaseTab = query.tab !== 'post';
const fetchList = isCaseTab
  ? (filters, signal) => postModerationService.listCases(
      { ...filters, targetType }, signal)
  : postModerationService.listPosts;
const fetchDetail = selected?.entity === 'case'
  ? postModerationService.getCase
  : postModerationService.getPost;
const saveDecision = decision?.entity === 'case'
  ? postModerationService.decideCase
  : postModerationService.decidePost;
~~~

Các biểu thức trên đặt ở đúng effect/handler tương ứng, không đặt thành một block ngoài component vì query/selected/decision là state. Khi mở dòng report, lưu selected={entity:'case',id:row.id,targetType}; canDecide dựa detail.case.status === 'pending'. Cập nhật message của ConfirmDialog theo targetType.

- Tab post giữ API duyệt bài cũ. Hai tab report gọi listCases với targetType tương ứng; item.id là caseId. GET detail và PATCH luôn dùng caseId.
- Bảng case có: đối tượng bị báo cáo, số report, trạng thái case, ngày report gần nhất, tuổi chờ từ case.createdAt, nút xem chi tiết. Không hiển thị một reporter/lý do đơn lẻ như thể đại diện toàn case.
- Ở tab comment, hiển thị đoạn comment, tác giả, tên bài cha; ẩn bộ lọc Loại bài. Chi tiết hiển thị toàn bộ comment và post cha, cùng danh sách reporter/lý do. Nội dung user render bằng JSX text thông thường, không dùng HTML thô.
- Tab report post giữ type=report để link dashboard còn hoạt động. Label quyết định phải đúng loại: gỡ bài với post, xóa bình luận với comment.
- Nút chấp nhận chỉ bật khi target còn tồn tại và trạng thái cho phép; nút từ chối vẫn dùng được để đóng case target đã mất. Sau PATCH thành công tải lại danh sách; 409 khi Admin khác xử lý thì tải lại detail/list.
- CSS mới nếu cần đặt ở AdminModerationPage.module.css; component chi tiết chỉ dùng ở trang này có thể đặt cạnh AdminModerationDetails.jsx theo mẫu hiện có. Nếu tạo page mới, comment đầu file phải ghi người code, chức năng và luồng trang.

## 6. Giới hạn lượt tài liệu

- Không sửa source hoặc schema trong lượt này; các đoạn mã là hướng dẫn để áp dụng thủ công.
- Không chạy test. Thứ tự và kết quả test thủ công ở docs/report-case-manual-test.md.
- Nếu schema mới chưa có report.case_id, index hoặc enum đúng tên, áp dụng code ngay sẽ lỗi; đối chiếu schema trước.
- File database-seed/seed_pending_post_reports.sql hiện đang INSERT report không có case_id. Khi schema đặt case_id NOT NULL, người làm seed phải cập nhật file này hoặc thay bằng seed mới có report_case trước; tài liệu này không sửa seed.
