import { useState } from 'react';
import cx from '../../../components/cx';
import styles from './admin.module.css';

/**
 * Biểu đồ cột: số bài đăng mới mỗi ngày (1 chuỗi dữ liệu → không cần chú giải).
 * Rê chuột / Tab tới từng cột để xem chi tiết; bảng ẩn cho trình đọc màn hình.
 * @param {{t:string, posts:number, approved:number}[]} data
 */
export default function PostsChart({ data }) {
  const [active, setActive] = useState(null);
  const max = Math.max(...data.map((d) => d.posts));
  const top = Math.ceil(max / 10) * 10;
  const ticks = [0, 1, 2, 3, 4].map((i) => Math.round((top / 4) * i));
  const peak = data.findIndex((d) => d.posts === max);
  const last = data.length - 1;
  const pct = (v) => (v / top) * 100;

  return (
    <figure className={styles.chart}>
      <div className={styles.plot}>
        {ticks.map((t) => (
          <div key={t} className={styles.gridLine} style={{ bottom: `${pct(t)}%` }} aria-hidden="true">
            <span>{t}</span>
          </div>
        ))}

        <div className={styles.bars}>
          {data.map((d, i) => (
            <div
              key={d.t}
              tabIndex={0}
              className={cx(styles.band, active === i && styles.bandActive)}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              aria-label={`${d.t}: ${d.posts} bài mới, ${d.approved} bài đã duyệt`}
            >
              {/* Chỉ ghi số ở cột cao nhất và hôm nay – còn lại xem bằng tooltip */}
              {(i === peak || i === last) && active !== i && (
                <span className={styles.cap} style={{ bottom: `calc(${pct(d.posts)}% + 4px)` }}>{d.posts}</span>
              )}
              <div className={styles.bar} style={{ height: `${pct(d.posts)}%` }} />
              {active === i && (
                <div className={styles.tip} role="tooltip" style={{ bottom: `calc(${pct(d.posts)}% + 8px)` }}>
                  <b>{d.t}</b>
                  <span>{d.posts} bài mới</span>
                  <span>{d.approved} đã duyệt ({Math.round((d.approved / d.posts) * 100)}%)</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.xAxis} aria-hidden="true">
        {data.map((d, i) => <span key={d.t} className={cx(i === last && styles.xToday)}>{d.t}</span>)}
      </div>

      <table className="visually-hidden">
        <caption>Số bài đăng mới 7 ngày qua</caption>
        <thead><tr><th>Ngày</th><th>Bài mới</th><th>Đã duyệt</th></tr></thead>
        <tbody>
          {data.map((d) => <tr key={d.t}><td>{d.t}</td><td>{d.posts}</td><td>{d.approved}</td></tr>)}
        </tbody>
      </table>
    </figure>
  );
}
