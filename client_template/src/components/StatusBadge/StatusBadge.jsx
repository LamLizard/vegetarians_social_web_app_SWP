import cx from '../cx';
import styles from './StatusBadge.module.css';

// Nhãn tiếng Việt cho các trạng thái trong tài liệu dự án (entity_state_event_reference).
// Luôn có icon + chữ → người mù màu vẫn đọc được.
export const STATUSES = {
  // Bài đăng / công thức / món ăn / nguyên liệu
  draft:    { label: 'Nháp',        tone: 'neutral', icon: 'pencil' },
  pending:  { label: 'Chờ duyệt',   tone: 'warn',    icon: 'hourglass-split' },
  public:   { label: 'Công khai',   tone: 'ok',      icon: 'globe2' },
  rejected: { label: 'Bị từ chối',  tone: 'bad',     icon: 'x-circle' },
  hidden:   { label: 'Đã ẩn',       tone: 'neutral', icon: 'eye-slash' },
  // Quán (vòng đời xác minh)
  pending_verification: { label: 'Chờ xác minh', tone: 'warn', icon: 'hourglass-split' },
  verified: { label: 'Đã xác minh', tone: 'ok',      icon: 'patch-check' },
  // Tài khoản
  active:   { label: 'Hoạt động',   tone: 'ok',      icon: 'check-circle' },
  locked:   { label: 'Bị khoá',     tone: 'bad',     icon: 'lock' },
  // Thực đơn tuần
  saved:    { label: 'Đã lưu',      tone: 'ok',      icon: 'bookmark-check' },
  archived: { label: 'Lưu trữ',     tone: 'neutral', icon: 'archive' },
  // Vi chất
  enough:   { label: 'Đủ',          tone: 'ok',      icon: 'check-lg' },
  low:      { label: 'Hơi thiếu',   tone: 'warn',    icon: 'exclamation-lg' },
  lacking:  { label: 'Thiếu',       tone: 'bad',     icon: 'x-lg' },
};

/**
 * Nhãn trạng thái.
 * @param {keyof STATUSES} status
 * @param {string} label  (tuỳ chọn) ghi đè chữ mặc định
 */
export default function StatusBadge({ status, label, className }) {
  const s = STATUSES[status] ?? { label: status, tone: 'neutral', icon: 'dot' };
  return (
    <span className={cx(styles.badge, styles[s.tone], className)}>
      <i className={`bi bi-${s.icon}`} aria-hidden="true" />
      {label ?? s.label}
    </span>
  );
}
