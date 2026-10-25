import cx from '../cx';
import { formatCount } from '../../utils/format';
import styles from './VoteButton.module.css';

/**
 * Nút bình chọn một chiều cho bài (post_vote): bấm để thích, bấm lại để bỏ (UC-06, FR-08).
 * Component chỉ hiển thị. Trang gọi API rồi cập nhật voted + count (nên cập nhật ngay trước, lỗi thì trả lại).
 *
 * @param {boolean} voted   tài khoản hiện tại đã bình chọn chưa
 * @param {number} count    tổng lượt bình chọn
 * @param {() => void} onToggle
 *        Khách chưa đăng nhập: trang mở LoginPrompt thay vì gọi API.
 * @param {'sm'|'md'} [size='md']
 * @param {boolean} [disabled]  vd bài đang chờ duyệt
 * @param {string} [noun='bài viết']  Khoi's code: đọc cho trình đọc màn hình, vd 'công thức'
 */
export default function VoteButton({ voted = false, count = 0, onToggle, size = 'md', disabled, noun = 'bài viết', className }) {
  return (
    <button
      type="button"
      className={cx(styles.vote, voted && styles.on, size === 'sm' && styles.sm, className)}
      aria-pressed={voted}
      aria-label={`${voted ? 'Bỏ thích' : 'Thích'} ${noun}, ${count} lượt thích`}
      onClick={onToggle}
      disabled={disabled}
    >
      <i className={`bi bi-${voted ? 'hand-thumbs-up-fill' : 'hand-thumbs-up'}`} aria-hidden="true" />
      <span className={styles.count} aria-hidden="true">{formatCount(count)}</span>
    </button>
  );
}
