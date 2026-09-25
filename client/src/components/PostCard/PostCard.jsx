import Avatar from '../Avatar/Avatar';
import Chip from '../Chip/Chip';
import IconButton from '../IconButton/IconButton';
import Menu from '../Menu/Menu';
import Notice from '../Notice/Notice';
import Photo from '../Photo/Photo';
import StatusBadge from '../StatusBadge/StatusBadge';
import VoteButton from '../VoteButton/VoteButton';
import cx from '../cx';
import { POST_TYPE } from '../../constants/domain';
import { formatCount, timeAgo } from '../../utils/format';
import styles from './PostCard.module.css';

/**
 * Thẻ bài đăng Blog / Video.
 *  - layout="card": bảng tin trang chủ (M-01), gợi ý liên quan
 *  - layout="row" : kết quả tìm kiếm (M-02), Bài của tôi (M-07), hàng chờ duyệt admin
 *
 * Component KHÔNG gọi API. Trang lấy dữ liệu, đổi tên field rồi truyền vào (xem ví dụ trong PostCard.md).
 *
 * @param {'card'|'row'} [layout='card']
 * @param {'blog'|'video'} postType          post.post_type
 * @param {string} title
 * @param {string} [excerpt]                 đoạn trích nội dung (card: tối đa 3 dòng)
 * @param {string} href                      link tới chi tiết bài, vd `/posts/12`
 * @param {React.ElementType} [linkAs]       truyền `Link` của react-router → dùng `to={href}`
 * @param {string} [thumbnailUrl]            post.thumbnail_url (blog)
 * @param {string} [youtubeVideoId]          post.youtube_video_id (video → tự lấy ảnh bìa YouTube)
 * @param {{name: string, avatarUrl?: string}} author
 * @param {string} createdAt                 ISO, hiện "2 giờ trước"
 * @param {{id: string|number, name: string}[]} [categories]  hiện tối đa 3
 * @param {number} [voteCount] · [commentCount] · [viewCount]
 * @param {boolean} [voted]
 * @param {() => void} [onVote]              không truyền → ẩn nút thích (vd bài chờ duyệt)
 * @param {boolean} [isOwner]                bài của chính mình → hiện trạng thái + menu Sửa/Xoá
 * @param {string} [status]                  post.status (chỉ hiện khi isOwner)
 * @param {string} [moderationNote]          lý do bị ẩn / từ chối (hiện cho chủ bài)
 * @param {() => void} [onEdit] · [onDelete] (chủ bài) · [onReport] (người khác)
 *
 * Bài đăng nhanh (PostComposer: chỉ có câu hỏi, không ảnh, không trích đoạn) → tiêu đề tự to hơn như 1 status.
 */
