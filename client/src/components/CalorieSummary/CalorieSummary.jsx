import cx from '../cx';
import { MEAL_SLOT } from '../../constants/domain';
import { formatNumber } from '../../utils/format';
import styles from './CalorieSummary.module.css';

/**
 * Tổng calo của 1 ngày trong thực đơn so với calo mục tiêu (meal_plan.target_calories_kcal).
 * Dữ liệu v4.0 chỉ có calo từng bữa (meal_plan_item.calories_kcal), KHÔNG có gram đạm/béo/carb
 * → không vẽ biểu đồ macro (đã bỏ NutritionSummary, MacroProgress, MicronutrientList cũ).
 *
 * Trong khoảng ±5% mục tiêu → "Vừa đúng mục tiêu" (xanh). Thiếu → "Còn … kcal". Vượt → "Vượt … kcal" (vàng).
 *
 * @param {number} total                  tổng calories_kcal của các bữa trong ngày
 * @param {number} [target]               meal_plan.target_calories_kcal
 * @param {{slot: string, kcal: number}[]} [bySlot]  chia theo bữa, hiện dưới thanh
 * @param {string} [title='Năng lượng trong ngày']
 */
export default function CalorieSummary({ total = 0, target, bySlot = [], title = 'Năng lượng trong ngày', className }) {
  const pct = target ? Math.round((total / target) * 100) : null;
  const diff = target ? total - target : 0;
  const state = !target ? 'none' : Math.abs(diff) <= target * 0.05 ? 'ok' : diff < 0 ? 'under' : 'over';
  const message = {
    ok: 'Vừa đúng mục tiêu',
    under: `Còn ${formatNumber(-diff)} kcal so với mục tiêu`,
    over: `Vượt ${formatNumber(diff)} kcal so với mục tiêu`,
    none: 'Chưa có calo mục tiêu. Cập nhật hồ sơ để Mầm tính giúp bạn.',
  }[state];

  return (
    <section className={cx(styles.box, className)} aria-label={title}>
      <div className={styles.head}>
        <span className={styles.title}>{title}</span>
        <span className={cx(styles.state, styles[state])}>{message}</span>
      </div>
      <div className={styles.numbers}>
        <b>{formatNumber(total)}</b>
        {target ? <span>/ {formatNumber(target)} kcal</span> : <span>kcal</span>}
      </div>
      {target > 0 && (
        <div
          className={styles.track}
          role="progressbar"
          aria-label="Calo so với mục tiêu"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={total}
          aria-valuetext={`${formatNumber(total)} trên ${formatNumber(target)} kcal, ${pct}%`}
        >
          <div className={cx(styles.fill, styles[`fill_${state}`])} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
      {bySlot.length > 0 && (
        <ul className={styles.slots}>
          {bySlot.map((b) => (
            <li key={b.slot}>
              <i className={`bi bi-${MEAL_SLOT[b.slot]?.icon ?? 'circle'}`} aria-hidden="true" />
              <span>{MEAL_SLOT[b.slot]?.label ?? b.slot}</span>
              <b>{formatNumber(b.kcal)}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
