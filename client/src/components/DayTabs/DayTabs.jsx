import { useRef } from 'react';
import cx from '../cx';
import styles from './DayTabs.module.css';

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** Nhãn ngày thứ n của thực đơn: có start_date → "T2 29/9", không có → "Ngày 1". */
export function dayLabel(dayNo, startDate) {
  if (!startDate) return { top: `Ngày ${dayNo}` };
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return { top: `Ngày ${dayNo}` };
  d.setDate(d.getDate() + dayNo - 1);
  return { top: WEEKDAY[d.getDay()], sub: `${d.getDate()}/${d.getMonth() + 1}` };
}

/**
 * Dãy chọn ngày trong thực đơn (M-11). Số ngày theo meal_plan.days_count (mặc định 7, không cố định).
 * Giá trị là meal_plan_item.day_no (bắt đầu từ 1). Bàn phím: ← → Home End. Điện thoại tự cuộn ngang.
 *
 * @param {number} [daysCount=7]
 * @param {number} value                     day_no đang chọn
 * @param {(dayNo: number) => void} onChange
 * @param {string} [startDate]               meal_plan.start_date → nhãn "T2 29/9"
 * @param {number} [todayNo]                 ngày nào là hôm nay → chấm vàng
 * @param {number[]} [warnDays]              ngày có món cần đổi (vi phạm dị ứng) → chấm đỏ
 * @param {(dayNo: number) => string} [renderSub]  dòng nhỏ tuỳ chọn, vd tổng kcal của ngày
 */
export default function DayTabs({ daysCount = 7, value = 1, onChange, startDate, todayNo, warnDays = [], renderSub, className }) {
  const ref = useRef(null);
  const days = Array.from({ length: daysCount }, (_, i) => i + 1);

  const move = (e) => {
    const map = { ArrowRight: value + 1, ArrowLeft: value - 1, Home: 1, End: daysCount };
    let next = map[e.key];
    if (next == null) return;
    e.preventDefault();
    if (next < 1) next = daysCount;
    if (next > daysCount) next = 1;
    onChange?.(next);
    ref.current?.querySelector(`[data-day="${next}"]`)?.focus();
  };

  return (
    <div ref={ref} className={cx(styles.row, className)} role="tablist" aria-label="Chọn ngày trong thực đơn" onKeyDown={move}>
      {days.map((n) => {
        const selected = n === value;
        const { top, sub } = dayLabel(n, startDate);
        const extra = renderSub?.(n);
        const warn = warnDays.includes(n);
        return (
          <button
            key={n}
            type="button"
            role="tab"
            data-day={n}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={cx(styles.day, selected && styles.selected)}
            onClick={() => onChange?.(n)}
          >
            <span>{top}</span>
            {(sub || extra) && <small className={styles.sub}>{[sub, extra].filter(Boolean).join(' · ')}</small>}
            {n === todayNo && <span className={styles.today} aria-label="Hôm nay" />}
            {warn && <span className={styles.warn} aria-label="Có món cần đổi" />}
          </button>
        );
      })}
    </div>
  );
}
