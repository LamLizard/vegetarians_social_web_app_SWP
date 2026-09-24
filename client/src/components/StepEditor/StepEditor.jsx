import { useEffect, useId, useRef } from 'react';
import Button from '../Button/Button';
import Field from '../Field/Field';
import IconButton from '../IconButton/IconButton';
import TextArea from '../TextArea/TextArea';
import cx from '../cx';
import styles from './StepEditor.module.css';

/**
 * Nhập các bước nấu (M-19). Mỗi bước 1 ô, đánh số tự động, đổi thứ tự bằng nút ↑ ↓.
 *
 * Database chỉ có recipe.instructions (TEXT) → gửi API: steps.filter(Boolean).join('\n')
 * Đọc về: instructions.split('\n').filter(Boolean). Hiển thị dùng <RecipeSteps steps={...} />.
 *
 * @param {string[]} value
 * @param {(steps: string[]) => void} onChange
 * @param {number} [max=30]
 * @param {number} [maxLength=1000]  mỗi bước
 * @param {string} [label='Các bước nấu'] · [hint] · [error] · [required] · [disabled]
 */
export default function StepEditor({
  value = [], onChange, max = 30, maxLength = 1000,
  label = 'Các bước nấu', hint, error, required, disabled, className,
}) {
  const id = useId();
  const steps = value.length ? value : [''];
  const listRef = useRef(null);
  const focusIndex = useRef(null);

  useEffect(() => {
    if (focusIndex.current == null) return;
    listRef.current?.querySelectorAll('textarea')[focusIndex.current]?.focus();
    focusIndex.current = null;
  });

  const set = (i, text) => onChange?.(steps.map((s, j) => (j === i ? text : s)));
  const add = () => { if (steps.length < max) { focusIndex.current = steps.length; onChange?.([...steps, '']); } };
  const remove = (i) => {
    focusIndex.current = Math.max(0, i - 1);
    onChange?.(steps.length === 1 ? [''] : steps.filter((_, j) => j !== i));
  };
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    focusIndex.current = j;
    onChange?.(next);
  };

  return (
    <Field id={id} as="legend" label={label} required={required} error={error}
      hint={hint ?? 'Mỗi ô là 1 bước. Viết ngắn gọn, có thời gian và lửa nếu cần.'} className={className}>
      <ol className={styles.list} ref={listRef}>
        {steps.map((s, i) => (
          <li key={i} className={styles.step}>
            <span className={styles.num} aria-hidden="true">{i + 1}</span>
            <TextArea
              className={styles.text}
              value={s}
              onChange={(t) => set(i, t)}
              rows={2}
              maxRows={8}
              maxLength={maxLength}
              placeholder={i === 0 ? 'vd: Hầm củ cải, bắp, su su với 2 lít nước trong 45 phút.' : 'Bước tiếp theo...'}
              aria-label={`Bước ${i + 1}`}
              disabled={disabled}
            />
            <div className={styles.tools}>
              <IconButton icon="arrow-up" label={`Đưa bước ${i + 1} lên`} variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={disabled || i === 0} />
              <IconButton icon="arrow-down" label={`Đưa bước ${i + 1} xuống`} variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={disabled || i === steps.length - 1} />
              <IconButton icon="x-lg" label={`Xoá bước ${i + 1}`} variant="ghost" size="sm" onClick={() => remove(i)} disabled={disabled} />
            </div>
          </li>
        ))}
      </ol>
      <div className={cx(styles.foot)}>
        <Button variant="subtle" size="sm" icon="plus-lg" onClick={add} disabled={disabled || steps.length >= max}>Thêm bước</Button>
      </div>
    </Field>
  );
}
