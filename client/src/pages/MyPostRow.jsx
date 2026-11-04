import { useState } from 'react';
import Button from '../components/Button/Button';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import { getMyPostDisplayStatus, getMyPostModerationMessage } from '../utils/userPostManagement';
import { formatCount } from '../utils/format';
import { getYouTubeId } from '../utils/validate';
import styles from './MyPostRow.module.css';

function getBadge(post) {
  const status = getMyPostDisplayStatus(post);
  if (status === 'reported') return { status: 'public', label: 'Công khai' };
  if (status === 'rejected') return { status: 'rejected', label: post.moderationSource === 'ai' ? 'AI từ chối' : 'Quản trị viên từ chối' };
  if (status === 'removed') return { status: 'deleted', label: 'Đã gỡ', toneOverride: 'bad' };
  if (status === 'deleted') return { status: 'deleted', label: 'Đã xóa' };
  return { status, label: undefined };
}

export default function MyPostRow({ post, highlighted, onOpen, onEdit, onDelete, canEdit, canDelete }) {
  const [reasonExpanded, setReasonExpanded] = useState(false);
  const status = getMyPostDisplayStatus(post);
  const badge = getBadge(post);
  const reason = getMyPostModerationMessage(post);
  const hasReason = ['rejected', 'removed', 'deleted'].includes(status) && Boolean(reason);
  const isPublic = ['public', 'reported'].includes(post.status);
  const videoId = post.postType === 'video' ? getYouTubeId(post.youtubeUrl ?? '') : null;
  const thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : post.thumbnailUrl;
  const createdLabel = post.createdAt;

  return (
    <article className={`${styles.row} ${highlighted ? styles.highlighted : ''}`} data-post-id={post.id}>
      <button type="button" className={`${styles.thumbnail} ${!thumbnail ? styles.placeholder : ''}`} onClick={onOpen} aria-label={`Xem bài viết: ${post.title}`}>
        {thumbnail ? <img src={thumbnail} alt="" loading="lazy" /> : <i className={`bi bi-${post.postType === 'video' ? 'play-btn' : 'journal-text'}`} aria-hidden="true" />}
      </button>
      <div className={styles.body}>
        <div className={styles.heading}>
          <button type="button" className={styles.title} onClick={onOpen} title={post.title}>{post.title}</button>
          <StatusBadge entity="post" status={badge.status} label={badge.label} toneOverride={badge.toneOverride} size="sm" />
        </div>
        {post.content && <p className={styles.excerpt}>{post.content}</p>}
        {hasReason && (
          <div className={styles.reasonWrap}>
            <button type="button" className={styles.reasonToggle} aria-expanded={reasonExpanded} onClick={() => setReasonExpanded((expanded) => !expanded)}>
              <i className="bi bi-exclamation-circle" aria-hidden="true" />
              {reasonExpanded ? 'Ẩn lý do' : 'Xem lý do kiểm duyệt'}
            </button>
            {reasonExpanded && <p className={`${styles.reason} ${styles.reasonExpanded}`}>{reason}</p>}
          </div>
        )}
        <div className={styles.footer}>
          <div className={styles.meta}>
            <span><i className={`bi bi-${post.postType === 'video' ? 'play-btn' : 'journal-text'}`} aria-hidden="true" />{post.postType === 'video' ? 'Video' : 'Blog'}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={createdLabel} title={createdLabel ? new Date(createdLabel).toLocaleString('vi-VN') : undefined}>
              {createdLabel ? new Date(createdLabel).toLocaleDateString('vi-VN') : ''}
            </time>
            {isPublic && <>
              <span aria-hidden="true">·</span>
              <span title="Lượt thích"><i className="bi bi-hand-thumbs-up" aria-hidden="true" /> {formatCount(post.voteCount)}</span>
              <span title="Lượt xem"><i className="bi bi-eye" aria-hidden="true" /> {formatCount(post.viewCount)}</span>
              <span title="Bình luận"><i className="bi bi-chat" aria-hidden="true" /> {formatCount(post.commentCount)}</span>
            </>}
          </div>
          <div className={styles.actions}>
            <Button variant="outline" size="sm" icon="eye" aria-label={`Xem bài viết: ${post.title}`} onClick={onOpen}>Xem</Button>
            {canEdit && (post.hasPendingEdit
              ? <Button variant="subtle" size="sm" icon="pencil" disabled aria-label="Bản sửa đang chờ quản trị viên duyệt">Sửa</Button>
              : <Button variant="outline" size="sm" icon="pencil" onClick={onEdit}>Sửa</Button>)}
            {canDelete && <Button variant="alert" size="sm" icon="trash3" aria-label={`Xóa bài viết: ${post.title}`} onClick={onDelete}>Xóa</Button>}
          </div>
        </div>
        {canEdit && post.hasPendingEdit && <p className={styles.policy}>Bản sửa đang chờ quản trị viên duyệt. Bài viết hiện tại vẫn công khai.</p>}
      </div>
    </article>
  );
}
