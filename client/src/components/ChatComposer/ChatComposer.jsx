import { useId, useLayoutEffect, useRef, useState } from 'react';
import Button from '../Button/Button';
import IconButton from '../IconButton/IconButton';
import cx from '../cx';
import { AI_NAME, AI_DISCLAIMER } from '../../constants/domain';
import styles from './ChatComposer.module.css';

/**
 * Ô nhập câu hỏi cho trợ lý Mầm (M-12). Enter để gửi, Shift + Enter để xuống dòng. Tự cao lên tới 6 dòng.
 *
 * Khách dùng thử 3 lượt/ngày (BR-04): truyền `quota` để hiện "Còn 2/3 lượt hôm nay".
 * Hết lượt (`quota.used >= quota.limit`) → ô bị khoá, hiện nút Đăng nhập (gọi onRequireLogin).
 * Thành viên không giới hạn → không truyền quota.
 *
 * @param {(text: string) => Promise<void>|void} onSend  ném lỗi → giữ nguyên chữ để gửi lại
 * @param {boolean} [busy]              đang chờ Mầm trả lời → khoá nút gửi (vẫn gõ được)
 * @param {{used: number, limit: number}} [quota]   daily_quota.chat_turns của khách
 * @param {() => void} [onRequireLogin]
 * @param {boolean} [showDisclaimer=true]  dòng AI_DISCLAIMER (BR-02) dưới ô
 * @param {string} [placeholder] · [maxLength=1000] · [disabled]
 */
export default function ChatComposer({
  onSend, busy = false, quota, onRequireLogin, showDisclaimer = true,
  placeholder = `Hỏi ${AI_NAME} về món chay, thay nguyên liệu, calo...`, maxLength = 1000, disabled = false, className,
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const ref = useRef(null);
  const id = useId();
  const left = quota ? Math.max(0, quota.limit - quota.used) : null;
  const outOfQuota = left === 0;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 6 * 24 + 18)}px`;
  }, [text]);

  const send = async (e) => {
    e?.preventDefault();
    const q = text.trim();
    if (!q || busy || sending || outOfQuota || disabled) return;
    setSending(true);
    setText('');
    try {
      await onSend?.(q);
    } catch {
      setText(q);
    } finally {
      setSending(false);
      ref.current?.focus();
    }
  };

  if (outOfQuota) {
    return (
      <div className={cx(styles.out, className)} role="status">
        <i className="bi bi-hourglass-bottom" aria-hidden="true" />
        <div>
          <b>Bạn đã dùng hết {quota.limit} lượt hỏi thử hôm nay</b>
          <span>Đăng nhập để hỏi {AI_NAME} không giới hạn và lưu lại cuộc trò chuyện.</span>
        </div>
        <Button size="sm" onClick={onRequireLogin}>Đăng nhập</Button>
      </div>
    );
  }

  return (
    <form className={cx(styles.wrap, className)} onSubmit={send}>
      <div className={styles.box}>
        <label htmlFor={id} className="visually-hidden">Câu hỏi cho {AI_NAME}</label>
        <textarea
          ref={ref}
          id={id}
          rows={1}
          className={styles.input}
          value={text}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
          }}
        />
        <IconButton
          type="submit"
          icon="arrow-up"
          variant="solid"
          label="Gửi câu hỏi"
          disabled={!text.trim() || busy || sending || disabled}
          className={styles.send}
        />
      </div>
      <div className={styles.foot}>
        {left != null && (
          <span className={cx(styles.quota, left === 1 && styles.low)}>
            <i className="bi bi-lightning-charge" aria-hidden="true" /> Còn {left}/{quota.limit} lượt hỏi thử hôm nay
          </span>
        )}
        {showDisclaimer && <span className={styles.disclaimer}>{AI_DISCLAIMER}</span>}
      </div>
    </form>
  );
}
