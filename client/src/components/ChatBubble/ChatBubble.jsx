import cx from '../cx';
import { getLink } from '../link';
import { AI_NAME } from '../../constants/domain';
import RichText from './richText';
import styles from './ChatBubble.module.css';

const hhmm = (t) => {
  if (!t) return '';
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? String(t) : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

/**
 * 1 tin nhắn trong khung chat với trợ lý Mầm (M-12). Khớp bảng chat_message.
 *
 * @param {'user'|'bot'|'system'} sender       chat_message.sender. system = dòng thông báo giữa khung
 * @param {'ok'|'filtered'|'error'} [status='ok']  chat_message.status
 *        filtered: câu hỏi bị lọc từ khoá · error: gọi AI lỗi, KHÔNG trừ lượt (FR-15) → hiện nút Thử lại
 * @param {string} [content]                   chat_message.content. Tin của bot hiểu **đậm**, gạch đầu dòng "- ", "1."
 * @param {string} [time]                      ISO hoặc "19:02"
 * @param {boolean} [typing]                   bot đang trả lời → 3 chấm nhảy (bỏ qua content)
 * @param {{title: string, href: string}} [refPost] · [linkAs]  chat_message.ref_post_id → thẻ "Bài liên quan"
 * @param {() => void} [onRetry]
 */
export default function ChatBubble({
  sender = 'bot', status = 'ok', content, time, typing = false, refPost, linkAs, onRetry, className, children,
}) {
  const body = children ?? content;

  if (sender === 'system') {
    return <div className={cx(styles.system, className)} role="note">{body}</div>;
  }

  const isUser = sender === 'user';
  const problem = status === 'filtered' || status === 'error';
  const [Link, linkProps] = getLink(linkAs, refPost?.href);

  return (
    <div className={cx(styles.row, isUser && styles.rowUser, className)}>
      {!isUser && <span className={styles.mark} aria-hidden="true"><i className="bi bi-flower1" /></span>}
      <div className={styles.col}>
        <span className="visually-hidden">{isUser ? 'Bạn' : AI_NAME} nói: </span>
        <div className={cx(styles.bubble, isUser ? styles.user : styles.bot, problem && styles.problem)} aria-busy={typing || undefined}>
          {status === 'filtered' && (
            <span className={styles.flag}><i className="bi bi-shield-exclamation" aria-hidden="true" /> Nội dung có từ ngữ không phù hợp nên chưa được gửi cho {AI_NAME}</span>
          )}
          {status === 'error' && (
            <span className={styles.flag}><i className="bi bi-exclamation-circle" aria-hidden="true" /> {AI_NAME} đang gặp lỗi, lượt hỏi không bị trừ</span>
          )}
          {typing ? (
            <span className={styles.typing} aria-label={`${AI_NAME} đang trả lời`}><i /><i /><i /></span>
          ) : isUser || typeof body !== 'string' ? (
            <div className={styles.text}>{body}</div>
          ) : (
            <div className={cx(styles.text, styles.rich)}><RichText text={body} /></div>
          )}
          {refPost && !typing && (
            <Link {...linkProps} className={styles.ref}>
              <i className="bi bi-journal-text" aria-hidden="true" />
              <span><small>Bài liên quan</small>{refPost.title}</span>
              <i className="bi bi-chevron-right" aria-hidden="true" />
            </Link>
          )}
        </div>
        {(time || (status === 'error' && onRetry)) && !typing && (
          <div className={styles.meta}>
            {time && <time dateTime={time}>{hhmm(time)}</time>}
            {status === 'error' && onRetry && (
              <button type="button" className={styles.retry} onClick={onRetry}><i className="bi bi-arrow-clockwise" aria-hidden="true" /> Thử lại</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
