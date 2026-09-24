import { useState } from 'react';
import cx from '../cx';
import styles from './Photo.module.css';

/**
 * Ảnh có dự phòng: không có src hoặc tải lỗi → nền lá xanh thay thế (không bao giờ hiện ảnh vỡ).
 * Dùng cho mọi ảnh món, ảnh bài blog, ảnh quán, ảnh bìa YouTube.
 *
 * @param {string} [src]
 * @param {string} [alt='']   ảnh có nghĩa thì mô tả; ảnh trang trí thì để ''
 * @param {'1/1'|'4/3'|'16/9'|'3/2'} [ratio]  giữ tỉ lệ khung → danh sách thẻ không bị lệch chiều cao
 * @param {'none'|'rounded'|'leaf'} [shape='none']  leaf = bo lệch 18/6 (nét riêng của thẻ món)
 *
 * Bề ngang do nơi dùng quyết định (mặc định 100% khung chứa).
 */
export default function Photo({ src, alt = '', ratio, shape = 'none', className, style, ...rest }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const shapeClass = shape !== 'none' && styles[shape];
  const boxStyle = { aspectRatio: ratio, ...style };

  if (!src || failedSrc === src) {
    return (
      <div
        className={cx(styles.fallback, shapeClass, className)}
        style={{ minHeight: ratio ? undefined : 120, ...boxStyle }}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
      >
        <i className="bi bi-flower3" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cx(styles.img, shapeClass, className)}
      style={boxStyle}
      onError={() => setFailedSrc(src)}
      {...rest}
    />
  );
}
