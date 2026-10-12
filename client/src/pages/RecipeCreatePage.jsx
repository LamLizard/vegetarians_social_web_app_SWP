import { useEffect, useMemo, useState } from 'react';
import Avatar from '../components/Avatar/Avatar';
import Button from '../components/Button/Button';
import EmptyState from '../components/EmptyState/EmptyState';
import HighlightChip from '../components/HighlightChip/HighlightChip';
import ImageUpload from '../components/ImageUpload/ImageUpload';
import IngredientEditor from '../components/IngredientEditor/IngredientEditor';
import Notice from '../components/Notice/Notice';
import NumberStepper from '../components/NumberStepper/NumberStepper';
import PageHeader from '../components/PageHeader/PageHeader';
import Photo from '../components/Photo/Photo';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import StepEditor from '../components/StepEditor/StepEditor';
import Tabs from '../components/Tabs/Tabs';
import TextField from '../components/TextField/TextField';
import { useToast } from '../components/Toast/Toast';
import { cleanIngredients, newIngredientRow, validateIngredients } from '../utils/ingredient';
import { timeAgo } from '../utils/format';
import DishPicker from '../components/DishPicker/DishPicker';
import FeedTopbar from '../components/FeedTopbar/FeedTopbar';
import MemberLayout from '../components/MemberLayout/MemberLayout';
import postService from '../services/post.service';
import recipeService from '../services/recipe.service';
import s from './RecipeCreatePage.module.css';

// Khoi's code: Trang Tạo công thức (/recipes/new) — chép từ prototype (Prototype_UI_SWP/src/v2/recipe, 11/10/2026).
// PHƯƠNG ÁN B (12/10/2026): gọi API thật /api/recipes (DB đã có recipe.status, proposed_dish_name, recipe_proposed_ingredient).
// Nguyên liệu chưa có trong kho → vẫn gửi được, Admin duyệt cùng công thức. Nghi không chay → tô đỏ, không chặn.
// Lối vào: hộp tài khoản ở thanh bên → "Tạo công thức" (App.jsx).
/**
 * Trang Tạo công thức — bố cục B (đã chốt 11/10/2026):
 *  form 608px (4 khối) | cột phụ 336px cố định khi cuộn (Xem trước + Gửi).
 *  Tab thứ 2 "Công thức đã gửi": trạng thái Chờ duyệt / Đã duyệt / Bị từ chối + lý do.
 * Gửi xong: recipe.status = 'pending', KHÔNG tạo Dish (món đề xuất chỉ là chữ gửi kèm).
 */

const toMinutes = (v) => (v === '' || v == null ? null : Math.max(0, Math.min(600, Number(v))));
/** Khoá so tên nguyên liệu giống server (gộp khoảng trắng, không phân biệt hoa/thường) */
const nameKey = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** Kết quả soi 1 nguyên liệu → lưu ý dưới dòng đó (IngredientEditor rowNotes) */
function ingredientNote(c) {
  if (!c) return undefined;
  const missing = c.known ? '' : ' Chưa có trong kho nguyên liệu đã duyệt, sẽ gửi Admin duyệt cùng công thức.';
  if (c.isAnimalDerived) return { tone: 'bad', text: `Kho ghi đây là nguyên liệu có nguồn gốc động vật. Admin sẽ kiểm tra lại.${missing}` };
  if (c.keyword) return { tone: 'bad', text: `Tên có từ “${c.keyword}”, có thể không phải đồ chay. Admin sẽ kiểm tra lại.${missing}` };
  if (!c.known) return { tone: 'warn', text: missing.trim() };
  return undefined;
}

const emptyForm = () => ({
  dish: null,
  title: '',
  thumbnail: '',
  servings: null,
  prep: '',
  cook: '',
  ingredients: [newIngredientRow()],
  steps: [''],
});

