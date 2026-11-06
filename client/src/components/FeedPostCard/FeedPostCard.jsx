import { useEffect, useState } from 'react';
import Avatar from '../Avatar/Avatar';
import Menu from '../Menu/Menu';
import Photo from '../Photo/Photo';
import YouTubeEmbed from '../YouTubeEmbed/YouTubeEmbed';
import cx from '../cx';
import { POST_TYPE } from '../../constants/domain';
import { formatCount, timeAgo } from '../../utils/format';
import s from './FeedPostCard.module.css';

// Khoi's code (06/11/2026): phát video ngay trong thẻ; thẻ khác bắt đầu phát thì thẻ này tự dừng (1 video một lúc).
const PLAY_EVENT = 'gb-feed-video-play';

/**
 * Thẻ bài của Bảng tin.
 * Khoi's code 01/11/2026: giao diện theo prototype v4 (src/v4/components/PostCard.jsx) — kiểu Facebook / X:
 *   tác giả → tiêu đề + trích đoạn → chủ đề → ẢNH TRÀN THẺ → số liệu (tim · bình luận) → hàng nút Thích · Bình luận.
 *   Bỏ hiệu ứng loé sáng (GlareHover) và tia lá (ClickSpark) của bản v2; tim chỉ nảy nhẹ khi Thích.
 * Component KHÔNG gọi API: trang truyền dữ liệu + hàm xử lý. Props giữ nguyên như bản v2.
 *
 * @param {'blog'|'video'} postType
 * @param {string} title · @param {string} [excerpt]
 * @param {string} href                 link tới bài, vd `#bai-12`
 * @param {string} [thumbnailUrl]       ảnh bài blog
 * @param {string} [youtubeVideoId]     bài video → tự lấy ảnh bìa YouTube
 * @param {{name, avatarUrl?}} author
 * @param {string} createdAt            ISO, hiện "2 giờ trước"
 * @param {{id, name}[]} [categories]   chủ đề, hiện tối đa 3 + "+N"
 * @param {(topic: {id, name}) => void} [onTopicClick]  có → bấm chip chủ đề để lọc Bảng tin
 * @param {number} voteCount · commentCount · @param {boolean} voted
 * @param {boolean} [reported]          người xem đã báo cáo → menu hiện "Đã báo cáo" (không bấm được)
 * @param {() => void} onVote · onOpen · onComment
 * @param {() => void} [onReport]       không truyền (vd bài của mình) → không có menu báo cáo
 */
