import { useEffect, useRef, useState } from 'react';
import Field, { useFieldId } from '../Field/Field';
import Photo from '../Photo/Photo';
import cx from '../cx';
import styles from './ImageUpload.module.css';

const TYPE_LABEL = { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WEBP' };

/**
 * Chọn / kéo thả ảnh, xem trước, thanh tiến độ, báo lỗi, thử lại.
 * Component KHÔNG biết ảnh lên cloud nào: trang truyền vào hàm `onUpload`.
 * Database chỉ lưu link ảnh (string) mà onUpload trả về.
 *
 * @param {string|string[]} value   link ảnh đã có (1 link, hoặc mảng khi multiple)
 * @param {(value: string|string[]) => void} onChange  nhận link mới (hoặc mảng link)
 * @param {(file: File, opts: {onProgress: (percent: number) => void, signal: AbortSignal}) => Promise<string>} onUpload
 *        Tải 1 file lên, trả về link ảnh. Ví dụ Cloudinary xem .claude/skills/an-chay-ui/components/ImageUpload.md
 * @param {boolean} [multiple=false]  nhiều ảnh (ảnh bài blog)
 * @param {number} [max]              tối đa bao nhiêu ảnh (mặc định 1, hoặc 5 khi multiple)
 * @param {number} [maxSizeMB=5]
 * @param {string} [accept='image/jpeg,image/png,image/webp']
 * @param {'1/1'|'4/3'|'16/9'} [ratio='4/3']  tỉ lệ khung xem trước
 * @param {string} [label] · [hint] · [error] · [required] · [disabled]
 */
export default function ImageUpload({
  label, value, onChange, onUpload, multiple = false, max, maxSizeMB = 5,
  accept = 'image/jpeg,image/png,image/webp', ratio = '4/3', hint, error, required, disabled, id, className,
}) {
  const limit = max ?? (multiple ? 5 : 1);
  const urls = multiple ? (value ?? []) : (value ? [value] : []);
  const [pending, setPending] = useState([]); // { key, name, preview, progress, status: 'uploading'|'error', message, file }
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const controllers = useRef(new Map());
  const latest = useRef(urls);
  latest.current = urls;
  const { id: fieldId, inputProps } = useFieldId({ id, error, hint });

  // Dọn link xem trước và huỷ upload dở khi rời trang
  useEffect(() => () => {
    controllers.current.forEach((c) => c.abort());
  }, []);

  const typeNames = accept.split(',').map((t) => TYPE_LABEL[t.trim()] ?? t.trim()).join(', ');
  const autoHint = `${typeNames}, tối đa ${maxSizeMB}MB${limit > 1 ? `, tối đa ${limit} ảnh` : ''}`;
  const slotsLeft = limit - urls.length - pending.filter((p) => p.status === 'uploading').length;

  const patch = (key, data) => setPending((list) => list.map((p) => (p.key === key ? { ...p, ...data } : p)));
  const drop = (key) => {
    setPending((list) => {
      const item = list.find((p) => p.key === key);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return list.filter((p) => p.key !== key);
    });
    controllers.current.get(key)?.abort();
    controllers.current.delete(key);
  };

  const upload = async (key, file) => {
    const ctrl = new AbortController();
    controllers.current.set(key, ctrl);
    patch(key, { status: 'uploading', progress: 0, message: undefined });
    try {
      let url;
      if (onUpload) {
        url = await onUpload(file, { onProgress: (p) => patch(key, { progress: Math.round(p) }), signal: ctrl.signal });
      } else {
        if (import.meta.env?.DEV) console.warn('[ImageUpload] Chưa truyền onUpload → dùng link tạm của trình duyệt (chỉ để thử).');
        url = URL.createObjectURL(file);
      }
      if (ctrl.signal.aborted) return;
      const next = multiple ? [...latest.current, url] : url;
      latest.current = multiple ? next : [url]; // 2 ảnh xong cùng lúc không đè nhau
      onChange?.(next);
      drop(key);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      patch(key, { status: 'error', message: err?.message || 'Tải ảnh lên không thành công' });
    }
  };

  const pick = (fileList) => {
    const files = [...fileList];
    if (!files.length) return;
    if (!multiple) {
      // Chế độ 1 ảnh: ảnh mới thay ảnh cũ
      pending.forEach((p) => drop(p.key));
    }
    const room = multiple ? slotsLeft : 1;
    files.slice(0, Math.max(room, 0)).forEach((file) => {
      const key = Math.random().toString(36).slice(2);
      const isImage = file.type.startsWith('image/');
      const item = { key, name: file.name, preview: isImage ? URL.createObjectURL(file) : null, file };
      if (!accept.split(',').map((t) => t.trim()).includes(file.type)) {
        setPending((l) => [...l, { ...item, status: 'error', message: `Chỉ nhận ảnh ${typeNames}` }]);
      } else if (file.size > maxSizeMB * 1024 * 1024) {
        setPending((l) => [...l, { ...item, status: 'error', message: `Ảnh lớn hơn ${maxSizeMB}MB (${(file.size / 1048576).toFixed(1)}MB)` }]);
      } else {
        setPending((l) => [...l, { ...item, status: 'uploading', progress: 0 }]);
        upload(key, file);
      }
    });
  };

  const removeUrl = (url) => onChange?.(multiple ? urls.filter((u) => u !== url) : '');

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (!disabled) pick(e.dataTransfer.files);
  };

  const canAdd = !disabled && (multiple ? slotsLeft > 0 : true);
  const single = !multiple;
  const showDrop = multiple ? canAdd : urls.length === 0 && pending.length === 0;

  return (
    <Field id={fieldId} label={label} hint={hint ?? autoHint} error={error} required={required} className={className}>
      <input
        ref={inputRef}
        {...inputProps}
        type="file"
        accept={accept}
        multiple={multiple}
        className="visually-hidden"
        tabIndex={-1}
        onChange={(e) => { pick(e.target.files); e.target.value = ''; }}
      />

      <div className={cx(styles.grid, single && styles.single)}>
        {(single && pending.length ? [] : urls).map((url, i) => (
          <figure key={url} className={styles.item} style={{ aspectRatio: ratio }}>
            <Photo src={url} alt={`Ảnh ${i + 1}`} className={styles.img} />
            {!disabled && (
              <div className={styles.tools}>
                {single && (
                  <button type="button" className={styles.tool} onClick={() => inputRef.current?.click()} aria-label="Đổi ảnh">
                    <i className="bi bi-arrow-repeat" aria-hidden="true" />
                  </button>
                )}
                <button type="button" className={styles.tool} onClick={() => removeUrl(url)} aria-label={`Xoá ảnh ${i + 1}`}>
                  <i className="bi bi-trash3" aria-hidden="true" />
                </button>
              </div>
            )}
          </figure>
        ))}

        {pending.map((p) => (
          <figure key={p.key} className={cx(styles.item, p.status === 'error' && styles.failed)} style={{ aspectRatio: ratio }}>
            {p.preview && <img src={p.preview} alt="" className={cx(styles.img, styles.dim)} />}
            {p.status === 'uploading' ? (
              <div className={styles.overlay} role="status">
                <span className={styles.percent}>{p.progress ?? 0}%</span>
                <span className={styles.bar}><span style={{ width: `${p.progress ?? 0}%` }} /></span>
                <button type="button" className={styles.link} onClick={() => drop(p.key)}>Huỷ</button>
              </div>
            ) : (
              <div className={styles.overlay} role="alert">
                <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
                <span className={styles.msg}>{p.message}</span>
                <span className={styles.actions}>
                  {onUpload && p.file && !/Chỉ nhận|lớn hơn/.test(p.message) && (
                    <button type="button" className={styles.link} onClick={() => upload(p.key, p.file)}>Thử lại</button>
                  )}
                  <button type="button" className={styles.link} onClick={() => drop(p.key)}>Bỏ</button>
                </span>
              </div>
            )}
          </figure>
        ))}

        {showDrop && (
          <button
            type="button"
            className={cx(styles.drop, dragOver && styles.over, error && styles.invalid)}
            style={{ aspectRatio: single ? ratio : '1/1' }}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            disabled={disabled}
            aria-describedby={inputProps['aria-describedby']}
          >
            <i className="bi bi-image" aria-hidden="true" />
            <b>{multiple ? 'Thêm ảnh' : 'Chọn ảnh'}</b>
            <span>hoặc kéo thả vào đây</span>
          </button>
        )}
      </div>
    </Field>
  );
}
