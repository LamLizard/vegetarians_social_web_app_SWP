import { useId } from 'react';
import Field from '../Field/Field';
import cx from '../cx';
import styles from './RadioGroup.module.css';

/**
 * Chọn 1 trong vài lựa chọn, hiện hết ra màn hình.
 *
 * 3 kiểu:
 *  - 'list'      : dọc, nút tròn truyền thống (giới tính, lý do báo cáo)
 *  - 'segmented' : thanh gộp nằm ngang, 2 đến 4 lựa chọn ngắn (Blog | Video, Mới nhất | Xem nhiều)
 *  - 'card'      : thẻ lớn có icon + mô tả (mục tiêu sức khoẻ: Giảm cân / Tăng cơ / Giữ cân)
 *
 * @param {{value: string, label: string, description?: string, icon?: string, disabled?: boolean}[]} options
 * @param {string} value
 * @param {(value: string) => void} onChange
 * @param {'list'|'segmented'|'card'} [variant='list']
 * @param {string} [label] · [hint] · [error] · [required] · [disabled]
 * @param {string} [name]  tên nhóm radio (tự sinh nếu bỏ trống)
 */
export default function RadioGroup({
  label, options = [], value, onChange, variant = 'list', hint, error, required, disabled, name, className,
}) {
  const auto = useId();
  const groupName = name ?? auto;

  return (
    <Field id={groupName} as="legend" label={label} hint={hint} error={error} required={required} className={className}>
      <div className={cx(styles.group, styles[variant])} role="radiogroup" aria-invalid={error ? true : undefined}>
        {options.map((o) => {
          const checked = value === o.value;
          const isDisabled = disabled || o.disabled;
          return (
            <label key={o.value} className={cx(styles.option, checked && styles.checked, isDisabled && styles.disabled)}>
              <input
                type="radio"
                name={groupName}
                value={o.value}
                checked={checked}
                disabled={isDisabled}
                required={required}
                onChange={() => onChange?.(o.value)}
                className={variant === 'list' ? 'form-check-input' : styles.hidden}
              />
              {variant === 'card' && o.icon && <i className={cx(`bi bi-${o.icon}`, styles.cardIcon)} aria-hidden="true" />}
              {variant === 'segmented' && o.icon && <i className={`bi bi-${o.icon}`} aria-hidden="true" />}
              <span className={styles.text}>
                <span className={styles.optLabel}>{o.label}</span>
                {o.description && variant !== 'segmented' && <span className={styles.desc}>{o.description}</span>}
              </span>
              {variant === 'card' && <i className={cx('bi bi-check-circle-fill', styles.tick)} aria-hidden="true" />}
            </label>
          );
        })}
      </div>
    </Field>
  );
}
