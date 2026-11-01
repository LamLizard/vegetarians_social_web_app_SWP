// Khoi's code (01/11/2026): ô Ảnh bìa của hộp Đăng bài Bảng tin — giao diện theo prototype v4 (khung kéo thả rộng 16:6,
// ảnh đã chọn hiện 16:9 với nút "Đổi ảnh" / "Bỏ ảnh"). Chức năng giữ như ImageUpload (dùng chung, không sửa):
// chỉ nhận JPG/PNG/WEBP ≤ 5MB, tải lên qua onUpload (có % tiến độ, Huỷ), lỗi mạng → Thử lại / Bỏ.
import { useEffect, useRef, useState } from 'react';
import Photo from '../Photo/Photo';
import cx from '../cx';
import s from './FeedComposeDialog.module.css';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 5;

/**
 * @param {string} value   link ảnh đã tải ('' = chưa có)
 * @param {(url: string) => void} onChange
 * @param {(file: File, opts: {onProgress, signal}) => Promise<string>} onUpload
 * @param {string} hint · @param {boolean} [disabled]
 */
export default function CoverUpload({ value, onChange, onUpload, hint, disabled }) {
  const [pending, setPending] = useState(null); // { file, preview, status: 'uploading'|'error', progress, message, canRetry }
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const ctrlRef = useRef(null);

  // Rời hộp / huỷ: dừng upload dở, thu hồi link xem trước
  useEffect(() => () => ctrlRef.current?.abort(), []);
  useEffect(() => () => { if (pending?.preview) URL.revokeObjectURL(pending.preview); }, [pending?.preview]);

  const cancel = () => { ctrlRef.current?.abort(); ctrlRef.current = null; setPending(null); };

  const upload = async (file, preview) => {
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setPending({ file, preview, status: 'uploading', progress: 0 });
    try {
      const url = await onUpload(file, {
        onProgress: (p) => setPending((cur) => (cur && cur.file === file ? { ...cur, progress: Math.round(p) } : cur)),
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      onChange(url);
      setPending(null);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setPending({ file, preview, status: 'error', message: err?.message || 'Tải ảnh lên không thành công', canRetry: true });
    }
  };

  const pick = (file) => {
    if (!file || disabled) return;
    ctrlRef.current?.abort();
    const preview = URL.createObjectURL(file);
    if (!ACCEPT.includes(file.type)) {
      setPending({ file, preview, status: 'error', message: 'Chỉ nhận ảnh JPG, PNG hoặc WEBP.' });
    } else if (file.size > MAX_MB * 1024 * 1024) {
      setPending({ file, preview, status: 'error', message: `Ảnh lớn hơn ${MAX_MB}MB (${(file.size / 1048576).toFixed(1)}MB), chọn ảnh nhỏ hơn nhé.` });
    } else {
      upload(file, preview);
    }
  };

  const shown = pending?.preview || value;

  return (
    <div className={s.block}>
      <span className={s.label}>Ảnh bìa <small>không bắt buộc</small></span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(',')}
        className="visually-hidden"
        tabIndex={-1}
        aria-label="Chọn ảnh bìa"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }}
      />
      {shown ? (
        <div className={s.coverPreview}>
          {pending ? <img src={pending.preview} alt="" className={s.coverDim} /> : <Photo src={value} alt="Ảnh bìa đã chọn" ratio="16/9" />}
          {pending?.status === 'uploading' && (
            <div className={s.coverOverlay} role="status">
              <b>{pending.progress ?? 0}%</b>
              <span className={s.coverBar}><span style={{ width: `${pending.progress ?? 0}%` }} /></span>
              <button type="button" onClick={cancel}>Huỷ</button>
            </div>
          )}
          {pending?.status === 'error' && (
            <div className={cx(s.coverOverlay, s.coverFailed)} role="alert">
              <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
              <span>{pending.message}</span>
              <span className={s.coverOverlayActions}>
                {pending.canRetry && <button type="button" onClick={() => upload(pending.file, pending.preview)}>Thử lại</button>}
                <button type="button" onClick={cancel}>Bỏ</button>
              </span>
            </div>
          )}
          {!pending && !disabled && (
            <div className={s.coverActions}>
              <button type="button" onClick={() => inputRef.current?.click()}><i className="bi bi-arrow-repeat" aria-hidden="true" /> Đổi ảnh</button>
              <button type="button" onClick={() => onChange('')}><i className="bi bi-trash3" aria-hidden="true" /> Bỏ ảnh</button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          className={cx(s.drop, dragging && s.dropOn)}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
          disabled={disabled}
        >
          <i className="bi bi-image" aria-hidden="true" />
          <b>Kéo ảnh vào đây hoặc bấm để chọn</b>
          <small>{hint}</small>
        </button>
      )}
    </div>
  );
}
