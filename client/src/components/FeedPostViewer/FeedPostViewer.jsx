// Khoi's code (01/11/2026): hộp XEM BÀI cỡ lớn của Bảng tin — theo prototype v4 (src/v4/components/Dialogs.jsx → PostDialog).
//  - Bài có ảnh/video: gần toàn màn hình (tối đa 1440px, cao 92vh). Trái = ảnh/video lớn trên nền tối · Phải (420px) = nội dung + bình luận.
//  - Bài chỉ có chữ: 1 cột rộng 780px, chữ to hơn để đọc.
//  - Điện thoại: toàn màn hình, ảnh ở trên.
// CHỨC NĂNG giữ y hệt PostDetailModal/PostDetailContent: thích (onVote), báo cáo bài/bình luận, bấm chủ đề để lọc,
// bình luận đúng luật tải/gửi của Tùng (chỉ nhận dữ liệu khi vẫn đúng bài + đúng tài khoản), gửi lại không trùng (requestId),
// bình luận bị từ chối → hộp báo + chỉ tác giả thấy lý do. Giao diện bình luận theo v4: bong bóng, "Xem N bình luận trước",
// ô viết bình luận dính ở đáy (01/11/2026 — trước dùng CommentSection, ô viết nằm trên danh sách).
// Vì sao là file MỚI: PostDetailModal/PostDetailContent còn dùng ở trang "Bài của tôi" (Duy) và trang chi tiết bài (Tùng)
// → không đụng để tránh conflict. Props giống PostDetailModal để PostFeedPage chỉ cần đổi tên component.
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Avatar from '../Avatar/Avatar';
import Button from '../Button/Button';
import Menu from '../Menu/Menu';
import Modal from '../Modal/Modal';
import Notice from '../Notice/Notice';
import PostRichText from '../PostRichText/PostRichText';
import Skeleton from '../Skeleton/Skeleton';
import YouTubeEmbed from '../YouTubeEmbed/YouTubeEmbed';
import cx from '../cx';
import { POST_TYPE } from '../../constants/domain';
import { createPostContentRequestId } from '../../utils/postContentRequest';
import postContentService from '../../services/postContent.service';
import { formatCount, timeAgo } from '../../utils/format';
import s from './FeedPostViewer.module.css';

/** Bình luận của 1 bài — logic chép từ PostDetailContent (Tùng/Duy), giữ nguyên các lớp chặn dữ liệu cũ. */
function useComments({ postId, viewerId, viewerContext, isViewerCurrent, onCommentCountChange }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const contextRef = useRef(null);
  const activeRef = useRef(null);
  const requestRef = useRef(null);
  if (!contextRef.current || contextRef.current.postId !== postId || contextRef.current.viewerId !== viewerId) {
    contextRef.current = { postId, viewerId };
  }
  const context = contextRef.current;

  // GET bình luận; đổi bài/tài khoản → bỏ kết quả của yêu cầu cũ
  useEffect(() => {
    if (!postId) return undefined;
    const active = { context };
    activeRef.current = active;
    const isCurrent = () => activeRef.current === active && contextRef.current === context && isViewerCurrent(viewerContext);
    setComments([]);
    setError(false);
    setLoading(true);
    requestRef.current = postContentService.getComments(postId)
      .then((result) => {
        if (!isCurrent()) return false;
        setComments(result.items);
        onCommentCountChange?.(postId, result.publicCommentCount);
        return true;
      })
      .catch(() => { if (isCurrent()) setError(true); return false; })
      .finally(() => { if (isCurrent()) setLoading(false); });
    return () => { if (activeRef.current === active) activeRef.current = null; };
  }, [postId, context, onCommentCountChange, isViewerCurrent, viewerContext, retry]);

  const add = async (content, options) => {
    const active = activeRef.current;
    const isCurrent = () => active && activeRef.current === active && contextRef.current === active.context && isViewerCurrent(viewerContext);
    const changed = () => new Error('Ngữ cảnh bình luận đã thay đổi. Vui lòng mở lại bài viết.');
    if (!isCurrent()) throw changed();
    // Chờ GET đầu tiên để response cũ không ghi đè bình luận vừa gửi
    const loaded = await requestRef.current;
    if (!isCurrent()) throw changed();
    if (!loaded) throw new Error('Chưa tải được bình luận. Vui lòng thử tải lại trước khi gửi.');
    const created = await postContentService.addComment(postId, content, options);
    if (!isCurrent()) throw changed();
    setComments((current) => (created.displayable
      ? [created, ...current.filter((c) => c.id !== created.id)]
      : current.filter((c) => c.id !== created.id)));
    onCommentCountChange?.(postId, created.publicCommentCount);
  };

  return { comments, loading, error, add, retry: () => { activeRef.current = null; setRetry((n) => n + 1); } };
}

