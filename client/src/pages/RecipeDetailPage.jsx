import { useEffect, useMemo, useState } from 'react';
import Avatar from '../components/Avatar/Avatar';
import Button from '../components/Button/Button';
import DishBowl from '../components/DishBowl/DishBowl';
import EmptyState from '../components/EmptyState/EmptyState';
import Notice from '../components/Notice/Notice';
import NumberStepper from '../components/NumberStepper/NumberStepper';
import PageHeader from '../components/PageHeader/PageHeader';
import Photo from '../components/Photo/Photo';
import RecipeCard from '../components/RecipeCard/RecipeCard';
import Skeleton from '../components/Skeleton/Skeleton';
import VoteButton from '../components/VoteButton/VoteButton';
import YouTubeEmbed from '../components/YouTubeEmbed/YouTubeEmbed';
import { IngredientList, RecipeFacts, RecipeSteps } from '../components/RecipeView/RecipeView';
import FeedTopbar from '../components/FeedTopbar/FeedTopbar';
import MemberLayout from '../components/MemberLayout/MemberLayout';
import { formatNumber, timeAgo } from '../utils/format';
import recipeService from '../services/recipe.service';
import { getHealthProfile } from '../services/user.service';
import { plain } from '../utils/dishMatch';
import s from './RecipeDetailPage.module.css';

// Khoi's code: Trang xem công thức đã duyệt (/recipes/:id) — 15/10/2026.
// Ai cũng xem được, kể cả khách (server chỉ trả công thức 'approved' của món đang 'active').
// Lối vào: tab "Công thức đã gửi" (công thức Đã duyệt) và link trong thông báo "được duyệt".
// Chưa làm (để nhóm làm trang xem công thức chung): danh sách công thức, nút báo cáo.

/** Khoi's code: chỉ số dinh dưỡng tuỳ chọn (1 người); `tone` = màu có sẵn trong theme (--ac-protein…) */
const NUTRIENTS = [
  { api: 'proteinG', label: 'Đạm', unit: 'g', tone: 'protein' },
  { api: 'carbG', label: 'Tinh bột', unit: 'g', tone: 'carb' },
  { api: 'fatG', label: 'Chất béo', unit: 'g', tone: 'fat' },
  { api: 'fiberG', label: 'Chất xơ', unit: 'g', tone: 'fiber' },
  { api: 'sugarG', label: 'Đường', unit: 'g' },
  { api: 'sodiumMg', label: 'Natri', unit: 'mg' },
];
/** Khoi's code 20/10: số công thức gợi ý ở cuối trang */
const RELATED_MAX = 3;

/**
 * Khoi's code 20/10: chọn công thức gợi ý từ danh sách công khai (GET /api/recipes).
 * Bỏ công thức đang xem · cùng món trước → cùng loại món → còn lại. Cùng hạng thì nhiều lượt thích, rồi mới duyệt.
 */
export function pickRelated(items, current, max = RELATED_MAX) {
  const me = items.find((it) => it.id === current.id);
  const cats = new Set(me?.categoryIds ?? []);
  const score = (it) => (it.dishId === current.dishId ? 2 : it.categoryIds?.some((c) => cats.has(c)) ? 1 : 0);
  return items
    .filter((it) => it.id !== current.id)
    .map((it) => ({ it, rank: score(it) }))
    .sort((a, b) => b.rank - a.rank
      || (b.it.likeCount ?? 0) - (a.it.likeCount ?? 0)
      || String(b.it.moderatedAt).localeCompare(String(a.it.moderatedAt)))
    .slice(0, max)
    .map((x) => x.it);
}

/**
 * Khoi's code 20/10: nút "Quay lại Công thức". Vừa đi từ trang Công thức sang → lùi lịch sử
 * (giữ từ khoá, loại món, vị trí cuộn). Mở thẳng link / đi từ chỗ khác → mở /recipes.
 */
const backToList = (e) => {
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    if (ref && ref.origin === window.location.origin && ref.pathname === '/recipes' && window.history.length > 1) {
      e.preventDefault();
      window.history.back();
    }
  } catch { /* referrer lạ → để link /recipes chạy bình thường */ }
};

const fmt = (n) => (Number.isInteger(n) ? formatNumber(n) : n.toLocaleString('vi-VN', { maximumFractionDigits: 1 }));

