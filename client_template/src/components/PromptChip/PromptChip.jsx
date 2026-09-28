import cx from '../cx';
import styles from './PromptChip.module.css';

/**
 * Câu hỏi gợi ý cho trợ lý AI – bấm vào là gửi câu hỏi đó.
 * @param {string} icon  (tuỳ chọn) tên Bootstrap Icon
 * @param {boolean} block  true → chiếm hết chiều ngang (dùng ở sidebar trang Trợ lý AI)
 */
export default function PromptChip({ icon, block = false, onClick, className, children }) {
  return (
    <button type="button" className={cx(styles.chip, block && styles.block, className)} onClick={onClick}>
      {icon && <i className={`bi bi-${icon}`} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}