export default function PostCard({
  layout = 'card', postType = 'blog', title, excerpt, href = '#', linkAs,
  thumbnailUrl, youtubeVideoId, author = {}, createdAt, categories = [],
  voteCount = 0, commentCount = 0, viewCount, voted = false, onVote,
  isOwner = false, status, moderationNote, onEdit, onDelete, onReport, className,
}) {
  const Link = linkAs || 'a';
  const linkProps = linkAs ? { to: href } : { href };
  const type = POST_TYPE[postType] ?? POST_TYPE.blog;
  const cover = postType === 'video' && youtubeVideoId
    ? `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`
    : thumbnailUrl;
  const needsNote = isOwner && moderationNote && (status === 'hidden' || status === 'rejected');

  const menuItems = isOwner
    ? [
      onEdit && { icon: 'pencil', label: 'Sửa bài', onClick: onEdit },
      onEdit && onDelete && { divider: true },
      onDelete && { icon: 'trash3', label: 'Xoá bài', tone: 'alert', onClick: onDelete },
    ].filter(Boolean)
    : [onReport && { icon: 'flag', label: 'Báo cáo bài viết', hint: 'Gửi cho Admin xem xét', onClick: onReport }].filter(Boolean);

  const menu = menuItems.length > 0 && (
    <Menu
      renderTrigger={(p) => <IconButton icon="three-dots" label="Tuỳ chọn bài viết" variant="ghost" size="sm" {...p} />}
      items={menuItems}
    />
  );

  const media = (cover || postType === 'video') && (
    <Link {...linkProps} className={styles.media} tabIndex={-1} aria-hidden="true">
      <Photo src={cover} ratio={layout === 'row' ? '4/3' : '16/9'} className={styles.img} />
      {postType === 'video' && <span className={styles.playBadge}><i className="bi bi-play-fill" /></span>}
    </Link>
  );

  const stats = (
    <span className={styles.stats}>
      {viewCount != null && <span><i className="bi bi-eye" aria-hidden="true" />{formatCount(viewCount)}<span className="visually-hidden"> lượt xem</span></span>}
      <span><i className="bi bi-chat" aria-hidden="true" />{formatCount(commentCount)}<span className="visually-hidden"> bình luận</span></span>
    </span>
  );

  // ---------------- Dạng hàng ----------------
  if (layout === 'row') {
    return (
      <article className={cx(styles.row, className)}>
        {media || <span className={styles.rowNoMedia} aria-hidden="true"><i className={`bi bi-${type.icon}`} /></span>}
        <div className={styles.rowBody}>
          <div className={styles.rowTop}>
            <h3 className={styles.rowTitle}><Link {...linkProps}>{title}</Link></h3>
            {menu}
          </div>
          <div className={styles.meta}>
            <span><i className={`bi bi-${type.icon}`} aria-hidden="true" /> {type.label}</span>
            {!isOwner && author.name && <span>{author.name}</span>}
            <span>{timeAgo(createdAt)}</span>
            {onVote == null && <span><i className="bi bi-hand-thumbs-up" aria-hidden="true" /> {formatCount(voteCount)}</span>}
            {stats}
          </div>
          {isOwner && status && <StatusBadge entity="post" status={status} size="sm" />}
          {needsNote && <p className={styles.note}><b>Lý do:</b> {moderationNote}</p>}
        </div>
      </article>
    );
  }

  // ---------------- Dạng thẻ ----------------
  return (
    <article className={cx(styles.card, className)}>
      <header className={styles.head}>
        <Avatar src={author.avatarUrl} name={author.name} size={40} />
        <div className={styles.who}>
          <b>{author.name}</b>
          <span>
            <i className={`bi bi-${type.icon}`} aria-hidden="true" /> {type.label} · <time dateTime={createdAt}>{timeAgo(createdAt)}</time>
          </span>
        </div>
        {isOwner && status && <StatusBadge entity="post" status={status} />}
        {menu}
      </header>

      {needsNote && (
        <Notice tone={status === 'rejected' ? 'alert' : 'info'} title={status === 'rejected' ? 'Bài bị từ chối' : 'Bài đang bị ẩn'}>
          {moderationNote}
        </Notice>
      )}

      <h3 className={cx(styles.title, !excerpt && !media && styles.short)}><Link {...linkProps}>{title}</Link></h3>
      {excerpt && <p className={styles.excerpt}>{excerpt}</p>}
      {categories.length > 0 && (
        <div className={styles.chips}>
          {categories.slice(0, 3).map((c) => <Chip key={c.id}>{c.name}</Chip>)}
          {categories.length > 3 && <span className={styles.more}>+{categories.length - 3}</span>}
        </div>
      )}
      {media}

      <footer className={styles.foot}>
        {onVote && <VoteButton voted={voted} count={voteCount} onToggle={onVote} />}
        <Link {...(linkAs ? { to: `${href}#binh-luan` } : { href: `${href}#binh-luan` })} className={styles.footLink}>
          <i className="bi bi-chat" aria-hidden="true" />{formatCount(commentCount)}<span className="visually-hidden"> bình luận</span>
        </Link>
        <span className={styles.spacer} />
        {viewCount != null && (
          <span className={styles.views}><i className="bi bi-eye" aria-hidden="true" />{formatCount(viewCount)} lượt xem</span>
        )}
      </footer>
    </article>
  );
}
