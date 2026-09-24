import { useState } from 'react';
import cx from '../cx';
import { formatAmount, scaleAmount } from '../../utils/ingredient';
import { formatDuration } from '../../utils/time';
import { formatNumber } from '../../utils/format';
import styles from './RecipeView.module.css';

/**
 * Dòng thông số nhanh của công thức: thời gian · khẩu phần · calo.
 * Dùng trong RecipeCard và đầu trang chi tiết công thức. Thiếu số nào thì ẩn số đó.
 *
 * @param {number} [cookTimeMinutes]  recipe.cook_time (phút)
 * @param {number} [servings]         recipe.servings
 * @param {number} [calories]         recipe.calories, tính cho 1 người (chốt lại với Backend)
 * @param {'sm'|'md'} [size='md']
 */
export function RecipeFacts({ cookTimeMinutes, servings, calories, size = 'md', className }) {
  const items = [
    cookTimeMinutes ? { icon: 'clock', text: formatDuration(cookTimeMinutes), sr: 'Thời gian nấu' } : null,
    servings ? { icon: 'people', text: `${servings} người`, sr: 'Khẩu phần' } : null,
    calories ? { icon: 'fire', text: `${formatNumber(calories)} kcal/người`, sr: 'Năng lượng' } : null,
  ].filter(Boolean);
  if (!items.length) return null;
  return (
    <ul className={cx(styles.facts, size === 'sm' && styles.sm, className)}>
      {items.map((it) => (
        <li key={it.icon}>
          <i className={`bi bi-${it.icon}`} aria-hidden="true" />
          <span className="visually-hidden">{it.sr}: </span>{it.text}
        </li>
      ))}
    </ul>
  );
}

/**
 * Danh sách nguyên liệu để đọc khi nấu. Tự nhân số lượng khi đổi khẩu phần.
 *
 * @param {{name: string, amount: number|null, unit: string}[]} items
 * @param {number} [baseServings]  khẩu phần gốc của công thức (recipe.servings)
 * @param {number} [servings]      khẩu phần đang xem (vd NumberStepper trong trang) → số lượng tự nhân
 * @param {boolean} [checkable]    bấm để gạch những thứ đã chuẩn bị (chỉ lưu tạm trên màn hình)
 */
export function IngredientList({ items = [], baseServings, servings, checkable = false, className }) {
  const [done, setDone] = useState(() => new Set());
  const toggle = (i) => setDone((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  return (
    <ul className={cx(styles.ingredients, className)}>
      {items.map((it, i) => {
        const amount = scaleAmount(it.amount, baseServings, servings ?? baseServings);
        const qty = [formatAmount(amount), it.unit].filter(Boolean).join(' ');
        const content = (
          <>
            <span className={styles.ingName}>{it.name}</span>
            <span className={styles.dots} aria-hidden="true" />
            <span className={styles.qty}>{qty}</span>
          </>
        );
        return (
          <li key={`${it.name}-${i}`} className={cx(done.has(i) && styles.done)}>
            {checkable ? (
              <label className={styles.check}>
                <input type="checkbox" className="form-check-input" checked={done.has(i)} onChange={() => toggle(i)} />
                {content}
              </label>
            ) : content}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Các bước nấu, đánh số. Nhận mảng hoặc chuỗi recipe.instructions (mỗi dòng 1 bước).
 * @param {string[]|string} steps
 */
export function RecipeSteps({ steps = [], className }) {
  const list = (Array.isArray(steps) ? steps : String(steps).split('\n')).map((s) => s.trim()).filter(Boolean);
  return (
    <ol className={cx(styles.steps, className)}>
      {list.map((s, i) => (
        <li key={i}><span className={styles.stepNum} aria-hidden="true">{i + 1}</span><p>{s}</p></li>
      ))}
    </ol>
  );
}
