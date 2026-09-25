import { Children, useEffect, useRef } from 'react';
import cx from '../cx';
import styles from './ChatThread.module.css';

/**
 * Khung cuộn chứa các ChatBubble. Tự cuộn xuống cuối khi có tin mới
 * (nếu người dùng đang đọc tin cũ ở trên thì KHÔNG giật xuống).
 * Trống → hiện `empty` (thường là lời chào + PromptChip gợi ý).
 *
 * @param {React.ReactNode} children   các <ChatBubble />
 * @param {React.ReactNode} [empty]    nội dung khi chưa có tin
 * @param {string} [label='Cuộc trò chuyện với Mầm']
 */
export default function ChatThread({ children, empty, label = 'Cuộc trò chuyện với Mầm', className }) {
  const ref = useRef(null);
  const nearBottom = useRef(true);
  const count = Children.count(children);

  useEffect(() => {
    const el = ref.current;
    if (el && nearBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [count, children]);

  return (
    <div
      ref={ref}
      className={cx(styles.thread, className)}
      role="log"
      aria-live="polite"
      aria-label={label}
      tabIndex={0}
      onScroll={(e) => {
        const el = e.currentTarget;
        nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
    >
      {count === 0 ? <div className={styles.empty}>{empty}</div> : <div className={styles.list}>{children}</div>}
    </div>
  );
}
