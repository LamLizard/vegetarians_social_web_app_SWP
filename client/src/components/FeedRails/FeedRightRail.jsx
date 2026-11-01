// Khoi's code (01/11/2026): cột PHẢI của Bảng tin = "khám phá" — theo prototype v4 (src/v4/components/Rail.jsx).
//  1. Quán chay đang mở — GET /api/shops (giờ mở cửa theo shop_schedule, tính bằng utils/time.js như trang Quán)
//  2. Nổi bật tuần này  — nhiều lượt thích 7 ngày nhất (likesThisWeek, giống khung Nổi bật trang Công thức)
//  3. Hỏi Mầm           — lối vào trang chatbot /chatbot
// Khách: chỉ có "Hỏi Mầm" (danh sách quán cần đăng nhập).
import { useMemo } from 'react';
import Photo from '../Photo/Photo';
import { getOpenStateFromSlots, getTodayHours } from '../../utils/time';
import RecipeMini from './RecipeMini';
import useRailHeight from './useRailHeight';
import s from './FeedRails.module.css';

const ASK_EXAMPLES = [
  'Gợi ý bữa tối chay dưới 500 kcal',
  'Thay trứng bằng gì khi làm bánh chay?',
  'Ăn chay sao cho đủ đạm?',
];

function ShopsBlock({ shops }) {
  const list = useMemo(() => {
    if (!shops) return null;
    const now = new Date();
    return shops
      .filter((x) => x.operatingStatus !== 'inactive')
      .map((x) => {
        const today = getTodayHours(x.schedule ?? [], now);
        const state = today.isClosed ? 'closed' : getOpenStateFromSlots(today.slots ?? [], now);
        const first = today.slots?.[0];
        const current = (today.slots ?? []).find((sl) => getOpenStateFromSlots([sl], now) !== 'closed');
        return { ...x, state, closeAt: current?.closeTime, openAt: first?.openTime };
      })
      .sort((a, b) => Number(b.state === 'open' || b.state === 'closingSoon') - Number(a.state === 'open' || a.state === 'closingSoon'));
  }, [shops]);
  const openCount = list?.filter((x) => x.state === 'open' || x.state === 'closingSoon').length ?? 0;

  return (
    <section className={s.box}>
      <div className={s.head}>
        <h2 className={s.title}>Quán chay đang mở</h2>
        {list && <span className={s.badge}>{openCount}/{list.length}</span>}
      </div>
      {!list && <div className={`${s.sk} ${s.skList}`} />}
      {list?.length === 0 && <p className={s.emptyText}>Chưa có quán nào được xác minh.</p>}
      {list?.length > 0 && (
        <ul className={s.shops}>
          {list.slice(0, 3).map((shop) => {
            const isOpen = shop.state === 'open' || shop.state === 'closingSoon';
            return (
              <li key={shop.id}>
                <a className={s.shop} href={`/shops/${encodeURIComponent(shop.id)}`}>
                  <Photo src={shop.imageUrl || undefined} alt="" ratio="1/1" className={s.shopImg} />
                  <span className={s.shopText}>
                    <b>{shop.name}</b>
                    {shop.address && <small>{shop.address}</small>}
                    <span className={isOpen ? s.open : s.closed}>
                      {isOpen
                        ? (shop.state === 'closingSoon' ? `Sắp đóng · ${shop.closeAt ?? ''}` : `Mở đến ${shop.closeAt ?? ''}`)
                        : (shop.openAt ? `Đóng cửa · mở lúc ${shop.openAt}` : 'Hôm nay nghỉ')}
                    </span>
                  </span>
                  <i className={`bi bi-chevron-right ${s.go}`} aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <a className={s.all} href="/shops">Xem tất cả quán chay <i className="bi bi-arrow-right" aria-hidden="true" /></a>
    </section>
  );
}

/**
 * @param {boolean} isGuest
 * @param {object[]|null} shops     GET /api/shops items (null = đang tải)
 * @param {object[]|null} recipes   GET /api/recipes items (null = đang tải)
 * @param {(recipe) => void} onLike
 */
export default function FeedRightRail({ isGuest, shops, recipes, onLike }) {
  const ref = useRailHeight();
  const featured = useMemo(() => {
    if (!recipes) return null;
    const byNew = (a, b) => String(b.moderatedAt ?? '').localeCompare(String(a.moderatedAt ?? ''));
    const liked = recipes.filter((r) => r.likesThisWeek > 0).sort((a, b) => b.likesThisWeek - a.likesThisWeek || byNew(a, b));
    return { weekly: liked.length > 0, items: (liked.length ? liked : [...recipes].sort(byNew)).slice(0, 3) };
  }, [recipes]);

  return (
    <aside ref={ref} className={s.rail} aria-label="Khám phá">
      {!isGuest && <ShopsBlock shops={shops} />}

      {!isGuest && (
        <section className={s.box}>
          <div className={s.head}>
            <h2 className={s.title}>{featured && !featured.weekly ? 'Mới duyệt' : 'Nổi bật tuần này'}</h2>
            <a className={s.more} href="/recipes">Công thức</a>
          </div>
          {!featured && <div className={`${s.sk} ${s.skList}`} />}
          {featured?.items.length > 0 && (
            <ul className={s.recipes}>
              {featured.items.map((r, i) => (
                <RecipeMini key={r.id} recipe={r} rank={i + 1} info={featured.weekly ? 'week' : 'meta'} onLike={onLike} />
              ))}
            </ul>
          )}
        </section>
      )}

      <section className={s.box}>
        <div className={s.askHead}>
          <span className={s.askIcon} aria-hidden="true"><i className="bi bi-chat-heart" /></span>
          <div>
            <h2 className={s.title}>Hỏi Mầm</h2>
            <small>Trợ lý cho những bữa ăn chay của bạn</small>
          </div>
        </div>
        {/* Bấm câu hỏi → mở trang Mầm (chưa điền sẵn câu: trang chatbot của Tùng chưa nhận câu hỏi từ link) */}
        <div className={s.asks}>
          {ASK_EXAMPLES.map((q) => (
            <a key={q} className={s.ask} href="/chatbot">
              <span>{q}</span>
              <i className="bi bi-arrow-up-right" aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>

      <p className={s.foot}>Green Bowl · Cộng đồng ăn chay · 2026</p>
    </aside>
  );
}
