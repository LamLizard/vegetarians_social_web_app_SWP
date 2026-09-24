import { useId, useState } from 'react';
import Avatar from '../Avatar/Avatar';
import Button from '../Button/Button';
import cx from '../cx';
import styles from './Comment.module.css';

/**
 * Ô viết bình luận. Gửi xong tự xoá trắng. Ctrl + Enter để gửi nhanh.
 *
 * @param {{name: string, avatarUrl?: string}} [currentUser]  không có → coi là khách
 * @param {(content: string) => Promise<void>} onSubmit
 *        Ném lỗi (throw new Error('Bình luận chứa từ ngữ không phù hợp')) → hiện câu lỗi, giữ nguyên nội dung
 * @param {() => void} [onRequireLogin]   khách bấm vào ô → mở LoginPrompt
 * @param {number} [maxLength=1000]
 * @param {string} [placeholder='Viết bình luận...']
 */
export default function CommentComposer({
  currentUser, onSubmit, onRequireLogin, maxLength = 1000, placeholder = 'Viết bình luận...', className,
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const id = useId();

  if (!currentUser) {
    return (
      <div className={cx(styles.composer, styles.guest, className)}>
        <span><i className="bi bi-chat-dots" aria-hidden="true" /> Đăng nhập để bình luận và bình chọn bài viết.</span>
        <Button size="sm" variant="outline" onClick={onRequireLogin}>Đăng nhập</Button>
      </div>
    );
  }

  const send = async (e) => {
    e?.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');
    try {
      await onSubmit?.(content);
      setText('');
    } catch (err) {
      setError(err?.message || 'Chưa gửi được bình luận, thử lại sau');
    } finally {
      setSending(false);
    }
  };

  return (
    <form className={cx(styles.composer, className)} onSubmit={send}>
      <Avatar src={currentUser.avatarUrl} name={currentUser.name} size={34} />
      <div className={styles.main}>
        <label htmlFor={id} className="visually-hidden">Viết bình luận</label>
        <textarea
          id={id}
          className={cx('form-control', styles.input, error && 'is-invalid')}
          rows={text.includes('\n') || text.length > 60 ? 3 : 1}
          placeholder={placeholder}
          value={text}
          maxLength={maxLength}
          onChange={(e) => { setText(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(e); }}
          disabled={sending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        {error && <div id={`${id}-err`} className={styles.error} role="alert">{error}</div>}
        {text && (
          <div className={styles.composerFoot}>
            <span className={styles.count}>{text.length}/{maxLength} · Ctrl + Enter để gửi</span>
            <Button size="sm" type="submit" icon="send" loading={sending} disabled={!text.trim()}>Gửi</Button>
          </div>
        )}
      </div>
    </form>
  );
}
