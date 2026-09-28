import { useEffect, useRef, useState } from 'react';
import { IconButton } from '../../../components';
import cx from '../../../components/cx';
import { useChat } from './ChatContext';
import styles from './mam.module.css';

const MAX_HEIGHT = 140;

/** Ô nhập câu hỏi cho Mầm: Enter để gửi, Shift + Enter để xuống dòng. */
export default function MamComposer({ autoFocus = false, className }) {
  const { ask, typing, remaining, limit } = useChat();
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const outOfQuota = remaining <= 0;

  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  // Ô nhập tự cao lên theo nội dung
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }, [text]);

  const submit = (e) => {
    e?.preventDefault();
    if (ask(text)) setText('');
  };

  return (
    <form className={cx(styles.composer, className)} onSubmit={submit}>
      {outOfQuota ? (
        <p className={styles.quotaOut}>
          <i className="bi bi-hourglass-split" aria-hidden="true" />
          Bạn đã dùng hết {limit} lượt hỏi hôm nay. Hẹn gặp lại vào ngày mai nhé!
        </p>
      ) : (
        <div className={styles.inputRow}>
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // isComposing: đang gõ dấu tiếng Việt bằng bộ gõ → chưa gửi
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
            }}
            className={styles.input}
            placeholder="Hỏi Mầm bất cứ điều gì…"
            aria-label="Nhập câu hỏi cho Mầm"
          />
          <IconButton type="submit" icon="arrow-up" label="Gửi câu hỏi" variant="solid" size="sm" disabled={!text.trim() || typing} />
        </div>
      )}
      <p className={styles.composerMeta}>
        Còn <b>{remaining}</b>/{limit} lượt hôm nay · Mầm có thể nhầm, thông tin sức khoẻ chỉ để tham khảo.
      </p>
    </form>
  );
}
