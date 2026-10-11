// Khoi's code: Ô "đăng nhanh" đầu Bảng tin — theo prototype UI v2 (QuickComposer trong src/v2/components/Hero.jsx).
// Chỉ là 1 nút: bấm vào mở hộp Đăng bài ĐẦY ĐỦ (CreatePostModal), không đăng tại chỗ
// vì bài phải có nội dung (D-11) — quyết định 09/10/2026.
import Avatar from '../Avatar/Avatar';
import s from './FeedComposer.module.css';

/** @param {{name, avatarUrl?}} user · @param {() => void} onCompose */
export default function FeedComposer({ user, onCompose }) {
  return (
    <button type="button" className={s.composer} onClick={onCompose}>
      <Avatar name={user.name} src={user.avatarUrl} size={36} />
      <span className={s.placeholder}>Chia sẻ món chay hôm nay của bạn…</span>
      <span className={s.tools} aria-hidden="true">
        <i className="bi bi-image" />
        <i className="bi bi-youtube" />
      </span>
      <span className={s.post}>Đăng <i className="bi bi-arrow-up-right" aria-hidden="true" /></span>
    </button>
  );
}
