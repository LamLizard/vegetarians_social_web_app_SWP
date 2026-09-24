import { useId } from 'react';
import cx from '../cx';
import styles from './Field.module.css';

/**
 * Khung chung cho mọi ô nhập: nhãn + dấu * bắt buộc + dòng gợi ý / lỗi + bộ đếm ký tự.
 * TextField, Select, CategoryPicker... đều dùng Field bên trong. Tự làm ô nhập riêng thì bọc bằng Field
 * để giao diện đồng nhất.
 *
 * @param {string} id          id của ô nhập bên trong (lấy từ useFieldId)
 * @param {string} [label]
 * @param {string} [hint]      dòng gợi ý dưới ô
 * @param {string} [error]     có giá trị → hiện lỗi thay cho gợi ý
 * @param {boolean} [required] hiện dấu *
 * @param {{value: number, max: number}} [counter]  hiện "12/200"
 * @param {'label'|'legend'} [as='label']  'legend' khi bên trong là nhóm (radio, chip) → bọc bằng <fieldset>
 */
export default function Field({ id, label, hint, error, required, counter, as = 'label', className, children }) {
  const descId = error || hint ? `${id}-desc` : undefined;
  const over = counter && counter.value > counter.max;
  const Wrap = as === 'legend' ? 'fieldset' : 'div';
  const Label = as === 'legend' ? 'legend' : 'label';

  return (
    <Wrap className={cx(styles.field, className)} aria-describedby={as === 'legend' ? descId : undefined}>
      {label && (
        <Label className={styles.label} htmlFor={as === 'legend' ? undefined : id}>
          {label}
          {required && <span className={styles.req} aria-hidden="true">*</span>}
          {required && <span className="visually-hidden"> (bắt buộc)</span>}
        </Label>
      )}
      {children}
      {(descId || counter) && (
        <div className={styles.foot}>
          {error ? (
            <span id={descId} className={styles.error} role="alert">
              <i className="bi bi-exclamation-circle" aria-hidden="true" />{error}
            </span>
          ) : (
            hint && <span id={descId} className={styles.hint}>{hint}</span>
          )}
          {counter && (
            <span className={cx(styles.count, over && styles.over)} aria-live="polite">
              {counter.value}/{counter.max}
            </span>
          )}
        </div>
      )}
    </Wrap>
  );
}

/**
 * Hook tạo id + thuộc tính aria cho ô nhập nằm trong Field.
 * @returns {{ id: string, inputProps: object }}  rải inputProps vào <input>/<select>/<textarea>
 */
export function useFieldId({ id, error, hint } = {}) {
  const auto = useId();
  const fieldId = id ?? auto;
  return {
    id: fieldId,
    inputProps: {
      id: fieldId,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error || hint ? `${fieldId}-desc` : undefined,
    },
  };
}