/** Khối form: tiêu đề + 1 dòng gợi ý (đúng box model: tiêu đề → gợi ý 4, → nội dung 16) */
function Section({ id, title, hint, required, onLeave, children }) {
  return (
    <section id={id} className={`${s.card} ${s.anchor}`} onBlur={onLeave}>
      <div className={s.head}>
        <h2 className={s.h2}>
          {title}
          {required && <span className={s.req} aria-hidden="true"> *</span>}
          {required && <span className="visually-hidden"> (bắt buộc)</span>}
        </h2>
        {hint && <p className={s.hint}>{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * @param {{id, fullName, role, avatarUrl?}} user   thành viên đang đăng nhập (useAuth ở App)
 * @param {{icon?, label, onClick, tone?}[]} [accountMenu]
 */
export default function RecipeCreatePage({ user, accountMenu = [] }) {
  const toast = useToast();
  const [tab, setTab] = useState('create');
  const [recipes, setRecipes] = useState([]);
  const [sentStatus, setSentStatus] = useState('loading'); // loading | ready | error
  const [dishes, setDishes] = useState({ status: 'loading', items: [] }); // loading | ready | error
  const [ingredientNames, setIngredientNames] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [checks, setChecks] = useState({}); // nameKey → { name, known, isAnimalDerived, keyword }

  const loadDishes = async () => {
    setDishes((d) => ({ ...d, status: 'loading' }));
    try {
      const { items } = await recipeService.getActiveDishes();
      setDishes({ status: 'ready', items });
    } catch {
      setDishes({ status: 'error', items: [] });
    }
  };
  const loadSent = async () => {
    setSentStatus('loading');
    try {
      const { items } = await recipeService.getMyRecipes();
      setRecipes(items);
      setSentStatus('ready');
    } catch {
      setSentStatus('error');
    }
  };
  useEffect(() => {
    loadDishes();
    loadSent();
    recipeService.getIngredientNames().then(({ items }) => setIngredientNames(items)).catch(() => {});
  }, []);

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  // Chỉ báo lỗi khi người dùng đã rời khỏi khối đó (không đỏ ngay lúc đang gõ)
  const leave = (key) => (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
  };

  const ing = useMemo(() => validateIngredients(form.ingredients), [form.ingredients]);

  // Soi tên nguyên liệu ở server (có trong kho chưa, có nghi không chay không) — chờ ngừng gõ 500ms
  const namesToCheck = useMemo(() => {
    const seen = new Set();
    return form.ingredients.map((r) => r.name.trim()).filter((n) => n && !seen.has(nameKey(n)) && seen.add(nameKey(n)));
  }, [form.ingredients]);
  const checkKey = namesToCheck.map(nameKey).join('\n');
  useEffect(() => {
    const pending = namesToCheck.filter((n) => !checks[nameKey(n)]);
    if (pending.length === 0) return undefined;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      recipeService.checkIngredients(pending, { signal: ctrl.signal })
        .then(({ items }) => setChecks((m) => {
          const next = { ...m };
          items.forEach((c) => { next[nameKey(c.name)] = c; });
          return next;
        }))
        .catch(() => { /* lỗi mạng: bỏ qua, server vẫn soi lại khi gửi */ });
    }, 500);
    return () => { clearTimeout(timer); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy lại khi danh sách tên đổi
  }, [checkKey]);
  const rowNotes = form.ingredients.map((r) => (r.name.trim() ? ingredientNote(checks[nameKey(r.name)]) : undefined));
  const flaggedCount = rowNotes.filter((n) => n?.tone === 'bad').length;
  const unknownCount = form.ingredients.filter((r) => r.name.trim() && checks[nameKey(r.name)]?.known === false).length;
  const ingWithAmount = form.ingredients.filter((r) => r.name.trim() && r.amount > 0).length;
  const stepCount = form.steps.filter((x) => x.trim()).length;

  const missing = [
    !form.dish && 'món ăn',
    !form.title.trim() && 'tên công thức',
    ingWithAmount < 1 && 'nguyên liệu có số lượng',
    ingWithAmount >= 1 && ing.hasError && 'sửa dòng nguyên liệu bị lỗi',
    stepCount < 1 && 'cách làm',
  ].filter(Boolean);
  const ready = missing.length === 0;

  // Thanh tiến trình: 4 mục bắt buộc, bấm mục chưa xong → cuộn tới đúng khối
  const progress = [
    { key: 'dish', label: 'Chọn món ăn', done: !!form.dish, target: 'rc-dish' },
    { key: 'title', label: 'Đặt tên công thức', done: !!form.title.trim(), target: 'rc-info' },
    { key: 'ing', label: 'Ít nhất 1 nguyên liệu có số lượng', done: ingWithAmount >= 1 && !ing.hasError, target: 'rc-ing' },
    { key: 'steps', label: 'Ít nhất 1 bước nấu', done: stepCount >= 1, target: 'rc-steps' },
  ];
  const doneCount = progress.filter((p) => p.done).length;
  const goTo = (target) => {
    const el = document.getElementById(target);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.querySelector('input, textarea, button')?.focus({ preventScroll: true });
  };

  const totalTime = (toMinutes(form.prep) ?? 0) + (toMinutes(form.cook) ?? 0);
  const filledIngredients = cleanIngredients(form.ingredients).length;

  const submit = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    try {
      const { recipe: created } = await recipeService.createRecipe({
        dish: form.dish,
        title: form.title,
        thumbnailUrl: form.thumbnail || null,
        servings: form.servings,
        prepTimeMinutes: toMinutes(form.prep),
        cookTimeMinutes: toMinutes(form.cook),
        ingredients: cleanIngredients(form.ingredients),
        instructions: form.steps.filter((x) => x.trim()).join('\n'),
      });
      setRecipes((list) => [created, ...list]);
      setSentStatus('ready');
      setForm(emptyForm());
      setTouched({});
      setTab('sent');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast('Đã gửi công thức. Admin sẽ duyệt trước khi công khai.', { tone: 'success' });
    } catch (err) {
      // Lỗi → giữ nguyên nháp để người dùng sửa rồi gửi lại
      toast(err.message || 'Gửi chưa được, bạn thử lại nhé.', { tone: 'alert' });
      if (err.status === 409) loadDishes(); // món vừa bị ẩn / đã có sẵn → tải lại danh sách món
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = recipes.filter((r) => r.status === 'pending').length;

  // Thanh trên: tìm kiếm bài viết → về Bảng tin kèm từ khoá
  const topbar = ({ openMenu }) => (
    <FeedTopbar
      value={searchText}
      onChange={setSearchText}
      onSearch={(q) => { if (q) window.location.assign(`/?q=${encodeURIComponent(q)}`); }}
      onOpenMenu={openMenu}
    />
  );

  return (
    <MemberLayout
      user={user}
      accountMenu={accountMenu}
      onCreate={() => window.location.assign('/?compose=1')}
      renderTopbar={topbar}
    >
    <div className={s.page}>
      <PageHeader
        breadcrumb={[{ label: 'Tài khoản' }, { label: 'Tạo công thức' }]}
        title="Tạo công thức"
        description="Chia sẻ cách làm của bạn. Admin sẽ duyệt trước khi công khai. Mục có dấu * là bắt buộc."
      />

      <Tabs
        label="Tạo công thức"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'create', label: 'Tạo công thức', icon: 'pencil-square' },
          { key: 'sent', label: 'Công thức đã gửi', icon: 'send', count: sentStatus === 'ready' ? recipes.length : undefined },
        ]}
      />

      {tab === 'create' ? (
        <div className={s.grid} role="tabpanel" aria-label="Tạo công thức">
          <div className={s.form}>
            <Section
              id="rc-dish"
              title="Công thức này nấu món gì?"
              hint="Một món có thể có nhiều công thức. Chọn món để công thức nằm đúng chỗ."
            >
              <DishPicker value={form.dish} onChange={set('dish')} dishes={dishes.items} required />
              {dishes.status === 'loading' && <p className={s.hint} role="status">Đang tải danh sách món…</p>}
              {dishes.status === 'error' && (
                <Notice tone="alert" title="Chưa tải được danh sách món" action={{ label: 'Tải lại', onClick: loadDishes }}>
                  Bạn vẫn đề xuất tên món mới được.
                </Notice>
              )}
            </Section>

            <Section id="rc-info" title="Thông tin" hint="Tên và ảnh giúp mọi người nhận ra công thức của bạn.">
              <TextField
                label="Tên công thức"
                required
                value={form.title}
                onChange={set('title')}
                onBlur={() => setTouched((t) => ({ ...t, title: true }))}
                maxLength={255}
                placeholder="Ví dụ: Đậu hũ sốt cà chua kiểu nhà làm"
                error={touched.title && !form.title.trim() ? 'Nhập tên công thức' : undefined}
              />
              <ImageUpload label="Ảnh bìa" value={form.thumbnail} onChange={set('thumbnail')} onUpload={postService.uploadImage} ratio="16/9" />
              <div className={s.row3}>
                <NumberStepper label="Khẩu phần" value={form.servings} onChange={set('servings')} min={1} max={20} unit="người" />
                <TextField label="Chuẩn bị" type="number" inputMode="numeric" min={0} max={600} suffix="phút" value={form.prep} onChange={set('prep')} placeholder="15" />
                <TextField label="Nấu" type="number" inputMode="numeric" min={0} max={600} suffix="phút" value={form.cook} onChange={set('cook')} placeholder="20" />
              </div>
            </Section>

            <Section id="rc-ing" title="Nguyên liệu" required hint="Mỗi dòng một nguyên liệu, có số lượng." onLeave={leave('ingredients')}>
              <IngredientEditor
                label=""
                value={form.ingredients}
                onChange={set('ingredients')}
                suggestions={ingredientNames}
                hint={'Đơn vị "ít", "vừa đủ" không cần số lượng. Nhấn Enter để thêm dòng.'}
                error={touched.ingredients && ingWithAmount < 1 ? 'Cần ít nhất 1 nguyên liệu có số lượng' : undefined}
                rowErrors={touched.ingredients ? ing.rowErrors : []}
                rowNotes={rowNotes}
              />
            </Section>

            <Section id="rc-steps" title="Cách làm" required hint="Viết từng bước ngắn gọn, theo thứ tự nấu." onLeave={leave('steps')}>
              <StepEditor
                label=""
                value={form.steps}
                onChange={set('steps')}
                hint="Ghi thời gian và mức lửa nếu cần. Dùng nút ↑ ↓ để đổi thứ tự."
                error={touched.steps && stepCount < 1 ? 'Cần ít nhất 1 bước' : undefined}
              />
            </Section>
          </div>

          {/* Cột phụ cố định khi cuộn: tiến trình + Gửi ở trên (luôn thấy ngay), Xem trước ở dưới */}
          <aside className={s.aside} aria-label="Xem trước và gửi">
            <section className={`${s.card} ${s.submit}`} aria-label="Tiến trình và gửi công thức">
              <div className={s.progHead}>
                <span className={s.progTitle}>Mục bắt buộc</span>
                <span className={s.progCount}>{doneCount}/{progress.length}</span>
              </div>
              <div
                className={s.track}
                role="progressbar"
                aria-label="Tiến trình điền mục bắt buộc"
                aria-valuemin={0}
                aria-valuemax={progress.length}
                aria-valuenow={doneCount}
                aria-valuetext={`Đã xong ${doneCount} trên ${progress.length} mục`}
              >
                <span className={s.fill} style={{ width: `${(doneCount / progress.length) * 100}%` }} />
              </div>
              <ul className={s.checklist}>
                {progress.map((p) => (
                  <li key={p.key}>
                    <button
                      type="button"
                      className={`${s.checkItem} ${p.done ? s.checkDone : ''}`}
                      onClick={() => goTo(p.target)}
                      aria-label={`${p.label}: ${p.done ? 'đã xong' : 'chưa xong'}. Tới mục này`}
                    >
                      <i className={`bi bi-${p.done ? 'check-circle-fill' : 'circle'}`} aria-hidden="true" />
                      <span>{p.label}</span>
                      {!p.done && <i className={`bi bi-arrow-right-short ${s.go}`} aria-hidden="true" />}
                    </button>
                  </li>
                ))}
              </ul>
              {(unknownCount > 0 || flaggedCount > 0) && (
                <ul className={s.notes} aria-live="polite">
                  {unknownCount > 0 && (
                    <li><i className="bi bi-info-circle" aria-hidden="true" />{unknownCount} nguyên liệu chưa có trong kho, sẽ gửi Admin duyệt cùng công thức.</li>
                  )}
                  {flaggedCount > 0 && (
                    <li className={s.noteBad}><i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />{flaggedCount} nguyên liệu có thể không chay (tô đỏ). Vẫn gửi được, Admin sẽ kiểm tra lại.</li>
                  )}
                </ul>
              )}
              <Button block icon="send" loading={submitting} disabled={!ready} onClick={submit}>
                Gửi công thức
              </Button>
              <p className={ready ? s.ok : s.hint} aria-live="polite">
                {ready
                  ? 'Sẵn sàng. Sau khi gửi, công thức chờ Admin duyệt rồi mới công khai.'
                  : (ingWithAmount >= 1 && ing.hasError ? 'Có dòng nguyên liệu bị lỗi, sửa rồi gửi nhé.' : 'Bấm vào mục chưa xong để tới đúng chỗ.')}
              </p>
            </section>
            <section className={s.card} aria-labelledby="recipe-preview-title">
              <div className={s.head}>
                <h2 id="recipe-preview-title" className={s.h2}>Xem trước</h2>
                <p className={s.hint}>Thẻ công thức sẽ trông thế này sau khi được duyệt.</p>
              </div>
              <article className={s.preview}>
                <Photo src={form.thumbnail || undefined} ratio="16/9" />
                <div className={s.pBody}>
                  {form.dish?.type === 'proposed' && <HighlightChip icon="lightbulb" className={s.pChip}>Đề xuất: {form.dish.name}</HighlightChip>}
                  {form.dish?.type === 'existing' && <span className={s.pDish}><i className="bi bi-bookmark" aria-hidden="true" />{form.dish.dish.name}</span>}
                  {!form.dish && <span className={s.pEmpty}>Chưa chọn món</span>}
                  <h3 className={`${s.pTitle} ${form.title.trim() ? '' : s.pPlaceholder}`}>{form.title.trim() || 'Tên công thức'}</h3>
                  <p className={s.pMeta}>
                    {[
                      form.servings && `${form.servings} người`,
                      totalTime > 0 && `${totalTime} phút`,
                      filledIngredients > 0 && `${filledIngredients} nguyên liệu`,
                    ].filter(Boolean).join(' · ') || 'Khẩu phần, thời gian sẽ hiện ở đây'}
                  </p>
                  <div className={s.pBy}><Avatar name={user?.fullName ?? 'Bạn'} src={user?.avatarUrl ?? undefined} size={24} /><span>Bạn</span></div>
                </div>
              </article>
            </section>

          </aside>
        </div>
      ) : (
        <div role="tabpanel" aria-label="Công thức đã gửi" className={s.sentWrap}>
          {pendingCount > 0 && (
            <p className={s.hint}>{pendingCount} công thức đang chờ Admin duyệt. Công thức chỉ hiện với mọi người sau khi được duyệt.</p>
          )}
          {sentStatus === 'loading' && <p className={s.hint} role="status">Đang tải công thức đã gửi…</p>}
          {sentStatus === 'error' && (
            <Notice tone="alert" title="Chưa tải được công thức đã gửi" action={{ label: 'Tải lại', onClick: loadSent }} />
          )}
          {sentStatus === 'ready' && (recipes.length === 0 ? (
            <EmptyState
              icon="journal-plus"
              title="Bạn chưa gửi công thức nào"
              action={<Button icon="pencil-square" onClick={() => setTab('create')}>Tạo công thức</Button>}
            >
              Công thức bạn gửi sẽ nằm ở đây cùng trạng thái duyệt.
            </EmptyState>
          ) : (
            <ul className={s.sent}>
              {recipes.map((r) => (
                <li key={r.id} className={s.sentItem}>
                  <Photo src={r.thumbnailUrl || undefined} ratio="4/3" shape="rounded" className={s.sentImg} />
                  <div className={s.sentBody}>
                    <div className={s.sentTop}>
                      <h3 className={s.sentTitle}>{r.title}</h3>
                      <StatusBadge entity="recipe" status={r.status} size="sm" />
                    </div>
                    <p className={s.sentDish}>
                      {r.proposedDishName ? (
                        <><i className="bi bi-lightbulb" aria-hidden="true" />Món đề xuất: <b>{r.proposedDishName}</b></>
                      ) : (
                        <><i className="bi bi-bookmark" aria-hidden="true" />Món: <b>{r.dishName}</b></>
                      )}
                    </p>
                    <p className={s.sentMeta}>
                      <i className="bi bi-clock" aria-hidden="true" />
                      <span>
                        Đã gửi: {timeAgo(r.createdAt)}
                        {r.ingredientCount ? ` · ${r.ingredientCount} nguyên liệu` : ''}
                        {r.status === 'pending' && r.proposedIngredientCount ? ` (${r.proposedIngredientCount} chờ duyệt)` : ''}
                      </span>
                    </p>
                    {r.status === 'rejected' && r.moderationNote && (
                      <Notice tone="alert" title="Lý do từ chối" className={s.reason}>{r.moderationNote}</Notice>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}
    </div>
    </MemberLayout>
  );
}