export default function FeedPostCard({
  postType = 'blog', title, excerpt, href = '#', thumbnailUrl, youtubeVideoId, author = {}, createdAt, categories = [],
  voteCount = 0, commentCount = 0, voted = false, reported = false,
  onVote, onOpen, onComment, onReport, onTopicClick,
}) {
  const type = POST_TYPE[postType] ?? POST_TYPE.blog;
  const cover = postType === 'video' && youtubeVideoId
    ? `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`
    : thumbnailUrl;
  // Giữ thẻ <a> (Ctrl+click, trình đọc màn hình vẫn đúng) nhưng mở bài tại chỗ
  const open = (e) => { e.preventDefault(); onOpen?.(); };
  const inlineVideo = postType === 'video' && Boolean(youtubeVideoId);
  const [playing, setPlaying] = useState(false);
  const [token] = useState(() => ({}));
  useEffect(() => {
    if (!playing) return undefined;
    const stop = (event) => { if (event.detail !== token) setPlaying(false); };
    window.addEventListener(PLAY_EVENT, stop);
    return () => window.removeEventListener(PLAY_EVENT, stop);
  }, [playing, token]);
  const play = () => {
    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: token }));
    setPlaying(true);
  };

  const menuItems = reported
    ? [{ icon: 'flag-fill', label: 'Đã báo cáo', hint: 'Admin đang xem xét', disabled: true }]
    : onReport ? [{ icon: 'flag', label: 'Báo cáo bài viết', hint: 'Gửi cho Admin xem xét', tone: 'alert', onClick: onReport }] : [];

  return (
    <article className={s.card}>
      <header className={s.head}>
        <Avatar name={author.name} src={author.avatarUrl} size={44} />
        <div className={s.who}>
          <b>{author.name}</b>
          <small>
            <time dateTime={createdAt}>{timeAgo(createdAt)}</time>
            <span aria-hidden="true">·</span>
            <i className={`bi bi-${type.icon}`} aria-hidden="true" />
            {type.label}
          </small>
        </div>
        {menuItems.length > 0 && (
          <Menu
            items={menuItems}
            renderTrigger={(p) => (
              <button type="button" className={s.more} aria-label="Tuỳ chọn bài viết" {...p}>
                <i className="bi bi-three-dots" aria-hidden="true" />
              </button>
            )}
          />
        )}
      </header>

      <div className={s.content}>
        <h2 className={s.title}><a href={href} onClick={open}>{title}</a></h2>
        {excerpt && <p className={s.excerpt}>{excerpt}</p>}
      </div>

      {categories.length > 0 && (
        // Chủ đề = chip có icon dấu trang (không dùng "#" → không nhầm hashtag); bấm → lọc Bảng tin theo chủ đề đó
        <div className={s.topics} aria-label="Chủ đề">
          {categories.slice(0, 3).map((c) => (onTopicClick ? (
            <button key={c.id} type="button" className={cx(s.topic, s.topicBtn)} onClick={() => onTopicClick(c)} aria-label={`Xem bài cùng chủ đề ${c.name}`}>
              <i className="bi bi-bookmark" aria-hidden="true" />{c.name}
            </button>
          ) : (
            <span key={c.id} className={s.topic}><i className="bi bi-bookmark" aria-hidden="true" />{c.name}</span>
          )))}
          {categories.length > 3 && (
            <span className={cx(s.topic, s.topicMore)} title={categories.slice(3).map((c) => c.name).join(', ')}>+{categories.length - 3}</span>
          )}
        </div>
      )}

      {inlineVideo && (playing ? (
        <div className={s.player}>
          <YouTubeEmbed videoId={youtubeVideoId} title={title} autoLoad shape="none" />
        </div>
      ) : (
        <button type="button" className={cx(s.media, s.mediaBtn)} onClick={play} aria-label={`Phát video: ${title}`}>
          <Photo src={cover} alt="" ratio="16/9" />
          <span className={s.play} aria-hidden="true"><i className="bi bi-play-fill" /></span>
        </button>
      ))}
      {cover && !inlineVideo && (
        <a href={href} onClick={open} className={s.media} tabIndex={-1} aria-hidden="true">
          <Photo src={cover} alt="" ratio="16/9" />
          {postType === 'video' && <span className={s.play}><i className="bi bi-play-fill" /></span>}
        </a>
      )}

      <div className={s.stats}>
        {voteCount > 0 ? (
          <span className={s.voters}>
            <span className={s.hearts} aria-hidden="true"><i className="bi bi-heart-fill" /></span>
            {voted ? (voteCount > 1 ? `Bạn và ${formatCount(voteCount - 1)} người khác` : 'Bạn') : formatCount(voteCount)}
          </span>
        ) : <span>Hãy là người đầu tiên thích</span>}
        <button type="button" className={s.comments} onClick={onComment}>{formatCount(commentCount)} bình luận</button>
      </div>

      <footer className={s.bar}>
        <button
          type="button"
          className={cx(s.act, voted && s.liked)}
          aria-pressed={voted}
          aria-label={`${voted ? 'Bỏ thích' : 'Thích'} (${voteCount} lượt thích)`}
          onClick={onVote}
        >
          <i className={`bi bi-heart${voted ? '-fill' : ''}`} aria-hidden="true" />
          <span>Thích</span>
        </button>
        <button type="button" className={s.act} onClick={onComment} aria-label={`Bình luận (${commentCount})`}>
          <i className="bi bi-chat" aria-hidden="true" />
          <span>Bình luận</span>
        </button>
      </footer>
    </article>
  );
}
