// Chi tiết chỉ dùng trong trang kiểm duyệt; dữ liệu người dùng được render dưới dạng JSX text.
import {
  Avatar, Chip, DataTable, EmptyState, Notice, Panel, Photo, YouTubeEmbed,
} from '../components';
import AnimalWarnings from '../components/AnimalWarnings/AnimalWarnings';
import { REPORT_REASON } from '../constants/domain';
import { PostModerationStatus, ReportModerationStatus } from './postModerationPresentation';
import styles from './AdminModerationDetails.module.css';

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
const CASE_HISTORY_COLUMNS = [
  { key: 'reportId', header: 'Mã report', render: row => `#${row.reportId}`, width: 100 },
  ...historyColumns(REPORT_ACTION_LABELS),
];
const COMMENT_HISTORY_COLUMNS = historyColumns({ REMOVE: 'Xóa bình luận', HIDE: 'Ẩn bình luận', DELETE: 'Xóa bình luận', UPDATE: 'Cập nhật bình luận' })
  .map((column) => column.key === 'adminName' ? { ...column, header: 'Người thực hiện' } : column);

function Disclosure({ title, children }) {
  return (
    <details className={styles.disclosure}>
      <summary>{title}</summary>
      <div className={styles.disclosureBody}>{children}</div>
    </details>
  );
}

function PostFacts({ post }) {
  return (
    <Disclosure title="Thông tin bổ sung của bài viết">
      <dl className={styles.facts}>
        <dt>Mã bài</dt><dd>#{post.id}</dd>
        <dt>Xuất bản</dt><dd>{dateLabel(post.publishedAt)}</dd>
        <dt>Cập nhật</dt><dd>{dateLabel(post.updatedAt)}</dd>
        {post.moderatedAt && <><dt>Người xử lý gần nhất</dt><dd>{post.moderatorName || post.moderatorEmail || 'Admin'} · {dateLabel(post.moderatedAt)}</dd></>}
        {post.deletedAt && <><dt>Đã xóa</dt><dd>{dateLabel(post.deletedAt)}</dd></>}
      </dl>
    </Disclosure>
  );
}

function PostContent({ post, showFacts = true }) {
  return (
    <section className={styles.post} aria-label="Thông tin bài viết">
      <h3 className={styles.postTitle}>{post.title}</h3>
      <div className={styles.metadata}>
        <Avatar name={post.authorName || post.authorEmail} src={post.authorAvatarUrl} size={32} />
        <span>{post.authorName || post.authorEmail}</span>
        <Chip icon={post.postType === 'video' ? 'play-btn' : 'journal-text'}>
          {post.postType === 'video' ? 'Video' : 'Blog'}
        </Chip>
        <PostModerationStatus status={post.status} />
        <span className={styles.muted}>Ngày gửi: {dateLabel(post.createdAt)}</span>
      </div>
      {post.aiModerationOrigin === 'provider_unavailable' && <Notice tone="info">AI chưa kiểm tra bài viết này; cần duyệt thủ công.</Notice>}
      {post.aiModerationOrigin === 'ai_disabled' && <Notice tone="info">AI đang tắt khi bài được gửi; cần duyệt thủ công.</Notice>}
      {post.aiModerationOrigin === 'ai' && post.status === 'pending' && <Notice tone="info">AI đã kiểm tra nội dung hiện tại; bài đang chờ quyết định của quản trị viên.</Notice>}
      {!post.aiModerationOrigin && post.status === 'pending' && <Notice tone="info">Chưa có thông tin AI cho nội dung hiện tại.</Notice>}
      <AnimalWarnings warnings={post.animalWarnings} className="mb-3" />
      <Panel title={post.postType === 'video' ? 'Mô tả video' : 'Nội dung bài viết'} icon="journal-text">
        <div className={styles.content}>{post.content || 'Không có nội dung thêm.'}</div>
      </Panel>
      {post.postType === 'video'
        ? <YouTubeEmbed key={post.id} url={post.youtubeUrl} title={post.title} className={styles.preview} />
        : post.thumbnailUrl && <Photo src={post.thumbnailUrl} alt={`Ảnh bài ${post.title}`} ratio="16/9" shape="rounded" className={styles.preview} />}
      {post.categories?.length > 0 && (
        <div className={styles.metadata} aria-label="Danh mục bài viết">
          {post.categories.map(category => <Chip key={category.id}>{category.name}</Chip>)}
        </div>
      )}
      {post.reportCounts?.length > 0 && (
        <div className={styles.metadata} aria-label="Báo cáo của bài viết">
          {post.reportCounts.map(item => (
            <span key={item.status}>
              <ReportModerationStatus status={item.status} /> <b>{item.count}</b>
            </span>
          ))}
        </div>
      )}
      {showFacts && <PostFacts post={post} />}
    </section>
  );
}

