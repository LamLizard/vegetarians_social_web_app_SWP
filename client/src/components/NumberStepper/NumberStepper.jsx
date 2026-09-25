import Field, { useFieldId } from '../Field/Field';
import cx from '../cx';
import styles from './NumberStepper.module.css';

/**
 * Chọn số nhỏ bằng nút − / +, vẫn gõ tay được.
 * Dùng cho: số ngày Meal Plan (1 đến 7), số bữa mỗi ngày (mặc định 3), khẩu phần công thức.
 *
 * @param {number} value
 * @param {(value: number) => void} onChange
 * @param {number} [min=0] · [max=99] · [step=1]
 * @param {string} [unit]   chữ sau số, vd "ngày", "bữa", "người"
 * @param {string} [label] · [hint] · [error] · [required] · [disabled]
 */
export default function NumberStepper({
  label, value, onChange, min = 0, max = 99, step = 1, unit, hint, error, required, disabled, id, className,
}) {
  const { id: fieldId, inputProps } = useFieldId({ id, error, hint });
  const clamp = (n) => Math.min(max, Math.max(min, n));
  const set = (n) => { if (!Number.isNaN(n)) onChange?.(clamp(n)); };
  const num = Number(value ?? min);

  return (
    <Field id={fieldId} label={label} hint={hint} error={error} required={required} className={className}>
      <div className={cx(styles.stepper, error && styles.invalid, disabled && styles.disabled)}>
        <button type="button" className={styles.btn} onClick={() => set(num - step)} disabled={disabled || num <= min} aria-label="Giảm">
          <i className="bi bi-dash-lg" aria-hidden="true" />
        </button>
        <input
          {...inputProps}
          type="number"
          inputMode="numeric"
          className={styles.input}
          value={value ?? ''}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => e.target.value !== '' && set(Number(e.target.value))}
        />
        {unit && <span className={styles.unit}>{unit}</span>}
        <button type="button" className={styles.btn} onClick={() => set(num + step)} disabled={disabled || num >= max} aria-label="Tăng">
          <i className="bi bi-plus-lg" aria-hidden="true" />
        </button>
      </div>
    </Field>
  );
}
