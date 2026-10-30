// Tùng: tách nội dung từ popup của Duy để trang chi tiết và popup dùng chung hành vi.
import { useEffect, useRef, useState } from 'react';
import Avatar from '../Avatar/Avatar';
import Button from '../Button/Button';
import CommentSection from '../Comment/CommentSection';
import Photo from '../Photo/Photo';
import PostRichText from '../PostRichText/PostRichText';
import Skeleton from '../Skeleton/Skeleton';
import VoteButton from '../VoteButton/VoteButton';
import YouTubeEmbed from '../YouTubeEmbed/YouTubeEmbed';
import feedCardStyles from '../FeedPostCard/FeedPostCard.module.css';
import { POST_TYPE } from '../../constants/domain';
import { timeAgo } from '../../utils/format';
// Tùng: cả hai trang dùng cùng contract kiểm duyệt và số bình luận công khai.
import postContentService from '../../services/postContent.service';
import { toPerson } from '../MemberLayout/MemberLayout';
import styles from './PostDetailContent.module.css';

export default function PostDetailContent({
  post, loading = false, toComments, user, isMine,
  onVote, onReport, onRequireLogin, onCommentCountChange, readOnly = false,
  showComments = true, statusBanner, viewerContext, isViewerCurrent, onTopicClick,
}) {
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState(false);
  const [commentsRetry, setCommentsRetry] = useState(0);
  const postId = post?.id;
  const sectionId = `binh-luan-${postId}`;
  const viewerId = String(user?.id ?? 'guest');
  const contextRef = useRef(null);
  const activeContextRef = useRef(null);
  const loadingRequestRef = useRef(null);
  if (!contextRef.current || contextRef.current.postId !== postId || contextRef.current.viewerId !== viewerId
      || contextRef.current.showComments !== showComments || contextRef.current.loading !== loading) {
    contextRef.current = { postId, viewerId, showComments, loading };
  }
  const context = contextRef.current;

  // Duy's Code: GET bình luận chỉ gọi cho bài public/reported như chính sách API hiện tại.
  useEffect(() => {
    if (!postId || !showComments || loading) {
      setComments([]);
      setCommentsLoading(false);
      setCommentsError(false);
      return undefined;
    }
    // Tùng: đổi bài/tài khoản phải vô hiệu hóa cả GET lẫn POST cũ trước khi nhận dữ liệu riêng.
    const active = { context };
    activeContextRef.current = active;
    const isCurrent = () => activeContextRef.current === active && contextRef.current === context
      && isViewerCurrent(viewerContext);
    setComments([]);
    setCommentsError(false);
    setCommentsLoading(true);
    loadingRequestRef.current = postContentService.getComments(postId)
      .then((result) => {
        if (!isCurrent()) return false;
        setComments(result.items);
        onCommentCountChange?.(postId, result.publicCommentCount);
        return true;
      })
      .catch(() => { if (isCurrent()) setCommentsError(true); return false; })
      .finally(() => { if (isCurrent()) setCommentsLoading(false); });
    return () => { if (activeContextRef.current === active) activeContextRef.current = null; };
  }, [postId, showComments, loading, context, onCommentCountChange, isViewerCurrent, viewerContext, commentsRetry]);

  // Duy's Code: Giữ nguyên hành vi Bảng tin khi mở từ nút bình luận.
  useEffect(() => {
    if (postId && toComments && !commentsLoading) document.getElementById(sectionId)?.scrollIntoView({ block: 'start' });
  }, [postId, toComments, commentsLoading, sectionId]);

  const addComment = async (content, options) => {
    const active = activeContextRef.current;
    const isCurrent = () => active && activeContextRef.current === active && contextRef.current === active.context
      && isViewerCurrent(viewerContext);
    if (!isCurrent()) throw new Error('Ngữ cảnh bình luận đã thay đổi. Vui lòng mở lại bài viết.');
    // Tùng: chờ GET đầu tiên để response cũ không ghi đè bình luận vừa gửi.
    const loaded = await loadingRequestRef.current;
    if (!isCurrent()) throw new Error('Ngữ cảnh bình luận đã thay đổi. Vui lòng mở lại bài viết.');
    if (!loaded) throw new Error('Chưa tải được bình luận. Vui lòng thử tải lại trước khi gửi.');
    const created = await postContentService.addComment(post.id, content, options);
    if (!isCurrent()) throw new Error('Ngữ cảnh bình luận đã thay đổi. Vui lòng mở lại bài viết.');
    setComments((current) => (created.displayable
      ? [created, ...current.filter((comment) => comment.id !== created.id)]
      : current.filter((comment) => comment.id !== created.id)));
    onCommentCountChange?.(post.id, created.publicCommentCount);
  };

  const type = POST_TYPE[post?.type] ?? POST_TYPE.blog;
  const createdAt = post?.publishedAt ?? post?.createdAt;

  return (
    <>
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
              {post.categories.map((category) => (onTopicClick ? (
                <button key={category.id} type="button" className={`${feedCardStyles.tag} ${feedCardStyles.tagBtn}`}
                  onClick={() => onTopicClick(category)} aria-label={`Xem bài cùng chủ đề ${category.name}`}>
                  <i className="bi bi-bookmark" aria-hidden="true" />{category.name}
                </button>
              ) : <span key={category.id} className={feedCardStyles.tag}>#{category.name}</span>))}
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
              key={`${postId}:${viewerId}`}
              id={sectionId}
              comments={comments.map((comment) => ({ ...comment, author: toPerson(comment.author) }))}
              total={post.commentCount}
              currentUser={toPerson(user)}
              loading={commentsLoading}
              loadError={commentsError}
              onRetry={() => { activeContextRef.current = null; setCommentsRetry((value) => value + 1); }}
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
    </>
  );
}
