import cx from '../cx';
import styles from './Spinner.module.css';

/**
 * Vòng xoay đang tải.
 * Dùng cho: nút đang gửi (Button tự dùng khi loading), chờ AI trả lời, tải danh sách.
 *
 * @param {'sm'|'md'|'lg'} [size='md']  16 · 24 · 40 px
 * @param {string|null} [label='Đang tải']  đọc cho trình đọc màn hình; null = trang trí (đã có chữ khác bên cạnh)
 * @param {boolean} [showLabel]  hiện chữ bên cạnh vòng xoay
 */
export default function Spinner({ size = 'md', label = 'Đang tải', showLabel = false, className }) {
  return (
    <span
      className={cx(styles.wrap, className)}
      role={label ? 'status' : undefined}
      aria-hidden={label ? undefined : true}
    >
      <span className={cx(styles.ring, styles[size])} />
      {label && (showLabel ? <span className={styles.text}>{label}</span> : <span className="visually-hidden">{label}</span>)}
    </span>
  );
}
