import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { NUTRIENTS } from '../../../components/nutrients';
import cx from '../../../components/cx';
import { TODAY_NUTRITION } from '../../store/mockData';
import { formatNumber } from '../../utils/format';
import styles from './today.module.css';

const STROKE = 7;
const GAP = 2.5;

/**
 * Vòng tiến độ dinh dưỡng hôm nay (đạm, carbs, béo, xơ) – mỗi vòng 1 nhóm chất, màu cố định theo nutrients.js.
 * Chú thích luôn có số → không phụ thuộc màu; rê chuột lên dòng chú thích để làm nổi vòng tương ứng.
 */
export default function NutritionRings({ data = TODAY_NUTRITION, size = 132, className }) {
  const [focus, setFocus] = useState(null);
  const reduce = useReducedMotion();
  const c = size / 2;

  return (
    <div className={cx(styles.rings, className)}>
      <div className={styles.ringsChart} style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
          {data.items.map((it, i) => {
            const r = c - STROKE / 2 - i * (STROKE + GAP);
            const len = 2 * Math.PI * r;
            const pct = Math.min(1, it.value / it.target);
            const dim = focus && focus !== it.key;
            return (
              <g key={it.key} transform={`rotate(-90 ${c} ${c})`} style={{ opacity: dim ? 0.3 : 1, transition: 'opacity .15s' }}>
                <circle cx={c} cy={c} r={r} fill="none" stroke="var(--ac-track)" strokeWidth={STROKE} />
                <motion.circle
                  cx={c}
                  cy={c}
                  r={r}
                  fill="none"
                  stroke={NUTRIENTS[it.key].color}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={len}
                  initial={{ strokeDashoffset: reduce ? len * (1 - pct) : len }}
                  animate={{ strokeDashoffset: len * (1 - pct) }}
                  transition={{ duration: 1.1, delay: 0.15 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                />
              </g>
            );
          })}
        </svg>
        <div className={styles.ringsCenter} aria-hidden="true">
          <b>{Math.round((data.kcal / data.kcalTarget) * 100)}%</b>
          <small>năng lượng</small>
        </div>
      </div>

      <ul className={styles.ringsLegend}>
        <li className={styles.kcalRow}>
          <span>Năng lượng</span>
          <b>{formatNumber(data.kcal)}<small>/{formatNumber(data.kcalTarget)} kcal</small></b>
        </li>
        {data.items.map((it) => (
          <li
            key={it.key}
            className={cx(focus && focus !== it.key && styles.dim)}
            onMouseEnter={() => setFocus(it.key)}
            onMouseLeave={() => setFocus(null)}
          >
            <i style={{ background: NUTRIENTS[it.key].color }} aria-hidden="true" />
            <span>{NUTRIENTS[it.key].label}</span>
            <b>{it.value}<small>/{it.target}g</small></b>
          </li>
        ))}
      </ul>
    </div>
  );
}
