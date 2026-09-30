// Tung's code: Chi tiết dùng riêng trong AdminModerationPage, nhận dữ liệu API
// qua props. Case hiển thị toàn bộ report; comment đi cùng bài cha để có ngữ cảnh.
// Nội dung người dùng luôn render bằng JSX text, không đưa vào HTML thô.
import {
  Avatar, Chip, DataTable, Notice, Panel, Photo, YouTubeEmbed,
} from '../components';
import { REPORT_REASON } from '../constants/domain';
import { PostModerationStatus, ReportModerationStatus } from './postModerationPresentation';
import styles from './AdminModerationPage.module.css';

function dateLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN');
}

const POST_ACTION_LABELS = {
  APPROVE: 'Duyệt bài', REJECT: 'Từ chối bài', REMOVE: 'Gỡ bài',
  RESTORE: 'Kết thúc trạng thái có báo cáo', DELETE: 'Xóa bài', REVIEW: 'Xem xét bài',
  UPDATE: 'Cập nhật bài', HIDE: 'Ẩn bài',
};
const REPORT_ACTION_LABELS = {
  ACCEPT: 'Chấp nhận báo cáo', REJECT: 'Từ chối báo cáo',
  REVIEW: 'Xem xét báo cáo', UPDATE: 'Cập nhật báo cáo',
};

const historyColumns = (labels) => [
  { key: 'action', header: 'Thao tác', primary: true, render: row => labels[row.action] || row.action },
  { key: 'adminName', header: 'Admin', render: row => row.adminName || row.adminEmail },
  { key: 'reason', header: 'Lý do', render: row => row.reason || '—' },
  { key: 'createdAt', header: 'Thời điểm', render: row => dateLabel(row.createdAt) },
];
const POST_HISTORY_COLUMNS = historyColumns(POST_ACTION_LABELS);
const REPORT_HISTORY_COLUMNS = historyColumns(REPORT_ACTION_LABELS);

// Tung's code: Danh sách mọi người gửi trong case; không dùng report mới nhất
// làm đại diện lý do của cả nhóm. Backend đã xếp mới nhất trước.
const CASE_REPORT_COLUMNS = [
  { key: 'id', header: 'Mã report', render: row => `#${row.id}`, width: 100 },
  { key: 'reporterName', header: 'Người báo cáo', primary: true, render: row => row.reporterName || row.reporterEmail || `Tài khoản #${row.reporterId}` },
  { key: 'reasonCode', header: 'Lý do', render: row => REPORT_REASON[row.reasonCode] || row.reasonCode },
  { key: 'reasonText', header: 'Mô tả', render: row => <div className={styles.content}>{row.reasonText || 'Không có mô tả thêm.'}</div> },
  { key: 'createdAt', header: 'Ngày gửi', render: row => dateLabel(row.createdAt) },
];
const CASE_HISTORY_COLUMNS = [
  { key: 'reportId', header: 'Mã report', render: row => `#${row.reportId}`, width: 100 },
  ...REPORT_HISTORY_COLUMNS,
];
const COMMENT_HISTORY_COLUMNS = historyColumns({ REMOVE: 'Xóa bình luận', HIDE: 'Ẩn bình luận', DELETE: 'Xóa bình luận', UPDATE: 'Cập nhật bình luận' });

