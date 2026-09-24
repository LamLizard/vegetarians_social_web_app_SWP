import cx from '../cx';
import styles from './Skeleton.module.css';

/**
 * Khung xám nhấp nháy giữ chỗ khi đang tải dữ liệu (thay cho màn hình trắng).
 * Dùng khi: tải danh sách bài, danh sách quán, chờ AI tạo thực đơn.
 *
 * @param {'text'|'block'|'circle'} [shape='text']
 * @param {number} [lines=1]      shape="text": số dòng (dòng cuối ngắn hơn)
 * @param {string|number} [width] vd "60%" hoặc 120
 * @param {string|number} [height] shape="block"/"circle"
 *
 * Mẹo: bọc khu vực đang tải bằng aria-busy="true" để trình đọc màn hình biết.
 */
export default function Skeleton({ shape = 'text', lines = 1, width, height, className }) {
  if (shape === 'text') {
    return (
      <span className={cx(styles.lines, className)} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className={cx(styles.sk, styles.text)}
            style={{ width: i === lines - 1 && lines > 1 ? '65%' : width }}
          />
        ))}
      </span>
    );
  }
  return (
    <span
      className={cx(styles.sk, styles[shape], className)}
      style={{ width, height: height ?? (shape === 'circle' ? width : undefined) }}
      aria-hidden="true"
    />
  );
}

/** Mẫu có sẵn: khung giữ chỗ cho 1 thẻ (ảnh + 3 dòng chữ). Dùng cho danh sách Post/Dish/Shop. */
export function SkeletonCard({ className }) {
  return (
    <div className={cx(styles.card, className)} aria-hidden="true">
      <Skeleton shape="block" height={160} />
      <div className={styles.cardBody}>
        <Skeleton width="40%" />
        <Skeleton lines={2} />
      </div>
    </div>
  );
}
