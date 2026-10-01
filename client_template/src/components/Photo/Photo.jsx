import { useState } from 'react';
import cx from '../cx';
import styles from './Photo.module.css';

/**
 * Ảnh có dự phòng: không có src hoặc tải lỗi (mất mạng) → nền lá xanh thay thế.
 * Kích thước do className/style của nơi dùng quyết định.
 */
export default function Photo({ src, alt = '', className, style, ...rest }) {
  const [failedSrc, setFailedSrc] = useState(null);

  if (!src || failedSrc === src) {
    return (
      <div className={cx(styles.fallback, className)} style={style} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
        <i className="bi bi-flower3" aria-hidden="true" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cx(styles.img, className)}
      style={style}
      onError={() => setFailedSrc(src)}
      {...rest}
    />
  );
}
