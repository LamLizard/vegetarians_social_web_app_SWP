import { useEffect, useState } from 'react';
import Avatar from '../components/Avatar/Avatar';
import Button from '../components/Button/Button';
import EmptyState from '../components/EmptyState/EmptyState';
import Notice from '../components/Notice/Notice';
import NumberStepper from '../components/NumberStepper/NumberStepper';
import PageHeader from '../components/PageHeader/PageHeader';
import Photo from '../components/Photo/Photo';
import Skeleton from '../components/Skeleton/Skeleton';
import YouTubeEmbed from '../components/YouTubeEmbed/YouTubeEmbed';
import { IngredientList, RecipeFacts, RecipeSteps } from '../components/RecipeView/RecipeView';
import FeedTopbar from '../components/FeedTopbar/FeedTopbar';
import MemberLayout from '../components/MemberLayout/MemberLayout';
import { formatNumber, timeAgo } from '../utils/format';
import recipeService from '../services/recipe.service';
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
  const [searchText, setSearchText] = useState('');

  const load = async () => {
    setState({ status: 'loading', recipe: null });
    try {
      const recipe = await recipeService.getRecipe(recipeId);
      setState({ status: 'ready', recipe });
      setServings(recipe.servings ?? null);
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

  // Thanh trên: tìm kiếm bài viết → về Bảng tin kèm từ khoá (giống trang Tạo công thức)
  const topbar = ({ openMenu }) => (
    <FeedTopbar
      value={searchText}
      onChange={setSearchText}
      onSearch={(q) => { if (q) window.location.assign(`/?q=${encodeURIComponent(q)}`); }}
      onOpenMenu={openMenu}
    />
  );

  const totalTime = (r?.prepTimeMinutes ?? 0) + (r?.cookTimeMinutes ?? 0);
  const nutrition = r ? NUTRIENTS.filter((n) => r[n.api] != null) : [];
  const timeParts = [
    r?.prepTimeMinutes ? `Chuẩn bị ${r.prepTimeMinutes} phút` : null,
    r?.cookTimeMinutes ? `Nấu ${r.cookTimeMinutes} phút` : null,
  ].filter(Boolean);

  return (
    <MemberLayout
      user={user}
      accountMenu={accountMenu}
      onCreate={user ? () => window.location.assign('/?compose=1') : undefined}
      onLogin={onLogin}
      onRegister={onRegister}
      renderTopbar={topbar}
    >
      <div className={s.page}>
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
              breadcrumb={[{ label: 'Bảng tin', href: '/' }, { label: 'Công thức' }]}
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
          </>
        )}
      </div>
    </MemberLayout>
  );
}
