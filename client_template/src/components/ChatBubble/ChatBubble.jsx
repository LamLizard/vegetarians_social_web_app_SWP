import cx from '../cx';
import styles from './ChatBubble.module.css';

/**
 * Tin nhắn trong trang Trợ lý AI.
 * @param {'user'|'ai'} from
 * @param {'ok'|'filtered'|'error'} status  khớp chat_message trong database:
 *    filtered = bị bộ lọc từ khoá chặn, error = lỗi khi gọi AI (không trừ lượt)
 * @param {string} time  vd "19:02"
 * @param {()=>void} onRetry  hiện nút "Thử lại" khi status = "error"
 */
export default function ChatBubble({ from = 'ai', status = 'ok', time, onRetry, className, children }) {
  const isUser = from === 'user';
  return (
    <div className={cx(styles.row, isUser && styles.rowUser, className)}>
      {!isUser && (
        <span className={styles.aiMark} aria-hidden="true"><i className="bi bi-flower1" /></span>
      )}
      <div className={styles.col}>
        <div className={cx(styles.bubble, isUser ? styles.user : styles.ai, status !== 'ok' && styles.problem)}>
          {status === 'filtered' && (
            <span className={styles.flag}><i className="bi bi-shield-exclamation" aria-hidden="true" /> Nội dung bị lọc</span>
          )}
          {status === 'error' && (
            <span className={styles.flag}><i className="bi bi-exclamation-circle" aria-hidden="true" /> Trợ lý đang gặp lỗi, lượt hỏi không bị trừ</span>
          )}
          {children}
        </div>
        <div className={styles.meta}>
          {time}
          {status === 'error' && onRetry && (
            <button type="button" className={styles.retry} onClick={onRetry}>Thử lại</button>
          )}
        </div>
      </div>
    </div>
  );
}