const SHOWN_COMMENTS = 3; // mở bài: hiện 3 bình luận mới nhất, còn lại sau nút "Xem N bình luận trước"
const MAX_COMMENT = 1000;  // = giới hạn của server

/** 1 bình luận dạng bong bóng (phẳng, không trả lời lồng nhau — nhóm đã chốt). Luật hiển thị giống CommentItem. */
function CommentBubble({ comment, onReport }) {
  const { author = {}, content, createdAt, edited, status = 'public', isOwner, moderation } = comment;
  const name = author.fullName || 'Thành viên';
  // Bình luận của chính mình bị AI từ chối → chỉ mình thấy, kèm lý do
  if (status === 'hidden' && isOwner && moderation?.outcome === 'rejected') {
    return (
      <li className={s.cmt}>
        <Avatar name={name} src={author.avatarUrl} size={34} />
        <div>
          <div className={cx(s.bubble, s.bubbleRejected)}>
            <b>{name}</b>
            <p>{content}</p>
            <p className={s.reason}>{moderation.reason}</p>
          </div>
          <small className={s.cmtMeta}>Đã từ chối · Chỉ bạn nhìn thấy · {timeAgo(createdAt)}</small>
          {moderation.warnings?.map((w) => <p key={w.code} className={s.warning}>{w.message}</p>)}
        </div>
      </li>
    );
  }
  if (status !== 'public') {
    return (
      <li className={s.cmtRemoved}>
        <i className={`bi bi-${status === 'hidden' ? 'eye-slash' : 'trash3'}`} aria-hidden="true" />
        {status === 'hidden' ? 'Bình luận đã bị ẩn do vi phạm quy định cộng đồng.' : 'Bình luận đã bị xoá.'}
      </li>
    );
  }
  return (
    <li className={s.cmt}>
      <Avatar name={name} src={author.avatarUrl} size={34} />
      <div>
        <div className={s.bubble}>
          <b>{name}</b>
          <p>{content}</p>
        </div>
        <small className={s.cmtMeta}>
          <time dateTime={createdAt}>{timeAgo(createdAt)}</time>
          {edited && <> · đã sửa</>}
          {!isOwner && onReport && <> · <button type="button" onClick={onReport}>Báo cáo</button></>}
        </small>
        {isOwner && moderation?.warnings?.map((w) => <p key={w.code} className={s.warning}>{w.message}</p>)}
      </div>
    </li>
  );
}

