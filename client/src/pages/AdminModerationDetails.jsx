// Khối chi tiết chỉ dùng trong AdminModerationPage, nhận dữ liệu qua props.
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
  ACCEPT: 'Chấp nhận gỡ bài', REJECT: 'Từ chối gỡ bài',
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

export default function AdminModerationDetails({ post, report }) {
  return (
    <div className={styles.details}>
      {report && (
        <Panel title={`Báo cáo #${report.id}`} icon="flag">
          <dl className={styles.facts}>
            <dt>Người báo cáo</dt><dd>{report.reporterName || report.reporterEmail}</dd>
            <dt>Lý do</dt><dd>{REPORT_REASON[report.reasonCode] || report.reasonCode}</dd>
            <dt>Nội dung</dt><dd className={styles.content}>{report.reasonText || 'Không có mô tả thêm.'}</dd>
            <dt>Ngày gửi</dt><dd>{dateLabel(report.createdAt)}</dd>
            <dt>Quyết định gỡ bài</dt><dd><ReportModerationStatus status={report.status} /></dd>
            {report.handledAt && <><dt>Đã xử lý</dt><dd>{report.handlerName || report.handlerEmail || 'Admin'} · {dateLabel(report.handledAt)}</dd></>}
            {report.resolutionNote && <><dt>Kết quả</dt><dd className={styles.content}>{report.resolutionNote}</dd></>}
          </dl>
        </Panel>
      )}

      {post && <>
      <h3 className={styles.postTitle}>{post.title}</h3>
      <div className={styles.metadata}>
        <Avatar name={post.authorName || post.authorEmail} src={post.authorAvatarUrl} size={32} />
        <span>{post.authorName || post.authorEmail}</span>
        <Chip icon={post.postType === 'video' ? 'play-btn' : 'journal-text'}>
          {post.postType === 'video' ? 'Video' : 'Blog'}
        </Chip>
        <PostModerationStatus status={post.status} />
      </div>

      {post.status === 'reported' && (
        <Notice tone="info" title="Bài vẫn công khai — có báo cáo">
          Báo cáo chưa phải kết luận vi phạm. Bài tiếp tục hiển thị công khai trong khi chờ xử lý;
          chỉ bị gỡ khi Admin chấp nhận gỡ bài và chuyển sang Đã xóa.
        </Notice>
      )}
      {post.moderationNote && (
        <Notice tone={post.status === 'deleted' ? 'alert' : 'info'} title="Lý do xử lý bài viết">
          {post.moderationNote}
        </Notice>
      )}
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
      {report && (
        <Panel title="Nhật ký xử lý báo cáo này" icon="clock-history" flush>
          <p className="px-3 pt-3 mb-2 text-muted">
            Chỉ ghi thao tác trên báo cáo #{report.id}. Chấp nhận gỡ bài được ghi ở đây;
            nếu bài được gỡ, thao tác gỡ bài được ghi riêng trong nhật ký bài viết.
          </p>
          <DataTable columns={REPORT_HISTORY_COLUMNS} rows={report.history || []}
            caption="20 thao tác quản trị gần nhất của báo cáo"
            empty={{ title: 'Báo cáo chưa được xử lý' }} />
        </Panel>
      )}
    </div>
  );
}
