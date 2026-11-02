// Khoi's code: Ô "đăng nhanh" đầu Bảng tin.
// 01/11/2026: theo prototype v4 (src/v4/components/Composer.jsx) — KHÔNG có nút "Đăng" riêng.
// Bấm vào đâu cũng mở hộp Đăng bài đầy đủ (FeedComposeDialog), chỉ khác loại bài mở sẵn:
//   ô chữ → Blog · icon Ảnh → Blog, cuộn tới ô Ảnh bìa · icon Camera → Video
// (vẫn không đăng tại chỗ vì bài phải có tiêu đề, nội dung, chủ đề — D-11, D-12).
import Avatar from '../Avatar/Avatar';
import s from './FeedComposer.module.css';

/**
 * @param {{name, avatarUrl?}} user
 * @param {(opts: {type: 'blog'|'video', focus?: 'cover'}) => void} onCompose
 */
export default function FeedComposer({ user, onCompose }) {
  const first = (user?.name ?? '').trim().split(/\s+/).pop() || 'Bạn';
  return (
    <section className={s.card} aria-label="Soạn bài mới">
      <Avatar name={user?.name} src={user?.avatarUrl} size={40} />
      <button type="button" className={s.ph} onClick={() => onCompose({ type: 'blog' })}>
        <span className={s.long}>{first} ơi, hôm nay bạn nấu món chay gì?</span>
        <span className={s.short}>Bạn nấu món chay gì?</span>
      </button>
      <span className={s.sep} aria-hidden="true" />
      <button type="button" className={`${s.ic} ${s.photo}`} onClick={() => onCompose({ type: 'blog', focus: 'cover' })} aria-label="Viết bài kèm ảnh" title="Viết bài kèm ảnh">
        <i className="bi bi-image" aria-hidden="true" />
      </button>
      <button type="button" className={`${s.ic} ${s.video}`} onClick={() => onCompose({ type: 'video' })} aria-label="Đăng bài video" title="Đăng bài video">
        <i className="bi bi-camera-video" aria-hidden="true" />
      </button>
    </section>
  );
}