/** Ô viết bình luận dính đáy. Luật giống CommentComposer: khoá gửi trùng, requestId theo nội dung, bị từ chối → hộp báo. */
function CommentForm({ user, inputRef, onSubmit, onRequireLogin, onSent }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState('');
  const id = useId();
  const submissionRef = useRef(null);
  const busyRef = useRef(false);

  if (!user) {
    return (
      <div className={s.cmtForm}>
        <span className={s.guestNote}><i className="bi bi-chat-dots" aria-hidden="true" /> Đăng nhập để bình luận và thích bài viết.</span>
        <Button size="sm" variant="outline" onClick={onRequireLogin}>Đăng nhập</Button>
      </div>
    );
  }

  const send = async (e) => {
    e?.preventDefault();
    const content = text.trim();
    if (!content || busyRef.current) return;
    busyRef.current = true;
    setSending(true);
    setError('');
    try {
      if (submissionRef.current?.content !== content) {
        submissionRef.current = { content, requestId: createPostContentRequestId() };
      }
      await onSubmit(content, { requestId: submissionRef.current.requestId });
      submissionRef.current = null;
      setText('');
      onSent?.();
    } catch (err) {
      if (err?.details?.code === 'COMMENT_REJECTED') setBlocked(err.message || 'Bình luận chưa phù hợp.');
      else setError(err?.message || 'Chưa gửi được bình luận, thử lại sau');
    } finally {
      busyRef.current = false;
      setSending(false);
    }
  };

  return (
    <form className={s.cmtForm} onSubmit={send}>
      <Avatar name={user.fullName} src={user.avatarUrl} size={34} />
      <div className={s.cmtFormMain}>
        {error && <p id={`${id}-err`} className={s.cmtError} role="alert">{error}</p>}
        <div className={cx(s.cmtInput, error && s.cmtInputBad)}>
          <label htmlFor={id} className="visually-hidden">Viết bình luận</label>
          <textarea
            ref={inputRef}
            id={id}
            rows={1}
            value={text}
            maxLength={MAX_COMMENT}
            onChange={(e) => { setText(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e); }}
            placeholder={`Bình luận dưới tên ${user.fullName ?? 'bạn'}…`}
            disabled={sending}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-err` : undefined}
          />
          <button type="submit" disabled={!text.trim() || sending} aria-label="Gửi bình luận" title="Gửi (Enter)">
            <i className={`bi bi-${sending ? 'hourglass-split' : 'send-fill'}`} aria-hidden="true" />
          </button>
        </div>
        {text.length > MAX_COMMENT - 100 && <small className={s.cmtCount}>{text.length}/{MAX_COMMENT}</small>}
      </div>
      <Modal open={Boolean(blocked)} title="Bình luận chưa phù hợp" onClose={() => setBlocked('')} size="sm">
        <p>{blocked}</p>
        <Button onClick={() => setBlocked('')}>Sửa bình luận</Button>
      </Modal>
    </form>
  );
}

/**
 * @param {object|null} post   null = đóng
 * @param {boolean} [toComments]   mở từ nút bình luận → cuộn tới khu bình luận
 * @param {object|null} user · @param {() => void} onClose
 * @param {(post) => void} onVote · @param {(target: {type, id, title}) => void} onReport · @param {boolean} isMine
 * @param {() => void} onRequireLogin · @param {(category) => void} [onTopicClick]
 * @param {*} viewerContext · @param {(ctx) => boolean} isViewerCurrent · @param {(postId, count) => void} onCommentCountChange
 */
export default function FeedPostViewer({ post, ...props }) {
  if (!post) return null;
  return <Viewer key={post.id} post={post} {...props} />;
}

function Viewer({
  post, toComments, user, onClose, onVote, onReport, isMine, onRequireLogin, onTopicClick,
  viewerContext, isViewerCurrent, onCommentCountChange,
}) {
  const ref = useRef(null);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const [showAll, setShowAll] = useState(false);
  const sectionId = `binh-luan-${post.id}`;
  const { comments, loading, error, add, retry } = useComments({
    postId: post.id, viewerId: String(user?.id ?? 'guest'), viewerContext, isViewerCurrent, onCommentCountChange,
  });

  // Mở bằng <dialog>.showModal(): giữ focus bên trong, Esc để đóng. Khoá cuộn nền (bù bề rộng thanh cuộn).
  useEffect(() => {
    const dialog = ref.current;
    const before = document.activeElement;
    const body = document.body;
    const root = document.documentElement;
    const saved = { body: body.style.overflow, root: root.style.overflow, pad: body.style.paddingRight };
    const bar = Math.max(0, window.innerWidth - root.clientWidth);
    body.style.overflow = 'hidden';
    root.style.overflow = 'hidden';
    if (bar > 0) body.style.paddingRight = `${(Number.parseFloat(getComputedStyle(body).paddingRight) || 0) + bar}px`;
    if (!dialog.open) dialog.showModal();
    dialog.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
      body.style.overflow = saved.body;
      root.style.overflow = saved.root;
      body.style.paddingRight = saved.pad;
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, []);

  // Mở từ nút bình luận → cuộn tới khu bình luận khi đã tải xong + đặt con trỏ vào ô viết
  useEffect(() => {
    if (!toComments || loading) return;
    document.getElementById(sectionId)?.scrollIntoView({ block: 'start' });
    inputRef.current?.focus({ preventScroll: true });
  }, [toComments, loading, sectionId]);

  // API trả mới nhất trước → hiện theo thứ tự thời gian (cũ ở trên, mới ở dưới, sát ô viết)
  const ordered = [...comments].reverse();
  const hidden = showAll ? 0 : Math.max(0, ordered.length - SHOWN_COMMENTS);
  const visible = ordered.slice(hidden);
  const scrollToEnd = () => requestAnimationFrame(() => {
    const el = bodyRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  });
  const menuItems = isMine || !onReport ? [] : post.hasReported
    ? [{ icon: 'flag-fill', label: 'Đã báo cáo', hint: 'Admin đang xem xét', disabled: true }]
    : [{ icon: 'flag', label: 'Báo cáo bài viết', hint: 'Gửi cho Admin xem xét', tone: 'alert', onClick: () => onReport({ type: 'post', id: post.id, title: post.title }) }];

  const type = POST_TYPE[post.type] ?? POST_TYPE.blog;
  const createdAt = post.publishedAt ?? post.createdAt;
  const isVideo = post.type === 'video';
  const hasMedia = isVideo || Boolean(post.thumbnailUrl);
  const voters = post.isVoted
    ? (post.voteCount > 1 ? `Bạn và ${formatCount(post.voteCount - 1)} người khác` : 'Bạn')
    : formatCount(post.voteCount ?? 0);

  const head = (
    <header className={s.head}>
      <Avatar name={post.author?.fullName} src={post.author?.avatarUrl} size={42} />
      <div className={s.who}>
        <b>{post.author?.fullName || 'Thành viên'}</b>
        <small>
          <time dateTime={createdAt} title={createdAt ? new Date(createdAt).toLocaleString('vi-VN') : undefined}>{timeAgo(createdAt)}</time>
          <span aria-hidden="true"> · </span>
          <i className={`bi bi-${type.icon}`} aria-hidden="true" /> {type.label}
        </small>
      </div>
      {menuItems.length > 0 && (
        <Menu
          items={menuItems}
          renderTrigger={(p) => (
            <button type="button" className={s.iconBtn} aria-label="Tuỳ chọn bài viết" {...p}>
              <i className="bi bi-three-dots" aria-hidden="true" />
            </button>
          )}
        />
      )}
      <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Đóng" title="Đóng (Esc)">
        <i className="bi bi-x-lg" aria-hidden="true" />
      </button>
    </header>
  );

  const body = (
    <div ref={bodyRef} className={s.body}>
      <h2 className={s.title}>{post.title}</h2>
      {post.content && <div className={s.text}><PostRichText text={post.content} /></div>}
      {post.categories?.length > 0 && (
        <div className={s.chips}>
          {post.categories.map((c) => (onTopicClick ? (
            <button key={c.id} type="button" className={s.chip} onClick={() => onTopicClick(c)} aria-label={`Xem bài cùng chủ đề ${c.name}`}>{c.name}</button>
          ) : <span key={c.id} className={s.chip}>{c.name}</span>))}
        </div>
      )}

      <div className={s.stats}>
        <span>{post.voteCount > 0 ? <><i className="bi bi-heart-fill" aria-hidden="true" /> {voters}</> : 'Hãy là người đầu tiên thích'}</span>
        <span>{formatCount(post.commentCount ?? 0)} bình luận</span>
      </div>
      <div className={s.actions}>
        <button type="button" className={cx(s.act, post.isVoted && s.liked)} aria-pressed={!!post.isVoted} onClick={() => onVote?.(post)}>
          <i className={`bi bi-heart${post.isVoted ? '-fill' : ''}`} aria-hidden="true" /> Thích
        </button>
        <button type="button" className={s.act} onClick={() => (user ? inputRef.current?.focus() : onRequireLogin?.())}>
          <i className="bi bi-chat" aria-hidden="true" /> Bình luận
        </button>
      </div>

      <section id={sectionId} className={s.comments} aria-label="Bình luận">
        {loading && (
          <div className={s.cmtLoading} aria-busy="true">
            {[0, 1].map((i) => <div key={i} className={s.cmt}><Skeleton shape="circle" width={34} /><Skeleton lines={2} /></div>)}
          </div>
        )}
        {!loading && error && (
          <Notice tone="alert" title="Không tải được bình luận" action={{ label: 'Thử lại', onClick: retry }}>Vui lòng thử lại sau.</Notice>
        )}
        {!loading && !error && (
          <ul className={s.cmts}>
            {hidden > 0 && (
              <li><button type="button" className={s.olderBtn} onClick={() => setShowAll(true)}>Xem {formatCount(hidden)} bình luận trước</button></li>
            )}
            {visible.length === 0 && <li className={s.cmtEmpty}>Chưa có bình luận nào. Bạn nói trước nhé.</li>}
            {visible.map((c) => (
              <CommentBubble
                key={c.id}
                comment={c}
                onReport={onReport ? () => onReport({ type: 'comment', id: c.id, title: c.content?.slice(0, 60) }) : undefined}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );

  const form = (
    <CommentForm user={user} inputRef={inputRef} onSubmit={add} onRequireLogin={onRequireLogin} onSent={scrollToEnd} />
  );

  return createPortal(
    <dialog
      ref={ref}
      className={cx(s.dialog, hasMedia ? s.viewer : s.reader)}
      aria-label={`Bài viết: ${post.title}`}
      tabIndex={-1}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      {hasMedia ? (
        <>
          <div className={s.stage}>
            {isVideo ? (
              <div className={s.stageVideo}>
                <YouTubeEmbed url={post.youtubeUrl} title={post.title} shape="none" />
              </div>
            ) : (
              <>
                {/* ảnh mờ phóng to làm nền → ảnh dọc/ngang đều lấp kín khung tối, không có dải đen cứng */}
                <img className={s.stageBg} src={post.thumbnailUrl} alt="" aria-hidden="true" />
                <img className={s.stageImg} src={post.thumbnailUrl} alt={post.title} />
              </>
            )}
          </div>
          <div className={s.side}>{head}{body}{form}</div>
        </>
      ) : (
        <>{head}{body}{form}</>
      )}
    </dialog>,
    document.body,
  );
}
