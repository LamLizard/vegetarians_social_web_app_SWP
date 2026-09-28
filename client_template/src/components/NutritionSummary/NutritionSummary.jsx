import { useState } from 'react';
import { NUTRIENTS } from '../nutrients';
import cx from '../cx';
import styles from './NutritionSummary.module.css';

/**
 * Tổng calo + thanh xếp chồng tỉ lệ các nhóm chất trong ngày.
 * Rê chuột lên từng đoạn để xem chi tiết; chú thích luôn có số → không phụ thuộc màu.
 * @param {number} kcal    đã nạp
 * @param {number} target  mục tiêu
 * @param {{key:'protein'|'carb'|'fat'|'fiber', grams:number, percent:number}[]} parts  percent = % năng lượng
 */
export default function NutritionSummary({ kcal, target, parts, className }) {
  const [hover, setHover] = useState(null);
  const fmt = (n) => n.toLocaleString('vi-VN');

  return (
    <div className={className}>
      <div className={styles.kcal}>
        <b>{fmt(kcal)}</b>
        <span>/ {fmt(target)} kcal</span>
      </div>

      <div className={styles.stackWrap}>
        <div className={styles.stack} aria-hidden="true">
          {parts.map((p) => (
            <div
              key={p.key}
              className={styles.seg}
              style={{ flexGrow: p.percent, background: NUTRIENTS[p.key].color }}
              onMouseEnter={() => setHover(p.key)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </div>
        {hover && (() => {
          const p = parts.find((x) => x.key === hover);
          return (
            <div className={styles.tip} role="status">
              <b>{NUTRIENTS[p.key].label}</b>: {p.grams}g · {p.percent}% năng lượng
            </div>
          );
        })()}
      </div>

      <ul className={styles.legend}>
        {parts.map((p) => (
          <li key={p.key} className={cx(styles.item, hover && hover !== p.key && styles.dim)}>
            <span className={styles.swatch} style={{ background: NUTRIENTS[p.key].color }} />
            <span className={styles.label}>{NUTRIENTS[p.key].label}</span>
            <b>{p.grams}g</b>
            <small>{p.percent}%</small>
          </li>
        ))}
      </ul>

      {/* Bảng ẩn cho trình đọc màn hình */}
      <table className="visually-hidden">
        <caption>Phân bổ dinh dưỡng: {kcal} trên {target} kcal</caption>
        <thead><tr><th>Nhóm chất</th><th>Gram</th><th>% năng lượng</th></tr></thead>
        <tbody>
          {parts.map((p) => (
            <tr key={p.key}><td>{NUTRIENTS[p.key].label}</td><td>{p.grams}</td><td>{p.percent}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
