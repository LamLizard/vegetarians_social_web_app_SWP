// Khoi's code (01/11/2026): dải "Hôm nay ăn gì?" đầu Bảng tin (thay thẻ lời chào FeedGreeting).
// Lấy từ prototype v4 (Prototype_UI_SWP/src/v4/components/Today.jsx).
//  - Món = công thức ĐÃ DUYỆT có ẢNH THẬT (bỏ ảnh picsum của dữ liệu mẫu).
//  - Chọn 4 món theo NGÀY (utils/dailyPick.js): cả ngày cố định, qua 0h đổi.
//  - Bấm thẻ → trang chi tiết công thức. Điện thoại: vuốt ngang.
// Component KHÔNG gọi API: trang truyền danh sách công thức (GET /api/recipes).
import { useMemo } from 'react';
import Photo from '../Photo/Photo';
import { hasRealPhoto, pickForDay } from '../../utils/dailyPick';
import s from './FeedTodayDishes.module.css';

const COUNT = 4;

/**
 * @param {{id, title, thumbnailUrl, prepTimeMinutes?, cookTimeMinutes?, servings?}[]|null} recipes  null = đang tải
 * @param {string} [dayKey]   chỉ để test; mặc định = hôm nay
 */
export default function FeedTodayDishes({ recipes, dayKey }) {
  const picks = useMemo(
    () => (recipes ? pickForDay(recipes.filter((r) => hasRealPhoto(r.thumbnailUrl)), COUNT, dayKey) : null),
    [recipes, dayKey],
  );

  // Dưới 2 món có ảnh thật (vd khách chỉ xem được 3 công thức) → ẩn cả khối, tránh dải chỉ có 1 ô lẻ loi
  if (picks && picks.length < 2) return null;

  return (
    <section className={s.card} aria-labelledby="feed-today">
      <div className={s.head}>
        <h2 id="feed-today" className={s.title}>Hôm nay ăn gì?</h2>
        <a className={s.all} href="/recipes">Xem công thức <i className="bi bi-chevron-right" aria-hidden="true" /></a>
      </div>
      <div className={s.row} aria-busy={!picks || undefined}>
        {!picks && Array.from({ length: COUNT }, (_, i) => <span key={i} className={`${s.tile} ${s.sk}`} />)}
        {picks?.map((r) => {
          const minutes = (r.prepTimeMinutes ?? 0) + (r.cookTimeMinutes ?? 0);
          const meta = [minutes > 0 && `${minutes} phút`, r.servings && `${r.servings} người`].filter(Boolean).join(' · ');
          return (
            <a key={r.id} className={s.tile} href={`/recipes/${encodeURIComponent(r.id)}`}>
              <Photo src={r.thumbnailUrl} alt="" className={s.img} />
              <span className={s.cap}>
                <b>{r.title.replace(/^Cách làm\s+/i, '')}</b>
                {meta && <small>{meta}</small>}
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
