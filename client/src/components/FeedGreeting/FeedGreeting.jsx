// Khoi's code: Lời chào cột trái của Bảng tin — theo prototype UI v2 (src/v2/components/Hero.jsx + TodayDish.jsx).
// Chỉ giữ phần lời chào (quyết định 09/10/2026). Ẩn: số liệu cộng đồng, thẻ "Mầm gợi ý hôm nay"
// vì chưa có dữ liệu thật. Không thêm thư viện, hiệu ứng viết bằng CSS.
// Khoi's code (16/10/2026): thẻ "Hôm nay ăn gì?" phong cách Organic, bố cục A
//  - Câu hỏi 24px làm tiêu đề cạnh đĩa món, tên món bên dưới cả bề ngang thẻ.
//  - Món lấy từ DB (GET /recipes/dishes, chỉ món active), KHÔNG có danh sách viết cứng.
//  - Tự đổi món 4 giây/lần, không có nút. Rê chuột vào thẻ → dừng để đọc.
//  - Hình món luôn là hình bát minh hoạ (không dùng ảnh thật) để mọi món cùng 1 kiểu.
//  - Đang tải → khung xám; lỗi hoặc chưa có món → ẩn thẻ, chỉ còn lời chào.
import { useEffect, useState } from 'react';
import recipeService from '../../services/recipe.service';
import s from './FeedGreeting.module.css';

const ROTATE_MS = 4000;

const greet = (h = new Date().getHours()) => {
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
};

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const shuffle = (list) => {
  const a = [...list];
  for (let k = a.length - 1; k > 0; k -= 1) {
    const j = Math.floor(Math.random() * (k + 1));
    [a[k], a[j]] = [a[j], a[k]];
  }
  return a;
};

// Tên ngắn → chữ to, tên dài → chữ nhỏ dần để luôn vừa khung cố định
const sizeOf = (name) => {
  const n = name.length;
  if (n <= 10) return 'xl';
  if (n <= 18) return 'lg';
  return n <= 40 ? 'md' : 'sm';
};

// Mỗi món 1 màu nước sốt cố định theo tên
const TONES = ['tone1', 'tone2', 'tone3'];
const toneOf = (name) => TONES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length];

/** Hình bát món nhìn từ trên xuống */
function Bowl({ tone }) {
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

function TodayDish() {
  const [dishes, setDishes] = useState(null); // null = đang tải
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let alive = true;
    recipeService.getActiveDishes()
      .then(({ items = [] }) => {
        if (!alive) return;
        const list = items
          .map((d) => ({ id: d.dish_id ?? d.id, name: (d.name ?? '').trim() }))
          .filter((d) => d.name);
        setDishes(shuffle(list));
        setI(0);
      })
      .catch(() => alive && setDishes([]));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!dishes || dishes.length < 2 || paused || reduceMotion()) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % dishes.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [dishes, paused]);

  if (dishes && dishes.length === 0) return null;
  const dish = dishes?.[i];

  return (
    <section
      className={s.card}
      aria-label="Hôm nay ăn gì?"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <svg className={s.leaf} viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <path d="M110 10C80 30 50 60 24 110" />
        <path d="M84 30c-20-4-34 6-38 22 18 4 32-4 38-22z" />
        <path d="M66 54c-18 2-28 16-26 32 16-2 26-14 26-32z" />
      </svg>

      <p className={s.ask}>Hôm nay ăn gì?</p>

      {dish ? (
        <>
          <div key={`p-${dish.id}-${i}`} className={s.plate}><Bowl tone={toneOf(dish.name)} /></div>
          <p className={`${s.name} ${s[sizeOf(dish.name)]}`} aria-live={paused ? 'polite' : 'off'}>
            <span key={`n-${dish.id}-${i}`} className={s.swap}>{dish.name}</span>
          </p>
        </>
      ) : (
        <>
          <div className={`${s.plate} ${s.sk}`} aria-busy="true" />
          <div className={`${s.name} ${s.skLines}`}><span className={s.sk} /><span className={s.sk} /></div>
        </>
      )}
    </section>
  );
}

/** @param {{name: string}|null} user   null = khách → không gọi tên */
export default function FeedGreeting({ user }) {
  const firstName = user?.name?.trim().split(/\s+/).pop();

  return (
    <div className={s.hero}>
      <p className={s.title}>{greet()}{firstName ? `, ${firstName}` : ''}.</p>
      <TodayDish />
      <p className={s.lead}>Công thức, mẹo bếp và quán chay ngon quanh bạn.</p>
    </div>
  );
}
