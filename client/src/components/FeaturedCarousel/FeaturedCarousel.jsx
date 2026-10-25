import { useState } from 'react';
import Avatar from '../Avatar/Avatar';
import DishBowl from '../DishBowl/DishBowl';
import Photo from '../Photo/Photo';
import { RecipeFacts } from '../RecipeView/RecipeView';
import s from './FeaturedCarousel.module.css';

/**
 * Khoi's code (port từ prototype 20/10/2026): khung chiếu công thức kiểu trang chủ Epic Games Store —
 * khung lớn chia đôi (chữ trái, ảnh phải) + danh sách tối đa 5 công thức bên phải.
 *
 * Tự chuyển sau 7 giây. Thời gian do CSS animation của thanh tiến độ đếm (hết animation → sang bài kế),
 * nên tạm dừng chỉ là `animation-play-state: paused`. Dừng khi rê chuột vào hoặc Tab vào bên trong.
 * prefers-reduced-motion: thanh không chạy → không tự chuyển.
 *
 * @param {object[]} items       công thức (dạng GET /api/recipes)
 * @param {(id) => string} hrefOf
 * @param {(item) => string|undefined} [flagOf]  nhãn dị ứng, vd "Có Đậu phộng"
 */
export const SLIDE_MS = 7000;

const Cover = ({ it, thumb }) => (it.thumbnailUrl
  ? <Photo src={it.thumbnailUrl} className={s.photo} />
  : <div className={s.fallback}><div className={thumb ? s.plateSm : s.plate}><DishBowl name={it.dishName} /></div></div>);

export default function FeaturedCarousel({ items, hrefOf, flagOf = () => undefined }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false); // đang rê chuột / đang focus bên trong
  if (!items.length) return null;
  // Danh sách có thể ngắn lại (vd bật "Ẩn món tôi dị ứng") → không để chỉ số vượt quá
  const current = Math.min(active, items.length - 1);
  const it = items[current];
  const flag = flagOf(it);
  const time = (it.prepTimeMinutes ?? 0) + (it.cookTimeMinutes ?? 0) || undefined;

  return (
    <div
      className={s.wrap}
      aria-roledescription="băng chuyền"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPaused(false)}
    >
      <article
        key={it.id}
        className={s.slide}
        aria-roledescription="trang chiếu"
        aria-label={`${current + 1} trên ${items.length}`}
        aria-live={paused ? 'polite' : 'off'}
        // Cả khung bấm được bằng chuột; bàn phím / trình đọc màn hình dùng link ở tiêu đề
        onClick={(e) => { if (!e.target.closest('a, button')) window.location.assign(hrefOf(it.id)); }}
      >
        {/* Ảnh đứng trước chữ trong DOM: cùng là phần tử định vị, cái sau nằm trên → chữ luôn nằm trên ảnh */}
        <a href={hrefOf(it.id)} className={s.media} tabIndex={-1} aria-hidden="true"><Cover it={it} /></a>
        <div className={s.text}>
          <div className={s.top}>
            <span className={s.dish}><i className="bi bi-bookmark" aria-hidden="true" /> {it.dishName}</span>
            {flag && <span className={s.flag}><i className="bi bi-exclamation-triangle-fill" aria-hidden="true" /> {flag}</span>}
          </div>
          <div className={s.mid}>
            <h3 className={s.title}><a href={hrefOf(it.id)}>{it.title}</a></h3>
            {it.description && <p className={s.desc}>{it.description}</p>}
          </div>
          <div className={s.foot}>
            <div className={s.by}>
              <Avatar src={it.authorAvatarUrl ?? undefined} name={it.authorName} size={24} />
              <span className={s.author}>{it.authorName}</span>
              {/* Lượt thích: chỉ hiện khi API có (chưa có bảng lượt thích) */}
              {it.likeCount != null && (
                <span><i className="bi bi-hand-thumbs-up" aria-hidden="true" /> {it.likeCount}<span className="visually-hidden"> lượt thích</span></span>
              )}
            </div>
            <RecipeFacts cookTimeMinutes={time} servings={it.servings ?? undefined} calories={it.caloriesKcal ?? undefined} size="sm" />
          </div>
        </div>
      </article>

      <ul className={s.list} aria-label="Chọn công thức">
        {items.map((x, i) => (
          <li key={x.id}>
            <button
              type="button"
              className={s.item}
              aria-current={i === current ? 'true' : undefined}
              onClick={() => setActive(i)}
            >
              {i === current && items.length > 1 && (
                <span
                  key={x.id}
                  className={s.progress}
                  style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }}
                  onAnimationEnd={() => setActive((current + 1) % items.length)}
                  aria-hidden="true"
                />
              )}
              <span className={s.thumb}><Cover it={x} thumb /></span>
              <span className={s.name}>{x.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
