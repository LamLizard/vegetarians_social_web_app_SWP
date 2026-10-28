import cx from '../cx';
import { formatNumber } from '../../utils/format';
import styles from './NutritionRing.module.css';

/**
 * Dinh dưỡng của 1 khẩu phần dạng vòng tròn (27/10/2026, phương án C):
 *  vòng = tỉ lệ NĂNG LƯỢNG đến từ đạm / tinh bột / chất béo (4 · 4 · 9 kcal mỗi gam), giữa vòng = kcal.
 *  Bên phải: từng chất với số gam to + % năng lượng; chất không tạo năng lượng chính (xơ, đường, natri) hiện số, không có %.
 *  Nhãn "Giàu đạm" / "Giàu chất xơ" khi đạt ≥ 20% nhu cầu ngày (mức tham chiếu 2.000 kcal: đạm 50 g, xơ 28 g).
 * Component KHÔNG gọi API: trang truyền số liệu của 1 người.
 *
 * @param {number} [kcal]        recipe.caloriesKcal; trống → tự tính từ đạm/tinh bột/béo
 * @param {number} [proteinG] · [carbG] · [fatG] · [fiberG] · [sugarG] · [sodiumMg]
 * @param {string} [label='kcal / người']
 */
const ENERGY = [
  { key: 'proteinG', label: 'Đạm', tone: 'protein', kcalPerG: 4 },
  { key: 'carbG', label: 'Tinh bột', tone: 'carb', kcalPerG: 4 },
  { key: 'fatG', label: 'Chất béo', tone: 'fat', kcalPerG: 9 },
];
const OTHERS = [
  { key: 'fiberG', label: 'Chất xơ', tone: 'fiber', unit: 'g' },
  { key: 'sugarG', label: 'Đường', unit: 'g' },
  { key: 'sodiumMg', label: 'Natri', unit: 'mg' },
];
/** Ngưỡng "giàu …" = 20% nhu cầu ngày (cách ghi nhãn thực phẩm của FDA) */
const RICH = [
  { key: 'proteinG', label: 'Giàu đạm', tone: 'protein', dailyG: 50 },
  { key: 'fiberG', label: 'Giàu chất xơ', tone: 'fiber', dailyG: 28 },
];

const fmt = (n) => (Number.isInteger(n) ? formatNumber(n) : n.toLocaleString('vi-VN', { maximumFractionDigits: 1 }));

/** Làm tròn % sao cho tổng đúng 100 (dư/thiếu dồn vào phần lớn nhất) */
function percents(values) {
  const total = values.reduce((s, v) => s + v, 0);
  if (!total) return values.map(() => 0);
  const p = values.map((v) => Math.round((v / total) * 100));
  const drift = 100 - p.reduce((s, v) => s + v, 0);
  if (drift) p[values.indexOf(Math.max(...values))] += drift;
  return p;
}

export default function NutritionRing({ kcal, label = 'kcal / người', className, ...nutrients }) {
  const energy = ENERGY.filter((m) => nutrients[m.key] != null);
  const pcts = percents(energy.map((m) => nutrients[m.key] * m.kcalPerG));
  const others = OTHERS.filter((m) => nutrients[m.key] != null);
  const rich = RICH.filter((m) => nutrients[m.key] != null && nutrients[m.key] / m.dailyG >= 0.2);
  const center = kcal ?? Math.round(energy.reduce((s, m) => s + nutrients[m.key] * m.kcalPerG, 0));
  const hasRing = energy.length > 0 && pcts.some(Boolean);

  // conic-gradient: các cung nối tiếp nhau theo %
  const stops = energy.map((m, i) => {
    const from = pcts.slice(0, i).reduce((s, v) => s + v, 0);
    return `var(--ac-${m.tone}) ${from}% ${from + pcts[i]}%`;
  }).join(', ');
  const summary = energy.map((m, i) => `${m.label} ${pcts[i]}%`).join(', ');

  return (
    <div className={cx(styles.wrap, className)}>
      <div className={cx(styles.body, !hasRing && styles.noRing)}>
        {hasRing && (
          <div
            className={styles.ring}
            style={{ background: `conic-gradient(${stops})` }}
            role="img"
            aria-label={`${center ? `${formatNumber(center)} kcal. ` : ''}Năng lượng từ: ${summary}.`}
          >
            <div className={styles.hole}>
              {center > 0 && <b>{formatNumber(center)}</b>}
              <span>{center > 0 ? label : 'năng lượng'}</span>
            </div>
          </div>
        )}

        <ul className={styles.legend}>
          {energy.map((m, i) => (
            <li key={m.key} data-tone={m.tone}>
              <i aria-hidden="true" />
              <span className={styles.name}>{m.label}</span>
              <b>{fmt(nutrients[m.key])} g</b>
              <span className={styles.pct}>{pcts[i]}%<span className="visually-hidden"> năng lượng</span></span>
            </li>
          ))}
          {others.map((m) => (
            <li key={m.key} data-tone={m.tone ?? 'none'}>
              <i aria-hidden="true" />
              <span className={styles.name}>{m.label}</span>
              <b>{fmt(nutrients[m.key])} {m.unit}</b>
              <span className={styles.pct} />
            </li>
          ))}
        </ul>
      </div>

      {rich.length > 0 && (
        <ul className={styles.badges} aria-label="Điểm nổi bật">
          {rich.map((m) => (
            <li key={m.key} data-tone={m.tone}>
              <i className="bi bi-check2-circle" aria-hidden="true" />{m.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