function ReportList({ reports }) {
  return (
    <Panel title={`Các báo cáo trong nhóm · ${reports.length}`} icon="people">
      {reports.length === 0 ? <EmptyState icon="inbox" title="Nhóm chưa có báo cáo" /> : (
        <ol className={styles.reportList} aria-label="Tất cả người báo cáo và lý do, mới nhất trước">
          {reports.map(report => (
            <li className={styles.report} key={report.id}>
              <div className={styles.reportHeader}>
                <strong>{report.reporterName || report.reporterEmail || `Tài khoản #${report.reporterId}`}</strong>
                <span className={styles.muted}>Mã report #{report.id}</span>
              </div>
              <dl className={styles.reportFacts}>
                <dt>Lý do</dt><dd>{REPORT_REASON[report.reasonCode] || report.reasonCode}</dd>
                <dt>Mô tả</dt><dd className={styles.content}>{report.reasonText || 'Không có thông tin mô tả.'}</dd>
                <dt>Ngày gửi</dt><dd>{dateLabel(report.createdAt)}</dd>
              </dl>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export default function AdminModerationDetails({ post, reportCase, reports = [], comment }) {
  const isCommentCase = reportCase?.targetType === 'comment';
  return (
    <div className={styles.details}>
      {reportCase && (
        <section className={styles.caseSummary} aria-label="Thông tin nhóm báo cáo">
          <h3>Nhóm báo cáo #{reportCase.id}</h3>
          <div className={styles.metadata}>
            <span>{isCommentCase ? 'Bình luận' : 'Bài viết'} #{reportCase.targetId}</span>
            <span>{reportCase.reportCount} báo cáo</span>
            <ReportModerationStatus status={reportCase.status} targetType={reportCase.targetType} />
          </div>
        </section>
      )}

      {isCommentCase && comment && (
        <Panel title={`Bình luận #${comment.id}`} icon="chat-left-text">
          <dl className={styles.facts}>
            <dt>Tác giả</dt><dd>{comment.authorName || comment.authorEmail || `Tài khoản #${comment.authorId}`}</dd>
            <dt>Trạng thái</dt><dd>{{ public: 'Công khai', hidden: 'Đang ẩn', deleted: 'Đã xóa' }[comment.status] || comment.status}</dd>
            <dt>Ngày gửi</dt><dd>{dateLabel(comment.createdAt)}</dd>
            <dt>Bài viết chứa bình luận</dt><dd>{post?.title || `Bài #${comment.postId} không còn tồn tại`}</dd>
          </dl>
          {comment.status === 'deleted' && !['accepted', 'rejected'].includes(reportCase.status)
            ? <Notice tone="info">Bình luận đã bị xóa.</Notice>
            : <div className={`${styles.content} mt-3`}>{comment.content}</div>}
        </Panel>
      )}

      {!isCommentCase && post && <PostContent post={post} showFacts={!reportCase} />}
      {reportCase && <ReportList reports={reports} />}
      {reportCase && !isCommentCase && post && <PostFacts post={post} />}

      {isCommentCase && comment && !post && (
        <Notice tone="info" title="Bài viết chứa bình luận không còn tồn tại">Thông tin bình luận và các báo cáo vẫn được giữ để xử lý.</Notice>
      )}
      {isCommentCase && post && (
        <Disclosure title="Ngữ cảnh bài viết">
          <PostContent post={post} />
        </Disclosure>
      )}

      {reportCase && (
        <Disclosure title="Thông tin bổ sung của nhóm báo cáo">
          <dl className={styles.facts}>
            <dt>Mở nhóm lúc</dt><dd>{dateLabel(reportCase.createdAt)}</dd>
            <dt>Báo cáo gần nhất</dt><dd>{dateLabel(reports[0]?.createdAt)}</dd>
            {reportCase.handledAt && <><dt>Đã xử lý</dt><dd>{reportCase.handlerName || reportCase.handlerEmail || 'Admin'} · {dateLabel(reportCase.handledAt)}</dd></>}
            {reportCase.resolutionNote && <><dt>Kết quả</dt><dd className={styles.content}>{reportCase.resolutionNote}</dd></>}
          </dl>
        </Disclosure>
      )}

      {isCommentCase && comment && (
        <Disclosure title="Nhật ký thao tác trên bình luận">
          <DataTable columns={COMMENT_HISTORY_COLUMNS} rows={comment.history || []}
            caption="Nhật ký thao tác trên bình luận" empty={{ title: 'Chưa có thao tác' }} />
        </Disclosure>
      )}
      {post && (
        <Disclosure title="Nhật ký thao tác trên bài viết">
          <p className={styles.historyDescription}>Ghi người thực hiện và thời điểm duyệt, từ chối hoặc gỡ bài này. Mỗi dòng là một thao tác ở một thời điểm, không phải danh sách người cùng duyệt bài.</p>
          <DataTable columns={POST_HISTORY_COLUMNS} rows={post.history || []}
            caption="20 thao tác quản trị gần nhất của bài viết" empty={{ title: 'Chưa có thao tác quản trị' }} />
        </Disclosure>
      )}
      {reportCase && (
        <Disclosure title="Nhật ký xử lý các báo cáo trong nhóm">
          <p className={styles.historyDescription}>Một quyết định áp dụng cho cả nhóm và được ghi nhận trên từng báo cáo. Thao tác gỡ bài hoặc xóa bình luận được ghi riêng trên nội dung tương ứng.</p>
          <DataTable columns={CASE_HISTORY_COLUMNS} rows={reportCase.history || []}
            caption="100 thao tác quản trị gần nhất trên các báo cáo trong nhóm" empty={{ title: 'Nhóm báo cáo chưa được xử lý' }} />
        </Disclosure>
      )}
    </div>
  );
}
