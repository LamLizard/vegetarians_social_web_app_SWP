import Button from '../Button/Button';
import Spinner from '../Spinner/Spinner';
import cx from '../cx';
import { AI_NAME } from '../../constants/domain';
import styles from './AiProgress.module.css';

/** Các bước khi Mầm lên thực đơn (UC-09 bước 3 → 4). */
export const MEAL_PLAN_STEPS = [
  'Đọc hồ sơ sức khoẻ và mục tiêu',
  'Tính BMI, TDEE và calo mục tiêu',
  `${AI_NAME} chọn món cho từng bữa`,
  'Kiểm tra dị ứng và đối chiếu món trong hệ thống',
];

/**
 * Màn chờ khi AI đang làm việc lâu (tạo thực đơn mất 10 đến 30 giây). Cho người dùng thấy đang ở bước nào.
 * Bước là ước lượng phía giao diện: trang tự tăng `current` theo thời gian hoặc theo tiến độ Backend báo.
 *
 * @param {string[]} [steps=MEAL_PLAN_STEPS]
 * @param {number} current            bước đang làm (0-based). = steps.length → xong
 * @param {string} [title]
 * @param {string} [error]            có lỗi (AI lỗi, sai format) → hiện câu lỗi + nút Thử lại (UC-09 thay thế)
 * @param {() => void} [onRetry] · [onCancel]
 */
export default function AiProgress({
  steps = MEAL_PLAN_STEPS, current = 0, title = `${AI_NAME} đang lên thực đơn cho bạn`, error, onRetry, onCancel, className,
}) {
  return (
    <section className={cx(styles.box, error && styles.hasError, className)} aria-live="polite" aria-busy={!error}>
      <div className={styles.head}>
        <span className={styles.mark} aria-hidden="true">
          {error ? <i className="bi bi-exclamation-lg" /> : <i className="bi bi-flower1" />}
        </span>
        <div>
          <h3 className={styles.title}>{error ? 'Chưa tạo được thực đơn' : title}</h3>
          <p className={styles.sub}>{error || 'Thường mất khoảng 10 đến 30 giây. Bạn có thể giữ nguyên trang này.'}</p>
        </div>
      </div>
      <ol className={styles.steps}>
        {steps.map((s, i) => {
          const state = i < current ? 'done' : i === current ? (error ? 'fail' : 'doing') : 'todo';
          return (
            <li key={s} className={styles[state]}>
              <span className={styles.icon} aria-hidden="true">
                {state === 'done' && <i className="bi bi-check-lg" />}
                {state === 'doing' && <Spinner size="sm" label={null} />}
                {state === 'fail' && <i className="bi bi-x-lg" />}
                {state === 'todo' && <span className={styles.dot} />}
              </span>
              <span>{s}</span>
              <span className="visually-hidden">{{ done: ' (xong)', doing: ' (đang làm)', fail: ' (lỗi)', todo: '' }[state]}</span>
            </li>
          );
        })}
      </ol>
      {(error ? onRetry : onCancel) && (
        <div className={styles.actions}>
          {error && onRetry && <Button icon="arrow-clockwise" onClick={onRetry}>Thử lại</Button>}
          {onCancel && <Button variant="subtle" onClick={onCancel}>{error ? 'Sửa thông tin' : 'Huỷ'}</Button>}
        </div>
      )}
    </section>
  );
}
