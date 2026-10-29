// Duy's Code: Chi tiết bài dùng chung cho Bảng tin và Bài của tôi.
import { useEffect, useState } from 'react';
import Avatar from '../Avatar/Avatar';
import Button from '../Button/Button';
import CommentSection from '../Comment/CommentSection';
import Modal from '../Modal/Modal';
import Photo from '../Photo/Photo';
import PostRichText from '../PostRichText/PostRichText';
import Skeleton from '../Skeleton/Skeleton';
import VoteButton from '../VoteButton/VoteButton';
import YouTubeEmbed from '../YouTubeEmbed/YouTubeEmbed';
import feedCardStyles from '../FeedPostCard/FeedPostCard.module.css';
import { POST_TYPE } from '../../constants/domain';
import { timeAgo } from '../../utils/format';
import postService from '../../services/post.service';
import { toPerson } from '../MemberLayout/MemberLayout';
import styles from './PostDetailModal.module.css';

export default function PostDetailModal({
  post, loading = false, loadingTitle = 'Đang tải bài viết', toComments, user, isMine,
  onClose, onVote, onReport, onRequireLogin, onCommentAdded, readOnly = false,
  showComments = true, statusBanner, onTopicClick,
}) {
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const postId = post?.id;
  const sectionId = `binh-luan-${postId}`;
  const opened = Boolean(post || loading);

  // Duy's Code: GET bình luận chỉ gọi cho bài public/reported như chính sách API hiện tại.
  useEffect(() => {
    if (!postId || !showComments || loading) {
      setComments([]);
      setCommentsLoading(false);
      return undefined;
    }
    let ignore = false;
    setComments([]);
    setCommentsLoading(true);
    postService.getComments(postId)
      .then((result) => { if (!ignore) setComments(result.items); })
      .catch(() => { if (!ignore) setComments([]); })
      .finally(() => { if (!ignore) setCommentsLoading(false); });
    return () => { ignore = true; };
  }, [postId, showComments, loading]);

  // Duy's Code: Giữ nguyên hành vi Bảng tin khi mở từ nút bình luận.
  useEffect(() => {
    if (postId && toComments && !commentsLoading) document.getElementById(sectionId)?.scrollIntoView({ block: 'start' });
  }, [postId, toComments, commentsLoading, sectionId]);

  const addComment = async (content) => {
    const created = await postService.addComment(post.id, content);
    setComments((current) => [created, ...current]);
    onCommentAdded?.(post.id);
  };

  const type = POST_TYPE[post?.type] ?? POST_TYPE.blog;
  const createdAt = post?.publishedAt ?? post?.createdAt;

  return (
    <Modal
      open={opened}
      onClose={onClose}
      title={post?.title || loadingTitle}
      size="lg"
      portal
      lockScroll
      className={styles.dialog}
    >
      {loading || !post ? (
        <div className={styles.loading} aria-label="Đang tải chi tiết bài viết" aria-busy="true">
          <Skeleton shape="circle" width={40} />
          <Skeleton lines={5} />
          <Skeleton height={220} />
          <Skeleton lines={3} />
        </div>
      ) : (
        <article className={styles.detail}>
          {statusBanner && <div className={styles.statusBanner} role="status">
            <b>{statusBanner.label}</b>
            {statusBanner.reason && <span>{statusBanner.reason}</span>}
          </div>}

          <header className={styles.detailHead}>
            <Avatar src={post.author?.avatarUrl} name={post.author?.fullName} size={40} />
            <div className={styles.authorInfo}>
              <b>{post.author?.fullName || 'Thành viên'}</b>
              <span className={styles.muted}>
                {type.label} · <time dateTime={createdAt}>{timeAgo(createdAt)} · {new Date(createdAt).toLocaleDateString('vi-VN')}</time>
              </span>
            </div>
          </header>

          {post.content && <div className={styles.content}><PostRichText text={post.content} /></div>}

          {post.categories?.length > 0 && (
            <div className={feedCardStyles.tags}>
              {/* Khoi's code 29/10: chip chủ đề giống thẻ bài (bỏ "#"); có onTopicClick → bấm để lọc Bảng tin */}
              {post.categories.map((category) => (onTopicClick ? (
                <button key={category.id} type="button" className={`${feedCardStyles.tag} ${feedCardStyles.tagBtn}`} onClick={() => onTopicClick(category)}>
                  <i className="bi bi-bookmark" aria-hidden="true" />{category.name}
                </button>
              ) : (
                <span key={category.id} className={feedCardStyles.tag}><i className="bi bi-bookmark" aria-hidden="true" />{category.name}</span>
              )))}
            </div>
          )}

          {post.type === 'video'
            ? <YouTubeEmbed url={post.youtubeUrl} title={post.title} className={styles.media} />
            : post.thumbnailUrl && <Photo src={post.thumbnailUrl} alt={post.title} ratio="16/9" shape="rounded" className={styles.media} />}

          <div className={styles.detailActions}>
            <VoteButton voted={post.isVoted} count={post.voteCount} disabled={readOnly} onToggle={() => onVote?.(post)} />
            <div className={styles.metrics}>
              <span><i className="bi bi-chat" aria-hidden="true" /> {post.commentCount ?? 0} bình luận</span>
              <span><i className="bi bi-eye" aria-hidden="true" /> {post.viewCount ?? 0} lượt xem</span>
            </div>
            {!isMine && onReport && (post.hasReported
              ? <Button size="sm" variant="subtle" icon="flag-fill" disabled>Đã báo cáo</Button>
              : <Button size="sm" variant="subtle" icon="flag" onClick={() => onReport({ type: 'post', id: post.id, title: post.title })}>Báo cáo</Button>)}
          </div>

          {showComments && (
            <CommentSection
              id={sectionId}
              comments={comments.map((comment) => ({ ...comment, author: toPerson(comment.author) }))}
              total={post.commentCount}
              currentUser={toPerson(user)}
              loading={commentsLoading}
              onCreate={addComment}
              onReport={(commentId) => {
                const comment = comments.find((entry) => entry.id === commentId);
                onReport?.({ type: 'comment', id: commentId, title: comment?.content.slice(0, 60) });
              }}
              onRequireLogin={onRequireLogin}
            />
          )}
        </article>
      )}
    </Modal>
  );
}