export default function AdminModerationDetails({ post, reportCase, reports = [], comment }) {
  return (
    <div className={styles.details}>
      {/* Tung's code: Quyết định/người xử lý lấy từ case, không từ một report bất kỳ. */}
      {reportCase && (
        <Panel title={`Nhóm báo cáo #${reportCase.id}`} icon="flag">
          <dl className={styles.facts}>
            <dt>Đối tượng</dt><dd>{reportCase.targetType === 'comment' ? 'Bình luận' : 'Bài viết'} #{reportCase.targetId}</dd>
            <dt>Số báo cáo</dt><dd>{reportCase.reportCount}</dd>
            <dt>Mở nhóm lúc</dt><dd>{dateLabel(reportCase.createdAt)}</dd>
            <dt>Báo cáo gần nhất</dt><dd>{dateLabel(reports[0]?.createdAt)}</dd>
            <dt>Trạng thái nhóm</dt><dd><ReportModerationStatus status={reportCase.status} targetType={reportCase.targetType} /></dd>
            {reportCase.handledAt && <><dt>Đã xử lý</dt><dd>{reportCase.handlerName || reportCase.handlerEmail || 'Admin'} · {dateLabel(reportCase.handledAt)}</dd></>}
            {reportCase.resolutionNote && <><dt>Kết quả</dt><dd className={styles.content}>{reportCase.resolutionNote}</dd></>}
          </dl>
        </Panel>
      )}

      {reportCase && <Panel title={`Các báo cáo trong nhóm · ${reports.length}`} icon="people" flush>
        <DataTable columns={CASE_REPORT_COLUMNS} rows={reports} caption="Tất cả người báo cáo và lý do, mới nhất trước"
          empty={{ title: 'Nhóm chưa có báo cáo' }} />
      </Panel>}

      {/* Tung's code: Comment là đối tượng cần xử lý; bài cha bên dưới chỉ cung
          cấp ngữ cảnh. Chấp nhận case này không gỡ bài cha. */}
      {reportCase?.targetType === 'comment' && comment && <>
        <Panel title={`Bình luận #${comment.id}`} icon="chat-left-text">
          <dl className={styles.facts}>
            <dt>Tác giả</dt><dd>{comment.authorName || comment.authorEmail || `Tài khoản #${comment.authorId}`}</dd>
            <dt>Trạng thái</dt><dd>{{ public: 'Công khai', hidden: 'Đang ẩn', deleted: 'Đã xóa' }[comment.status] || comment.status}</dd>
            <dt>Ngày gửi</dt><dd>{dateLabel(comment.createdAt)}</dd>
            <dt>Bài viết chứa bình luận</dt><dd>{post?.title || `Bài #${comment.postId} không còn tồn tại`}</dd>
          </dl>
          <div className={`${styles.content} mt-3`}>{comment.content}</div>
        </Panel>
        <Panel title="Nhật ký thao tác trên bình luận" icon="clock-history" flush>
          <DataTable columns={COMMENT_HISTORY_COLUMNS} rows={comment.history || []}
            caption="20 thao tác quản trị gần nhất của bình luận" empty={{ title: 'Chưa có thao tác quản trị' }} />
        </Panel>
        {!post && <Notice tone="info" title="Bài viết chứa bình luận không còn tồn tại">Thông tin bình luận và các báo cáo vẫn được giữ để xử lý.</Notice>}
      </>}

      {post && <>
      {reportCase?.targetType === 'comment' && <h2 className={styles.postTitle}>Bài viết chứa bình luận</h2>}
      <h3 className={styles.postTitle}>{post.title}</h3>
      <div className={styles.metadata}>
        <Avatar name={post.authorName || post.authorEmail} src={post.authorAvatarUrl} size={32} />
        <span>{post.authorName || post.authorEmail}</span>
        <Chip icon={post.postType === 'video' ? 'play-btn' : 'journal-text'}>
          {post.postType === 'video' ? 'Video' : 'Blog'}
        </Chip>
        <PostModerationStatus status={post.status} />
      </div>

      {/* Tung's code: Bỏ hai khối thông báo trạng thái và lý do xử lý bài viết
          theo yêu cầu rút gọn giao diện. Lý do của case và nhật ký vẫn hiển thị
          tại phần tương ứng; dữ liệu moderationNote trong DB không bị thay đổi. */}
      <dl className={styles.facts}>
        <dt>Mã bài</dt><dd>#{post.id}</dd>
        <dt>Ngày gửi</dt><dd>{dateLabel(post.createdAt)}</dd>
        <dt>Xuất bản</dt><dd>{dateLabel(post.publishedAt)}</dd>
        <dt>Cập nhật</dt><dd>{dateLabel(post.updatedAt)}</dd>
        {post.moderatedAt && <><dt>Người xử lý gần nhất</dt><dd>{post.moderatorName || post.moderatorEmail || 'Admin'} · {dateLabel(post.moderatedAt)}</dd></>}
        {post.deletedAt && <><dt>Đã xóa</dt><dd>{dateLabel(post.deletedAt)}</dd></>}
      </dl>
      {post.categories?.length > 0 && (
        <div className={styles.categories} aria-label="Danh mục bài viết">
          {post.categories.map(category => <Chip key={category.id}>{category.name}</Chip>)}
        </div>
      )}
      {post.postType === 'video'
        ? <YouTubeEmbed key={post.id} url={post.youtubeUrl} title={post.title} className={styles.preview} />
        : post.thumbnailUrl && <Photo src={post.thumbnailUrl} alt={`Ảnh bài ${post.title}`} ratio="16/9" shape="rounded" className={styles.preview} />}
      <Panel title={post.postType === 'video' ? 'Mô tả video' : 'Nội dung bài viết'} icon="journal-text">
        {/* React escape nội dung người dùng; không render HTML chưa được xử lý. */}
        <div className={styles.content}>{post.content || 'Không có nội dung thêm.'}</div>
      </Panel>
      {post.reportCounts?.length > 0 && (
        <div className={styles.metadata} aria-label="Báo cáo của bài viết">
          {post.reportCounts.map(item => (
            <span key={item.status}>
              <ReportModerationStatus status={item.status} /> <b>{item.count}</b>
            </span>
          ))}
        </div>
      )}
      <Panel title="Nhật ký thao tác trên bài viết" icon="clock-history" flush>
        <p className="px-3 pt-3 mb-2 text-muted">
          Ghi người thực hiện và thời điểm duyệt, từ chối hoặc gỡ bài này. Mỗi dòng là một thao tác
          ở một thời điểm, không phải danh sách người cùng duyệt bài.
        </p>
        <DataTable columns={POST_HISTORY_COLUMNS} rows={post.history || []}
          caption="20 thao tác quản trị gần nhất của bài viết"
          empty={{ title: 'Chưa có thao tác quản trị' }} />
      </Panel>
      </>}
      {reportCase && (
        <Panel title="Nhật ký xử lý các báo cáo trong nhóm" icon="clock-history" flush>
          <p className="px-3 pt-3 mb-2 text-muted">
            Một quyết định áp dụng cho cả nhóm và được ghi nhận trên từng báo cáo.
            Thao tác gỡ bài hoặc xóa bình luận được ghi riêng trên nội dung tương ứng.
          </p>
          <DataTable columns={CASE_HISTORY_COLUMNS} rows={reportCase.history || []}
            caption="100 thao tác quản trị gần nhất trên các báo cáo trong nhóm"
            empty={{ title: 'Nhóm báo cáo chưa được xử lý' }} />
        </Panel>
      )}
    </div>
  );
}
