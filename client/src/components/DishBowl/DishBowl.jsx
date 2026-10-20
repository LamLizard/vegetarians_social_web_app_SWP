// Khoi's code: Hình bát món minh hoạ (20/10/2026) — dùng khi công thức chưa có ảnh bìa (trang Công thức, khung Nổi bật).
// Cùng hình với thẻ "Hôm nay ăn gì?" ở FeedGreeting (bản đó vẫn giữ riêng, không đổi).
import s from './DishBowl.module.css';

// Mỗi món 1 màu nước sốt cố định theo tên
const TONES = ['tone1', 'tone2', 'tone3'];
/** Tên món → 'tone1' | 'tone2' | 'tone3' (cùng tên luôn cùng màu) */
const toneOf = (name = '') => TONES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length];

/**
 * Bát món nhìn từ trên xuống.
 * @param {string} [name]   tên món → chọn màu sốt (hoặc truyền thẳng `tone`)
 * @param {'tone1'|'tone2'|'tone3'} [tone]
 */
export default function DishBowl({ name, tone = toneOf(name) }) {
  return (
    <svg className={`${s.bowl} ${s[tone]}`} viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="94" className={s.dish} />
      <circle cx="100" cy="100" r="72" className={s.sauce} />
      <rect x="62" y="66" width="30" height="30" rx="8" className={s.tofu} />
      <rect x="104" y="78" width="30" height="30" rx="8" className={s.tofu} />
      <rect x="74" y="108" width="30" height="30" rx="8" className={s.tofu} />
      <circle cx="128" cy="126" r="7" className={s.herb} />
      <circle cx="132" cy="62" r="6" className={s.herb} />
      <path d="M112 120c10-14 26-14 30-10-6 10-18 16-30 10z" className={s.herb} />
    </svg>
  );
}