/**
 * @param {string} recipeId                       lấy từ URL ở App.jsx
 * @param {{id, fullName, role, avatarUrl?}|null} user   null = khách
 * @param {{icon?, label, onClick, tone?}[]} [accountMenu]
 * @param {() => void} [onLogin] · [onRegister]   chỉ dùng khi là khách
 */
export default function RecipeDetailPage({ recipeId, user, accountMenu = [], onLogin, onRegister }) {
  const [state, setState] = useState({ status: 'loading', recipe: null }); // loading | ready | notFound | error
  const [servings, setServings] = useState(null); // khẩu phần đang xem → số lượng nguyên liệu tự nhân
  const [like, setLike] = useState({ on: false, count: 0, busy: false }); // Khoi's code 20/10: nút Thích
  const [related, setRelated] = useState([]); // Khoi's code 20/10: công thức gợi ý cuối trang
  const [allergies, setAllergies] = useState([]); // tên dị ứng của thành viên → nhãn đỏ trên thẻ gợi ý

  const load = async () => {
    setState({ status: 'loading', recipe: null });
    try {
      const recipe = await recipeService.getRecipe(recipeId);
      setState({ status: 'ready', recipe });
      setServings(recipe.servings ?? null);
      setLike({ on: !!recipe.likedByMe, count: recipe.likeCount ?? 0, busy: false });
    } catch (err) {
      setState({ status: err.status === 404 || err.status === 400 ? 'notFound' : 'error', recipe: null });
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ tải lại khi đổi công thức
  }, [recipeId]);

  const r = state.recipe;
  useEffect(() => {
    if (r) document.title = `${r.title} · Công thức`;
  }, [r]);

  // Khoi's code 20/10: gợi ý công thức khác — tải sau khi có công thức; lỗi thì ẩn khối, trang vẫn chạy
  useEffect(() => {
    if (!r) return undefined;
    let alive = true;
    recipeService.listRecipes()
      .then(({ items }) => { if (alive) setRelated(pickRelated(items, r)); })
      .catch(() => { if (alive) setRelated([]); });
    return () => { alive = false; };
  }, [r]);

  // Dị ứng trong hồ sơ sức khỏe (chỉ thành viên) — giống trang Công thức
  useEffect(() => {
    if (user?.role !== 'member') return undefined;
    let alive = true;
    getHealthProfile()
      .then(({ profile }) => { if (alive) setAllergies((profile?.allergies ?? []).map((a) => a.name).filter(Boolean)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [user?.role]);
  const allergyKeys = useMemo(() => allergies.map((a) => [a, plain(a)]).filter(([, k]) => k), [allergies]);
  const allergenOf = (it) => {
    const hit = allergyKeys.find(([, k]) => (it.ingredientNames ?? []).some((n) => plain(n).includes(k)));
    return hit ? `Có ${hit[0]}` : undefined;
  };

  // Khoi's code: ẩn ô tìm bài viết trên thanh trên (điện thoại vẫn giữ nút ☰)
  const topbar = ({ openMenu }) => (
    <FeedTopbar hideSearch value="" onChange={() => {}} onSearch={() => {}} onOpenMenu={openMenu} />
  );

  // Khoi's code 20/10: Thích — đổi trên màn hình ngay, lỗi thì trả lại như cũ. Khách → đăng nhập.
  const toggleLike = async () => {
    if (!user) { onLogin?.(); return; }
    if (like.busy) return;
    const before = like;
    const on = !before.on;
    setLike({ on, count: before.count + (on ? 1 : -1), busy: true });
    try {
      const res = on ? await recipeService.likeRecipe(recipeId) : await recipeService.unlikeRecipe(recipeId);
      setLike({ on: res.liked, count: res.likeCount, busy: false });
    } catch {
      setLike({ ...before, busy: false });
    }
  };

  const totalTime = (r?.prepTimeMinutes ?? 0) + (r?.cookTimeMinutes ?? 0);
  const nutrition = r ? NUTRIENTS.filter((n) => r[n.api] != null) : [];
  const timeParts = [
    r?.prepTimeMinutes ? `Chuẩn bị ${r.prepTimeMinutes} phút` : null,
    r?.cookTimeMinutes ? `Nấu ${r.cookTimeMinutes} phút` : null,
  ].filter(Boolean);

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
        {/* Khoi's code 20/10: lối thoát rõ ràng về danh sách (User control and freedom) */}
        <a href="/recipes" className={s.back} onClick={backToList}>
          <i className="bi bi-arrow-left" aria-hidden="true" />Quay lại Công thức
        </a>

        {state.status === 'loading' && (
          <div className={s.card} role="status" aria-label="Đang tải công thức">
            <Skeleton shape="block" height={280} />
            <Skeleton lines={3} />
          </div>
        )}

        {state.status === 'notFound' && (
          <EmptyState
            icon="journal-x"
            title="Không tìm thấy công thức"
            action={<Button as="a" href="/" icon="house">Về Bảng tin</Button>}
          >
            Công thức không tồn tại, chưa được duyệt hoặc đã bị ẩn.
          </EmptyState>
        )}

        {state.status === 'error' && (
          <Notice tone="alert" title="Chưa tải được công thức" action={{ label: 'Tải lại', onClick: load }}>
            Kiểm tra kết nối mạng rồi thử lại nhé.
          </Notice>
        )}

        {state.status === 'ready' && (
          <>
            <PageHeader
              breadcrumb={[{ label: 'Công thức', href: '/recipes' }, { label: r.dishName }]}
              title={r.title}
              description={r.description || undefined}
            />

            <div className={s.byline}>
              <span className={s.dish}><i className="bi bi-bookmark" aria-hidden="true" />{r.dishName}</span>
              <span className={s.author}>
                <Avatar name={r.authorName} src={r.authorAvatarUrl ?? undefined} size={24} />
                <span>{r.authorName}</span>
              </span>
              <span className={s.when}>· {timeAgo(r.createdAt)}</span>
              <VoteButton className={s.like} noun="công thức" voted={like.on} count={like.count} onToggle={toggleLike} />
            </div>

            {r.thumbnailUrl && <Photo src={r.thumbnailUrl} alt={r.title} ratio="16/9" shape="rounded" />}

            <section className={`${s.card} ${s.factsCard}`} aria-label="Thông số">
              <RecipeFacts cookTimeMinutes={totalTime || undefined} servings={r.servings} calories={r.caloriesKcal} />
              {timeParts.length > 0 && <p className={s.hint}>{timeParts.join(' · ')}</p>}
              {nutrition.length > 0 && (
                <div className={s.nutri}>
                  <span className={s.nutriLabel}>Dinh dưỡng (1 người, ước tính)</span>
                  <ul className={s.nutriList}>
                    {nutrition.map((n) => (
                      <li key={n.api} className={s.nutriItem} data-tone={n.tone}>
                        <span>{n.label}</span><b>{fmt(r[n.api])} {n.unit}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <div className={s.grid}>
              <section className={s.card} aria-labelledby="rd-ing">
                <div className={s.head}>
                  <h2 id="rd-ing" className={s.h2}>Nguyên liệu</h2>
                  <p className={s.hint}>Bấm để gạch những thứ đã chuẩn bị.</p>
                </div>
                {r.servings ? (
                  <NumberStepper label="Khẩu phần" value={servings} onChange={setServings} min={1} max={20} unit="người" />
                ) : null}
                <IngredientList items={r.ingredients} baseServings={r.servings ?? undefined} servings={servings ?? undefined} checkable />
              </section>

              <section className={s.card} aria-labelledby="rd-steps">
                <div className={s.head}>
                  <h2 id="rd-steps" className={s.h2}>Cách làm</h2>
                </div>
                <RecipeSteps steps={r.instructions} />
              </section>
            </div>

            {r.youtubeUrl && (
              <section className={s.card} aria-labelledby="rd-video">
                <div className={s.head}>
                  <h2 id="rd-video" className={s.h2}>Video hướng dẫn</h2>
                </div>
                <YouTubeEmbed url={r.youtubeUrl} title={`Video: ${r.title}`} />
              </section>
            )}

            {/* Khoi's code 20/10: xem hết công thức → gợi ý thêm (cùng món → cùng loại món → nhiều lượt thích) */}
            {related.length > 0 && (
              <section className={s.related} aria-labelledby="rd-related">
                <div className={s.relatedHead}>
                  <h2 id="rd-related" className={s.h2}>Có thể bạn cũng thích</h2>
                  <a href="/recipes" className={s.more}>Xem tất cả công thức</a>
                </div>
                <div className={s.relatedGrid}>
                  {related.map((it) => (
                    <RecipeCard
                      key={it.id}
                      layout="card"
                      href={`/recipes/${encodeURIComponent(it.id)}`}
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
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </MemberLayout>
  );
}
