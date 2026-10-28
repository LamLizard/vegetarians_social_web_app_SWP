import { useEffect, useMemo, useState } from 'react';
import Button from '../components/Button/Button';
import Checkbox from '../components/Checkbox/Checkbox';
import DishBowl from '../components/DishBowl/DishBowl';
import EmptyState from '../components/EmptyState/EmptyState';
import FeaturedCarousel from '../components/FeaturedCarousel/FeaturedCarousel';
import FeedTopbar from '../components/FeedTopbar/FeedTopbar';
import MemberLayout from '../components/MemberLayout/MemberLayout';
import Notice from '../components/Notice/Notice';
import Select from '../components/Select/Select';
import RecipeCard from '../components/RecipeCard/RecipeCard';
import SearchInput from '../components/SearchInput/SearchInput';
import Skeleton from '../components/Skeleton/Skeleton';
import recipeService from '../services/recipe.service';
import { getHealthProfile } from '../services/user.service';
import useHideAllergen from '../hooks/useHideAllergen';
import { plain } from '../utils/dishMatch';
import s from './RecipeListPage.module.css';

/**
 * Khoi's code: Trang Công thức (/recipes) — port từ prototype (bố cục C, chốt 18/10/2026; khung Nổi bật 20/10/2026).
 *  Không tìm/lọc: khối đầu (khung chiếu 5 công thức mới duyệt) + mỗi danh mục 1 hàng 3 công thức mới nhất + "Xem tất cả".
 *  Có từ khoá hoặc chọn danh mục (/recipes?q=…&dm=…): kết quả phẳng dạng lưới, có chip danh mục.
 *  Mọi chế độ: thẻ có nguyên liệu trùng dị ứng (hồ sơ sức khỏe) → nhãn đỏ; công tắc "Ẩn món tôi dị ứng".
 *  Ai cũng xem được, kể cả khách (khách không có dị ứng → không hiện công tắc).
 *
 * Khối đầu "Nổi bật tuần này" = nhiều lượt thích nhất 7 ngày (bằng nhau → mới duyệt trước), thiếu thì lấy thêm công thức
 *  mới duyệt; tuần chưa ai thích → tiêu đề "Mới duyệt tuần này" (không ghi "nổi bật" sai sự thật).
 *  Lượt thích: bảng recipe_like · "mới duyệt" theo recipe.moderated_at (database-seed/SWP_PostgreSQL_20_10_recipe_like_up.sql).
 * Khác prototype: danh mục chưa có thứ tự Admin sắp → xếp theo tên.
 *
 * @param {{id, fullName, role, avatarUrl?}|null} user   null = khách
 * @param {{icon?, label, onClick, tone?}[]} [accountMenu]
 * @param {() => void} [onLogin] · [onRegister]   chỉ dùng khi là khách
 */

const FEATURED = 5;
const PER_ROW = 3;
const PAGE = 9;
const byNewest = (a, b) => new Date(b.moderatedAt) - new Date(a.moderatedAt);
const SORTS = [
  { value: 'new', label: 'Mới nhất' },
  { value: 'likes', label: 'Nhiều lượt thích' },
];
const href = (id) => `/recipes/${id}`;

/** URL hiện tại → { q, dm } (dm = id danh mục dạng chuỗi) */
const readQuery = () => {
  const p = new URLSearchParams(window.location.search);
  return { q: p.get('q') ?? '', dm: p.get('dm') || null };
};
const toUrl = ({ q = '', dm = null } = {}) => {
  const p = new URLSearchParams();
  if (q.trim()) p.set('q', q.trim());
  if (dm) p.set('dm', dm);
  const qs = p.toString();
  return qs ? `/recipes?${qs}` : '/recipes';
};

