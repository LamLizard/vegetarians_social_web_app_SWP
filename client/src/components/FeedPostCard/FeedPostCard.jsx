import ClickSpark from '../reactbits/ClickSpark';
import GlareHover from '../reactbits/GlareHover';
import ColorAvatar from '../ColorAvatar/ColorAvatar';
import Menu from '../Menu/Menu';
import Photo from '../Photo/Photo';
import cx from '../cx';
import { POST_TYPE } from '../../constants/domain';
import { formatCount, timeAgo } from '../../utils/format';
import { useTheme } from '../../utils/theme';
import s from './FeedPostCard.module.css';

/**
 * Thẻ bài của Bảng tin (theo prototype UI v2.1, src/v2/components/PostCard.jsx).
 *  - GlareHover: vệt loé chéo rất nhẹ qua ảnh khi rê chuột
 *  - ClickSpark: bấm Thích → bắn tia lá (màu theo Sáng/Tối)
 *  - Bài không ảnh, không trích đoạn (hỏi nhanh) → tiêu đề to như 1 status
 * Component KHÔNG gọi API: trang truyền dữ liệu + hàm xử lý.
 *
 * @param {'blog'|'video'} postType
 * @param {string} title · @param {string} [excerpt]
 * @param {string} href                 link tới bài, vd `#bai-12`
 * @param {string} [thumbnailUrl]       ảnh bài blog
 * @param {string} [youtubeVideoId]     bài video → tự lấy ảnh bìa YouTube
 * @param {{name, avatarUrl?}} author
 * @param {string} createdAt            ISO, hiện "2 giờ trước"
 * @param {{id, name}[]} [categories]   hiện tối đa 3
 * @param {number} voteCount · commentCount · @param {boolean} voted
 * @param {boolean} [reported]          người xem đã báo cáo → menu hiện "Đã báo cáo" (không bấm được)
 * @param {() => void} onVote · onOpen · onComment
 * @param {() => void} [onReport]       không truyền (vd bài của mình) → không có menu báo cáo
 */
export default function FeedPostCard({
  postType = 'blog', title, excerpt, href = '#', thumbnailUrl, youtubeVideoId, author = {}, createdAt, categories = [],
  voteCount = 0, commentCount = 0, voted = false, reported = false,
  onVote, onOpen, onComment, onReport,
}) {
  const [theme] = useTheme();
  const type = POST_TYPE[postType] ?? POST_TYPE.blog;
  const cover = postType === 'video' && youtubeVideoId
    ? `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`
    : thumbnailUrl;
  const isQuick = !excerpt && !cover;
  // Giữ thẻ <a> (Ctrl+click, trình đọc màn hình vẫn đúng) nhưng mở bài tại chỗ
  const open = (e) => { e.preventDefault(); onOpen?.(); };

  const menuItems = reported
    ? [{ icon: 'flag-fill', label: 'Đã báo cáo', hint: 'Admin đang xem xét', disabled: true }]
    : onReport ? [{ icon: 'flag', label: 'Báo cáo bài viết', hint: 'Gửi cho Admin xem xét', onClick: onReport }] : [];

  return (
    <article className={cx(s.card, isQuick && s.quick)}>
      <header className={s.head}>
        <ColorAvatar name={author.name} src={author.avatarUrl} size={40} />
        <div className={s.who}>
          <b>{author.name}</b>
          <span>
            <time dateTime={createdAt}>{timeAgo(createdAt)}</time>
            <i className={s.dot} aria-hidden="true" />
            <i className={`bi bi-${type.icon}`} aria-hidden="true" /> {type.label}
          </span>
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

      <h2 className={s.title}><a href={href} onClick={open}>{title}</a></h2>
      {excerpt && <p className={s.excerpt}>{excerpt}</p>}

      {categories.length > 0 && (
        <div className={s.tags}>
          {categories.slice(0, 3).map((c) => <span key={c.id} className={s.tag}>#{c.name}</span>)}
          {categories.length > 3 && <span className={s.moreTags}>+{categories.length - 3}</span>}
        </div>
      )}

      {cover && (
        <a href={href} onClick={open} className={s.media} tabIndex={-1} aria-hidden="true">
          <GlareHover
            width="100%"
            height="auto"
            background="transparent"
            borderRadius="18px"
            borderColor="var(--v-line)"
            glareColor="#ffffff"
            glareOpacity={0.14}
            glareAngle={-35}
            glareSize={260}
            transitionDuration={800}
            className={s.glare}
          >
            <Photo src={cover} ratio="16/10" className={s.img} />
            {postType === 'video' && (
              <>
                <span className={s.play}><i className="bi bi-play-fill" /></span>
                <span className={s.badge}><i className="bi bi-youtube" /> Video</span>
              </>
            )}
          </GlareHover>
        </a>
      )}

      <footer className={s.actions}>
        <span className={s.sparkWrap}>
          <ClickSpark sparkColor={theme === 'dark' ? '#9CCB86' : '#3E7A47'} sparkSize={9} sparkRadius={22} sparkCount={10} duration={450}>
            <button
              type="button"
              className={cx(s.act, voted && s.on)}
              aria-pressed={voted}
              aria-label={`${voted ? 'Bỏ thích' : 'Thích'} (${voteCount} lượt thích)`}
              onClick={onVote}
            >
              <i className={`bi bi-${voted ? 'heart-fill' : 'heart'}`} aria-hidden="true" />
              <span className={s.label}>Thích</span>
              <span className={s.n}>{formatCount(voteCount)}</span>
            </button>
          </ClickSpark>
        </span>
        <button type="button" className={s.act} onClick={onComment} aria-label={`Bình luận (${commentCount})`}>
          <i className="bi bi-chat" aria-hidden="true" />
          <span className={s.label}>Bình luận</span>
          <span className={s.n}>{formatCount(commentCount)}</span>
        </button>
      </footer>
    </article>
  );
}
