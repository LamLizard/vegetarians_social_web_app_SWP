import { useEffect, useId, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';

/**
 * Hộp thoại xác nhận trước hành động khó hoàn tác.
 * Dùng cho: xoá bài / bình luận / công thức, khoá tài khoản, từ chối bài, ẩn nội dung, bác báo cáo.
 *
 * @param {boolean} open
 * @param {string} title             vd "Xoá bài viết này?"
 * @param {React.ReactNode} [message] giải thích hậu quả, vd "Bài sẽ biến mất khỏi trang chủ và kết quả tìm kiếm."
 * @param {string} [confirmLabel='Xác nhận']  ĐỘNG TỪ cụ thể: "Xoá bài", "Khoá tài khoản" (không ghi "OK")
 * @param {string} [cancelLabel='Huỷ']
 * @param {'alert'|'primary'} [tone='alert']  alert = nút đỏ đất (xoá, khoá) · primary = nút xanh (duyệt)
 * @param {boolean} [loading]   đang gửi API → khoá nút, không cho đóng
 * @param {boolean|{label:string, placeholder?:string, required?:boolean}} [reason]
 *        bật ô nhập lý do. Dùng cho Admin từ chối/ẩn/bác (moderation_note, resolution_note).
 *        required=true → không cho xác nhận khi chưa nhập.
 * @param {(reason?: string) => void} onConfirm   nhận lý do (nếu có ô lý do)
 * @param {() => void} onCancel
 *
 * @example
 * <ConfirmDialog
 *   open={rejecting} title="Từ chối bài viết?" confirmLabel="Từ chối"
 *   reason={{ label: 'Lý do từ chối', required: true }}
 *   loading={saving}
 *   onConfirm={(note) => rejectPost(post.id, note)}
 *   onCancel={() => setRejecting(false)}
 * />
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  tone = 'alert',
  loading = false,
  reason,
  onConfirm,
  onCancel,
}) {
  const [text, setText] = useState('');
  const fieldId = useId();
  const reasonCfg = reason === true ? { label: 'Lý do' } : reason || null;
  const missingReason = reasonCfg?.required && !text.trim();

  // Mở lại hộp thoại → ô lý do luôn trống
  useEffect(() => { if (!open) setText(''); }, [open]);

  const close = () => onCancel?.();
  const confirm = () => {
    if (missingReason) return;
    onConfirm?.(reasonCfg ? text.trim() : undefined);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size="sm"
      dismissible={!loading}
      footer={(
        <>
          <Button variant="subtle" onClick={close} disabled={loading}>{cancelLabel}</Button>
          <Button variant={tone} onClick={confirm} loading={loading} disabled={missingReason}>
            {confirmLabel}
          </Button>
        </>
      )}
    >
      {message && <p className="mb-0 text-body-secondary">{message}</p>}
      {reasonCfg && (
        <div className={message ? 'mt-3' : undefined}>
          <label htmlFor={fieldId} className="form-label fw-semibold small mb-1">
            {reasonCfg.label}
            {reasonCfg.required && <span aria-hidden="true"> *</span>}
          </label>
          <textarea
            id={fieldId}
            className="form-control"
            rows={3}
            maxLength={255}
            placeholder={reasonCfg.placeholder ?? 'Người dùng sẽ thấy lý do này trong thông báo'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            required={reasonCfg.required}
            disabled={loading}
          />
          <div className="form-text">{text.length}/255 ký tự</div>
        </div>
      )}
    </Modal>
  );
}
