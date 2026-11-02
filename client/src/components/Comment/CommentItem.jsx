import { useState } from 'react';
import Avatar from '../Avatar/Avatar';
import Button from '../Button/Button';
import IconButton from '../IconButton/IconButton';
import Menu from '../Menu/Menu';
import cx from '../cx';
import { timeAgo } from '../../utils/format';
import styles from './Comment.module.css';

/**
 * 1 bình luận. Bình luận phẳng, KHÔNG có trả lời lồng nhau (nhóm đã chốt).
 * Chủ bình luận: menu Sửa / Xoá, sửa ngay tại chỗ. Người khác: menu Báo cáo.
 * Thường không dùng lẻ: CommentSection đã ghép sẵn danh sách + ô viết + hộp xác nhận xoá.
 *
 * @param {{name: string, avatarUrl?: string}} author
 * @param {string} content
 * @param {string} createdAt          ISO
 * @param {boolean} [edited]          đã sửa → hiện "(đã sửa)"
 * @param {'public'|'hidden'|'deleted'} [status='public']  hidden/deleted → chỉ hiện dòng thông báo
 * @param {boolean} [isOwner]
 * @param {(content: string) => Promise<void>} [onSave]  lưu nội dung sửa. Ném lỗi (throw) → hiện câu lỗi dưới ô
 * @param {() => void} [onDelete] · [onReport]
 * @param {number} [maxLength=1000]
 */
export default function CommentItem({
  author = {}, content, createdAt, edited = false, status = 'public', isOwner = false,
  onSave, onDelete, onReport, maxLength = 1000, className,
  moderation, // Tùng: I-AI-01 — chỉ nhánh refusal của chính tác giả nhận reason/warnings từ server.
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Tùng: nhánh mới trước placeholder cũ; không có menu sửa/xóa/report cho refusal.
  if (status === 'hidden' && isOwner && moderation?.outcome === 'rejected') {
    return (
      <div className={cx(styles.item, styles.rejected, className)}>
        <Avatar src={author.avatarUrl} name={author.name} size={34} />
        <div className={styles.main}>
          <div className={styles.rejectedBubble}>
            <div className={styles.head}>
              <b>{author.name}</b>
              <span>Đã từ chối · Chỉ bạn nhìn thấy</span>
              <time dateTime={createdAt}>{timeAgo(createdAt)}</time>
            </div>
            <p className={styles.text}>{content}</p>
            <p className={styles.moderationReason}>{moderation.reason}</p>
          </div>
          {moderation.warnings?.map((warning) => (
            <p key={warning.code} className={styles.animalWarning}>{warning.message}</p>
          ))}
        </div>
      </div>
    );
  }

  if (status !== 'public') {
    return (
      <div className={cx(styles.item, styles.removed, className)}>
        <i className={`bi bi-${status === 'hidden' ? 'eye-slash' : 'trash3'}`} aria-hidden="true" />
        {status === 'hidden' ? 'Bình luận đã bị ẩn do vi phạm quy định cộng đồng.' : 'Bình luận đã bị xoá.'}
      </div>
    );
  }

  const save = async () => {
    const text = draft.trim();
    if (!text) { setError('Bình luận không được để trống'); return; }
    if (text === content) { setEditing(false); return; }
    setSaving(true);
    setError('');
    try {
      await onSave?.(text);
      setEditing(false);
    } catch (err) {
      setError(err?.message || 'Chưa lưu được, thử lại sau');
    } finally {
      setSaving(false);
    }
  };

  const items = isOwner
    ? [
      onSave && { icon: 'pencil', label: 'Sửa', onClick: () => { setDraft(content); setEditing(true); } },
      onDelete && { icon: 'trash3', label: 'Xoá', tone: 'alert', onClick: onDelete },
    ].filter(Boolean)
    : [onReport && { icon: 'flag', label: 'Báo cáo bình luận', onClick: onReport }].filter(Boolean);

  return (
    <div className={cx(styles.item, className)}>
      <Avatar src={author.avatarUrl} name={author.name} size={34} />
      <div className={styles.main}>
        <div className={styles.bubble}>
          <div className={styles.head}>
            <b>{author.name}</b>
            <time dateTime={createdAt}>{timeAgo(createdAt)}</time>
            {edited && <span>(đã sửa)</span>}
          </div>
          {editing ? (
            <div className={styles.edit}>
              <textarea
                className={cx('form-control', error && 'is-invalid')}
                rows={2}
                value={draft}
                maxLength={maxLength}
                onChange={(e) => { setDraft(e.target.value); setError(''); }}
                aria-label="Sửa bình luận"
                disabled={saving}
                autoFocus
              />
              {error && <div className={styles.error} role="alert">{error}</div>}
              <div className={styles.editActions}>
                <Button size="sm" variant="subtle" onClick={() => { setEditing(false); setError(''); }} disabled={saving}>Huỷ</Button>
                <Button size="sm" onClick={save} loading={saving}>Lưu</Button>
              </div>
            </div>
          ) : (
            <p className={styles.text}>{content}</p>
          )}
        </div>
        {/* Tùng: cảnh báo động vật chỉ cho tác giả, không thay hành vi comment hợp lệ. */}
        {isOwner && moderation?.warnings?.map((warning) => (
          <p key={warning.code} className={styles.animalWarning}>{warning.message}</p>
        ))}
      </div>
      {!editing && items.length > 0 && (
        <Menu
          renderTrigger={(p) => <IconButton icon="three-dots" label="Tuỳ chọn bình luận" variant="ghost" size="sm" {...p} />}
          items={items}
          width={200}
        />
      )}
    </div>
  );
}