export default function RecipeListPage({ user, accountMenu = [], onLogin, onRegister }) {
  const [query, setQuery] = useState(readQuery);
  const { q, dm } = query;
  const [state, setState] = useState({ status: 'loading', items: [], categories: [] });
  const [text, setText] = useState(q);
  const [allergies, setAllergies] = useState([]);
  const [hideAllergen, setHideAllergen] = useHideAllergen(user?.id); // 27/10: nhớ qua các lần mở trang
  const [shown, setShown] = useState(PAGE);
  const [sort, setSort] = useState('new');

  // Đổi từ khoá / danh mục: ghi lên thanh địa chỉ (Back của trình duyệt quay lại được), không tải lại trang
  const go = (next) => {
    window.history.pushState(null, '', toUrl(next));
    setQuery(readQuery());
  };
  useEffect(() => {
    const onPop = () => setQuery(readQuery());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => { setText(q); setShown(PAGE); }, [q, dm]);

  const fetchIt = () => {
    setState({ status: 'loading', items: [], categories: [] });
    recipeService.listRecipes()
      .then(({ items, categories }) => setState({ status: 'ready', items, categories }))
      .catch(() => setState({ status: 'error', items: [], categories: [] }));
  };
  useEffect(fetchIt, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Dị ứng trong hồ sơ sức khỏe (chỉ thành viên). Chưa có hồ sơ / lỗi → không cảnh báo, trang vẫn chạy.
  useEffect(() => {
    if (user?.role !== 'member') return undefined;
    let alive = true;
    getHealthProfile()
      .then(({ profile }) => { if (alive) setAllergies((profile?.allergies ?? []).map((a) => a.name).filter(Boolean)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [user?.role]);

  useEffect(() => { document.title = 'Công thức'; }, []);

  // Dị ứng của người xem → nhãn đỏ trên thẻ ("Có Đậu phộng")
  const allergyKeys = useMemo(() => allergies.map((a) => [a, plain(a)]).filter(([, k]) => k), [allergies]);
  const allergenOf = (it) => {
    const hit = allergyKeys.find(([, k]) => it.ingredientNames.some((n) => plain(n).includes(k)));
    return hit ? `Có ${hit[0]}` : undefined;
  };

  const all = state.items.filter((it) => !(hideAllergen && allergenOf(it)));
  const browsing = !q && !dm;
  const categories = state.categories;

  const card = (it) => (
    <RecipeCard
      key={it.id}
      layout="card"
      href={href(it.id)}
      title={it.title}
      dishName={it.dishName}
      imageUrl={it.thumbnailUrl ?? undefined}
      fallback={<div className={s.plate}><DishBowl name={it.dishName} /></div>}
      author={{ name: it.authorName, avatarUrl: it.authorAvatarUrl ?? undefined }}
      createdAt={it.moderatedAt}
      cookTimeMinutes={(it.prepTimeMinutes ?? 0) + (it.cookTimeMinutes ?? 0) || undefined}
      servings={it.servings ?? undefined}
      calories={it.caloriesKcal ?? undefined}
      likeCount={it.likeCount}
      flag={allergenOf(it)}
    />
  );

  // ---------- Chế độ duyệt: nổi bật + các hàng danh mục ----------
  const liked = all.filter((it) => it.likesThisWeek > 0).sort((a, b) => b.likesThisWeek - a.likesThisWeek || byNewest(a, b));
  const featuredTitle = liked.length ? 'Nổi bật tuần này' : 'Mới duyệt tuần này';
  const featuredHint = liked.length ? 'Nhiều lượt thích nhất trong 7 ngày' : 'Công thức vừa được Admin duyệt';
  const featured = [...liked, ...[...all].sort(byNewest).filter((it) => !liked.includes(it))].slice(0, FEATURED);
  const sections = categories
    .map((c) => ({ ...c, items: all.filter((it) => it.categoryIds.includes(c.id)).sort(byNewest) }))
    .filter((c) => c.items.length > 0);

  // ---------- Chế độ kết quả: tìm và/hoặc lọc danh mục ----------
  const cat = categories.find((c) => c.id === dm);
  const key = plain(q);
  const results = all
    .filter((it) => !dm || it.categoryIds.includes(dm))
    .filter((it) => !key || plain(`${it.title} ${it.dishName}`).includes(key))
    .sort(sort === 'likes' ? (a, b) => b.likeCount - a.likeCount || byNewest(a, b) : byNewest);

  const createAction = user
    ? <Button as="a" href="/recipes/new" icon="plus-lg">Tạo công thức đầu tiên</Button>
    : onLogin && <Button onClick={onLogin} icon="box-arrow-in-right">Đăng nhập để chia sẻ</Button>;

  // Khoi's code: trang đã có ô tìm công thức riêng → ẩn ô tìm bài viết trên thanh trên (điện thoại vẫn giữ nút ☰)
  const topbar = ({ openMenu }) => (
    <FeedTopbar hideSearch value="" onChange={() => {}} onSearch={() => {}} onOpenMenu={openMenu} />
  );

  return (
    <MemberLayout
      activeKey="recipes"
      user={user}
      accountMenu={accountMenu}
      onCreate={user ? () => window.location.assign('/?compose=1') : undefined}
      onLogin={onLogin}
      onRegister={onRegister}
      renderTopbar={topbar}
    >
      <div className={s.page}>
        <header className={s.head}>
          <div className={s.headText}>
            <h1 className={s.title}>Công thức</h1>
            <p className={s.desc}>Cách nấu món chay do cộng đồng chia sẻ, đã được Admin duyệt.</p>
          </div>
        </header>

        <div className={s.tools}>
          <div className={s.search}>
            <SearchInput
              value={text}
              onChange={setText}
              onSearch={(v) => go({ q: v, dm })}
              size="lg"
              label="Tìm công thức"
              placeholder="Tìm theo tên món hoặc công thức, ví dụ: canh chua"
            />
          </div>
          {allergyKeys.length > 0 && (
            <Checkbox switch checked={hideAllergen} onChange={setHideAllergen}>Ẩn món tôi dị ứng</Checkbox>
          )}
        </div>

        {state.status === 'loading' && (
          <div className={`${s.grid} ${s.firstBlock}`} role="status" aria-label="Đang tải công thức">
            {[0, 1, 2].map((k) => <div key={k} className={s.skCard}><Skeleton shape="block" height={160} /><Skeleton lines={2} /></div>)}
          </div>
        )}

        {state.status === 'error' && (
          <div className={s.firstBlock}>
            <Notice tone="alert" title="Chưa tải được công thức" action={{ label: 'Tải lại', onClick: fetchIt }}>
              Kiểm tra kết nối mạng rồi thử lại nhé.
            </Notice>
          </div>
        )}

        {state.status === 'ready' && browsing && (
          all.length === 0 ? (
            <div className={s.firstBlock}>
              <EmptyState icon="journal-plus" title="Chưa có công thức nào" action={hideAllergen ? null : createAction}>
                {hideAllergen ? 'Mọi công thức hiện có đều có món bạn dị ứng.' : 'Bạn biết cách nấu món chay nào? Chia sẻ để mọi người cùng làm.'}
              </EmptyState>
            </div>
          ) : (
            <>
              <section className={s.section} aria-labelledby="rl-featured">
                <div className={s.secHead}>
                  <h2 id="rl-featured" className={s.h2}>{featuredTitle}</h2>
                  <span className={s.secHint}>{featuredHint}</span>
                </div>
                <FeaturedCarousel items={featured} hrefOf={href} flagOf={allergenOf} />
              </section>

              {sections.map((c) => (
                <section key={c.id} className={s.section} aria-labelledby={`rl-cat-${c.id}`}>
                  <div className={s.secHead}>
                    <div className={s.secTitle}>
                      <h2 id={`rl-cat-${c.id}`} className={s.h2}>{c.name}</h2>
                      <span className={s.secHint}>{c.items.length} công thức</span>
                    </div>
                    {c.items.length > PER_ROW && (
                      <a className={s.more} href={toUrl({ dm: c.id })} onClick={(e) => { e.preventDefault(); go({ dm: c.id }); }}>
                        Xem tất cả {c.name.toLowerCase()}
                      </a>
                    )}
                  </div>
                  <div className={s.grid}>{c.items.slice(0, PER_ROW).map(card)}</div>
                </section>
              ))}
            </>
          )
        )}

        {state.status === 'ready' && !browsing && (
          <section className={s.section} aria-labelledby="rl-results">
            <nav className={s.crumbs} aria-label="Đường dẫn">
              <a href="/recipes" onClick={(e) => { e.preventDefault(); go(); }}>Công thức</a>
              <i className="bi bi-chevron-right" aria-hidden="true" />
              <span aria-current="page">{cat ? cat.name : 'Kết quả tìm kiếm'}</span>
            </nav>
            {categories.length > 0 && (
              <div className={s.chips} role="group" aria-label="Lọc theo danh mục">
                <button type="button" className={`${s.chip} ${!dm ? s.chipOn : ''}`} aria-pressed={!dm} onClick={() => go({ q })}>Tất cả</button>
                {categories.map((c) => (
                  <button key={c.id} type="button" className={`${s.chip} ${dm === c.id ? s.chipOn : ''}`} aria-pressed={dm === c.id} onClick={() => go({ q, dm: c.id })}>{c.name}</button>
                ))}
              </div>
            )}
            <div className={s.resultBar}>
              <h2 id="rl-results" className={s.count}>
                {results.length} công thức{q ? <> cho “<b>{q}</b>”</> : null}{cat ? ` trong ${cat.name.toLowerCase()}` : ''}
              </h2>
              <div className={s.sort}><Select label="Sắp xếp" options={SORTS} value={sort} onChange={setSort} size="sm" /></div>
            </div>

            {results.length === 0 ? (
              <EmptyState icon="search" title={q ? `Không có công thức khớp “${q}”` : 'Danh mục này chưa có công thức'}
                action={<Button variant="outline" onClick={() => { setHideAllergen(false); go(); }}>Xoá bộ lọc</Button>}>
                Thử từ khoá khác, chọn danh mục khác{allergyKeys.length ? ' hoặc tắt “Ẩn món tôi dị ứng”' : ''}.
              </EmptyState>
            ) : (
              <>
                <div className={s.grid}>{results.slice(0, shown).map(card)}</div>
                {results.length > shown && (
                  <Button variant="outline" className={s.loadMore} onClick={() => setShown((n) => n + PAGE)}>
                    Xem thêm ({shown}/{results.length})
                  </Button>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </MemberLayout>
  );
}
