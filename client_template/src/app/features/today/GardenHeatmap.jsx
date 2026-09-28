import { useMemo, useState } from 'react';
import cx from '../../../components/cx';
import { GARDEN_LEVELS, gardenFor } from '../../store/mockData';
import { isVegDay, lunarLabel, toLunar } from '../../utils/lunar';
import styles from './today.module.css';

const ROWS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/**
 * "Khu vườn" – mỗi ô là 1 ngày trong 12 tuần gần nhất, càng xanh càng ăn chay nhiều.
 * Ô có viền vàng = mùng 1 / rằm âm lịch. Rê chuột hoặc Tab vào ô để xem chi tiết.
 */
export default function GardenHeatmap({ user, weeks = 12 }) {
  const [hover, setHover] = useState(null);

  const { cells, months, total } = useMemo(() => {
    const days = gardenFor(user, weeks * 7);
    // Cột đầu tiên bắt đầu từ thứ Hai → chừa ô trống phía trước
    const lead = (days[0].date.getDay() + 6) % 7;
    const list = days.map((d, i) => {
      const lunar = toLunar(d.date);
      return { ...d, lunar, veg: isVegDay(lunar), col: Math.floor((i + lead) / 7), row: (i + lead) % 7 };
    });
    const monthLabels = [];
    list.forEach((d) => {
      if (d.date.getDate() <= 7 && d.row === 0) monthLabels.push({ col: d.col, text: `Th${d.date.getMonth() + 1}` });
    });
    return { cells: list, months: monthLabels, total: list.filter((d) => d.level > 0).length };
  }, [user, weeks]);

  const cols = cells[cells.length - 1].col + 1;
  const active = hover != null ? cells[hover] : null;

  return (
    <figure className={styles.garden}>
      <div className={styles.gardenScroll}>
        <div className={styles.gardenGrid} style={{ gridTemplateColumns: `22px repeat(${cols}, var(--cell))` }}>
          {months.map((m) => (
            <span key={m.col} className={styles.gardenMonth} style={{ gridColumn: m.col + 2, gridRow: 1 }}>{m.text}</span>
          ))}
          {ROWS.map((r, i) => (
            <span key={r} className={styles.gardenRow} style={{ gridColumn: 1, gridRow: i + 2 }}>{i % 2 === 0 ? r : ''}</span>
          ))}
          {cells.map((d, i) => (
            <span
              key={i}
              tabIndex={0}
              className={cx(styles.cell, styles[`lv${d.level}`], d.veg && styles.cellVeg)}
              style={{ gridColumn: d.col + 2, gridRow: d.row + 2 }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${d.date.toLocaleDateString('vi-VN')}: ${GARDEN_LEVELS[d.level]}${d.veg ? ', ngày chay âm lịch' : ''}`}
            />
          ))}
        </div>
      </div>

      <figcaption className={styles.gardenFoot}>
        <span className={styles.gardenInfo} aria-live="polite">
          {active
            ? <><b>{active.date.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })}</b> · {lunarLabel(active.lunar)} âm · {GARDEN_LEVELS[active.level]}</>
            : <><b>{total}</b> ngày có bữa chay trong {weeks} tuần qua</>}
        </span>
        <span className={styles.gardenLegend} aria-hidden="true">
          Ít
          {[0, 1, 2, 3].map((l) => <i key={l} className={cx(styles.cell, styles[`lv${l}`])} />)}
          Nhiều
          <i className={cx(styles.cell, styles.lv0, styles.cellVeg)} /> Mùng 1, rằm
        </span>
      </figcaption>
    </figure>
  );
}
