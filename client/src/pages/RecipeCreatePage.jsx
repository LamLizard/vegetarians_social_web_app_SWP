import { useEffect, useMemo, useState } from 'react';
import Avatar from '../components/Avatar/Avatar';
import Button from '../components/Button/Button';
import ConfirmDialog from '../components/ConfirmDialog/ConfirmDialog';
import EmptyState from '../components/EmptyState/EmptyState';
import HighlightChip from '../components/HighlightChip/HighlightChip';
import ImageUpload from '../components/ImageUpload/ImageUpload';
import IngredientEditor from '../components/IngredientEditor/IngredientEditor';
import Notice from '../components/Notice/Notice';
import NumberStepper from '../components/NumberStepper/NumberStepper';
import PageHeader from '../components/PageHeader/PageHeader';
import Pagination from '../components/Pagination/Pagination';
import Photo from '../components/Photo/Photo';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import StepEditor from '../components/StepEditor/StepEditor';
import TextArea from '../components/TextArea/TextArea';
import Tabs from '../components/Tabs/Tabs';
import TextField from '../components/TextField/TextField';
import { useToast } from '../components/Toast/Toast';
import { cleanIngredients, newIngredientRow, validateIngredients } from '../utils/ingredient';
import { timeAgo } from '../utils/format';
import { getYouTubeId } from '../utils/validate';
import useYouTubeCheck, { youTubeCheckText } from '../hooks/useYouTubeCheck';
import { findAnimalWord } from '../utils/animalWords';
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
 *  Khoi's code (15/10/2026, chép từ prototype): công thức bị từ chối có nút "Sửa và gửi lại" → mở lại form
 *  điền sẵn nội dung đã gửi, gửi lại = cập nhật CÙNG công thức, quay về Chờ duyệt (PUT /api/recipes/:id).
 *  Khoi's code (15/10/2026): thêm 3 trường tuỳ chọn (mô tả, link YouTube, calo); công thức Đã duyệt bấm được
 *  sang trang xem /recipes/:id; mở trang bằng ?tab=sent (link trong thông báo) thì vào thẳng tab Công thức đã gửi.
 *  Khoi's code (15/10/2026, sửa lỗi): khẩu phần + thời gian chuẩn bị + thời gian nấu BẮT BUỘC (cho phép 0 phút),
 *  số âm báo lỗi (trước đây tự về 0). Khối "Dinh dưỡng (không bắt buộc)" gập/mở: calo, đạm, tinh bột, béo, xơ, đường, natri.
 *  Bước nấu có xuống dòng bên trong được gộp thành 1 dòng khi gửi (trước đây bị tách thành nhiều bước).
 * Gửi xong: recipe.status = 'pending', KHÔNG tạo Dish (món đề xuất chỉ là chữ gửi kèm).
 */

/** Khoi's code: ô số nguyên trong khoảng [min, max] → số · bỏ trống → null · sai (âm, lẻ, quá lớn) → NaN */
const toInt = (v, min, max) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : NaN;
};
const toMinutes = (v) => toInt(v, 0, 600);
const toCalories = (v) => toInt(v, 1, 5000);
/** Khoi's code: ô dinh dưỡng → số không âm (nhận "12,5"), làm tròn `digits` số lẻ · bỏ trống → null · sai → NaN */
const toNutrient = (v, max, digits) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > max) return NaN;
  return Math.round(n * 10 ** digits) / 10 ** digits;
};
/** Khoi's code: 6 chỉ số dinh dưỡng tuỳ chọn (1 người) — cùng giới hạn với server/src/utils/recipeInput.js */
const NUTRIENTS = [
  { key: 'protein', api: 'proteinG', label: 'Đạm', unit: 'g', max: 1000, digits: 1, placeholder: '12' },
  { key: 'carb', api: 'carbG', label: 'Tinh bột', unit: 'g', max: 1000, digits: 1, placeholder: '45' },
  { key: 'fat', api: 'fatG', label: 'Chất béo', unit: 'g', max: 1000, digits: 1, placeholder: '10' },
  { key: 'fiber', api: 'fiberG', label: 'Chất xơ', unit: 'g', max: 1000, digits: 1, placeholder: '6' },
  { key: 'sugar', api: 'sugarG', label: 'Đường', unit: 'g', max: 1000, digits: 1, placeholder: '5' },
  { key: 'sodium', api: 'sodiumMg', label: 'Natri', unit: 'mg', max: 20000, digits: 0, placeholder: '400' },
];
/** Khoi's code: 1 bước nấu = 1 dòng (instructions lưu mỗi bước 1 dòng) → gộp xuống dòng bên trong bước thành dấu cách */
const oneLine = (step) => step.replace(/\s*\n+\s*/g, ' ').trim();
/** Khoá so tên nguyên liệu giống server (gộp khoảng trắng, không phân biệt hoa/thường) */
const nameKey = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** Kết quả soi 1 nguyên liệu → lưu ý dưới dòng đó (IngredientEditor rowNotes) */
function ingredientNote(c) {
  if (!c) return undefined;
  const missing = c.known ? '' : ' Nguyên liệu đề xuất mới, Admin sẽ duyệt cùng công thức.';
  if (c.isAnimalDerived) return { tone: 'bad', text: `Kho ghi đây là nguyên liệu có nguồn gốc động vật. Admin sẽ kiểm tra lại.${missing}` };
  if (c.keyword) return { tone: 'bad', text: `Tên có từ “${c.keyword}”, có thể không phải đồ chay. Admin sẽ kiểm tra lại.${missing}` };
  if (!c.known) return { tone: 'warn', text: missing.trim() };
  return undefined;
}

const emptyForm = () => ({
  dish: null,
  title: '',
  description: '',
  thumbnail: '',
  youtube: '',
  servings: null,
  prep: '',
  cook: '',
  calories: '',
  ...Object.fromEntries(NUTRIENTS.map((n) => [n.key, ''])),
  ingredients: [newIngredientRow()],
  steps: [''],
});

/**
 * Khoi's code: công thức đã gửi (GET /recipes/mine/:id) → nội dung form để "Sửa và gửi lại".
 * Món cũ không còn trong danh sách món đang hoạt động → để trống, người dùng chọn lại.
 * @returns {{ form: object, dishLost: boolean }}
 */
function formFromRecipe(r, dishes) {
  const dish = r.dishId ? dishes.find((d) => String(d.dish_id) === String(r.dishId)) : null;
  const steps = String(r.instructions ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
  return {
    dishLost: !!r.dishId && !dish,
    form: {
      dish: dish ? { type: 'existing', dish } : (r.proposedDishName ? { type: 'proposed', name: r.proposedDishName } : null),
      title: r.title ?? '',
      description: r.description ?? '',
      thumbnail: r.thumbnailUrl ?? '',
      youtube: r.youtubeUrl ?? '',
      servings: r.servings ?? null,
      prep: r.prepTimeMinutes ?? '',
      cook: r.cookTimeMinutes ?? '',
      calories: r.caloriesKcal ?? '',
      ...Object.fromEntries(NUTRIENTS.map((n) => [n.key, r[n.api] ?? ''])),
      ingredients: r.ingredients?.length
        ? r.ingredients.map((i) => newIngredientRow({
          name: i.name, amount: i.amount ?? null, unit: i.unit ?? '', ...(i.proposed ? { proposed: true } : {}),
        }))
        : [newIngredientRow()],
      steps: steps.length ? steps : [''],
    },
  };
}

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

// Khoi's code: số công thức mỗi trang ở tab "Công thức đã gửi"
const SENT_PAGE_SIZE = 5;

/**
 * @param {{id, fullName, role, avatarUrl?}} user   thành viên đang đăng nhập (useAuth ở App)
 * @param {{icon?, label, onClick, tone?}[]} [accountMenu]
 */
export default function RecipeCreatePage({ user, accountMenu = [] }) {
  const toast = useToast();
  // Khoi's code: link trong thông báo "bị từ chối" là /recipes/new?tab=sent → mở thẳng tab Công thức đã gửi
  const [tab, setTab] = useState(() => (new URLSearchParams(window.location.search).get('tab') === 'sent' ? 'sent' : 'create'));
  const [recipes, setRecipes] = useState([]);
  const [sentStatus, setSentStatus] = useState('loading'); // loading | ready | error
  const [dishes, setDishes] = useState({ status: 'loading', items: [] }); // loading | ready | error
  const [ingredientNames, setIngredientNames] = useState([]);
  const [animalWords, setAnimalWords] = useState([]); // banned_keyword category 'animal'
  const [sentPage, setSentPage] = useState(1); // Khoi's code: tab Công thức đã gửi, mỗi trang SENT_PAGE_SIZE công thức
  const [form, setForm] = useState(emptyForm);
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [checks, setChecks] = useState({}); // nameKey → { name, known, isAnimalDerived, keyword }
  // Khoi's code: chế độ "Sửa và gửi lại" — công thức đang sửa + bản gốc (biết đã đổi gì chưa)
  const [editing, setEditing] = useState(null);
  const [snapshot, setSnapshot] = useState('');
  const [draft, setDraft] = useState(null); // form Tạo công thức đang gõ dở, trả lại khi thoát chế độ sửa
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [opening, setOpening] = useState(null); // id công thức đang tải để mở form sửa
  const [nutritionOpen, setNutritionOpen] = useState(false); // khối Dinh dưỡng gập/mở
  const dirty = !!editing && JSON.stringify(form) !== snapshot;

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
    recipeService.getAnimalWords().then(({ items }) => setAnimalWords(items)).catch(() => { /* không tải được: chỉ mất phần tô đỏ */ });
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
  // Khoi's code: chữ người dùng tự gõ (tên món đề xuất, tên công thức) cũng soi từ động vật — chỉ cảnh báo
  const dishWord = form.dish?.type === 'proposed' ? findAnimalWord(form.dish.name, animalWords) : null;
  const titleWord = findAnimalWord(form.title, animalWords);
  const flaggedCount = rowNotes.filter((n) => n?.tone === 'bad').length;
  const flaggedText = [dishWord && 'tên món', titleWord && 'tên công thức'].filter(Boolean);
  const unknownCount = form.ingredients.filter((r) => r.name.trim() && checks[nameKey(r.name)]?.known === false).length;
  const ingWithAmount = form.ingredients.filter((r) => r.name.trim() && r.amount > 0).length;
  const stepCount = form.steps.filter((x) => x.trim()).length;
  // Khoi's code: 2 trường tuỳ chọn có kiểm tra — bỏ trống thì không sao, gõ sai thì chặn gửi
  const youtubeFormatBad = !!form.youtube.trim() && !getYouTubeId(form.youtube);
  // Khoi's code: hỏi YouTube video có cho phát trên trang khác không (chủ kênh tắt nhúng / đã xoá → chặn gửi)
  const ytCheck = useYouTubeCheck(form.youtube);
  const ytText = youTubeCheckText(ytCheck);
  const youtubeBad = youtubeFormatBad || ytCheck.rejected;
  const calories = toCalories(form.calories);
  const caloriesBad = Number.isNaN(calories);
  // Khoi's code: dinh dưỡng tuỳ chọn — bỏ trống được, gõ sai (âm, chữ, quá lớn) thì chặn gửi
  const nutrients = Object.fromEntries(NUTRIENTS.map((n) => [n.key, toNutrient(form[n.key], n.max, n.digits)]));
  const badNutrients = NUTRIENTS.filter((n) => Number.isNaN(nutrients[n.key]));
  const nutritionBad = caloriesBad || badNutrients.length > 0;
  const nutritionCount = [form.calories, ...NUTRIENTS.map((n) => form[n.key])].filter((v) => String(v).trim() !== '').length;
  // Khoi's code: khẩu phần + 2 ô thời gian BẮT BUỘC (cho phép 0 phút), số âm / số lẻ → lỗi
  const prep = toMinutes(form.prep);
  const cook = toMinutes(form.cook);
  const metaError = {
    servings: form.servings == null ? 'Chọn khẩu phần' : undefined,
    prep: prep === null ? 'Nhập thời gian (không cần thì ghi 0)' : Number.isNaN(prep) ? 'Nhập số phút từ 0 đến 600' : undefined,
    cook: cook === null ? 'Nhập thời gian (không cần thì ghi 0)' : Number.isNaN(cook) ? 'Nhập số phút từ 0 đến 600' : undefined,
  };
  const metaOk = !metaError.servings && !metaError.prep && !metaError.cook;
  // Lỗi "chưa nhập" chỉ hiện khi đã rời ô; lỗi "nhập sai" (vd số âm) hiện ngay
  const showMeta = (key, value) => (touched[key] || (value !== null && Number.isNaN(value)) ? metaError[key] : undefined);

  const missing = [
    !form.dish && 'món ăn',
    !form.title.trim() && 'tên công thức',
    ingWithAmount < 1 && 'nguyên liệu có số lượng',
    ingWithAmount >= 1 && ing.hasError && 'sửa dòng nguyên liệu bị lỗi',
    stepCount < 1 && 'cách làm',
    !metaOk && 'khẩu phần và thời gian',
    youtubeBad && 'sửa link YouTube',
    nutritionBad && 'sửa chỉ số dinh dưỡng',
  ].filter(Boolean);
  const ready = missing.length === 0;
  const canSend = ready && (!editing || dirty);

  // Thanh tiến trình: 4 mục bắt buộc, bấm mục chưa xong → cuộn tới đúng khối
  const progress = [
    { key: 'dish', label: 'Chọn món ăn', done: !!form.dish, target: 'rc-dish' },
    { key: 'title', label: 'Đặt tên công thức', done: !!form.title.trim(), target: 'rc-info' },
    { key: 'meta', label: 'Khẩu phần, thời gian chuẩn bị và nấu', done: metaOk, target: 'rc-meta' },
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

  const totalTime = (prep > 0 ? prep : 0) + (cook > 0 ? cook : 0);
  const filledIngredients = cleanIngredients(form.ingredients).length;

  // Khoi's code: mở form sửa — tải đủ nội dung (nguyên liệu, cách làm) của công thức bị từ chối
  const startEdit = async (r) => {
    if (opening) return;
    setOpening(r.id);
    try {
      const detail = await recipeService.getMyRecipe(r.id);
      const { form: f, dishLost } = formFromRecipe(detail, dishes.items);
      if (!editing) setDraft(form);
      setForm(f);
      setSnapshot(JSON.stringify(f));
      setEditing(detail);
      setTouched({});
      setNutritionOpen([detail.caloriesKcal, ...NUTRIENTS.map((n) => detail[n.api])].some((v) => v != null));
      window.scrollTo({ top: 0 });
      if (dishLost) toast(`Món “${detail.dishName ?? ''}” không còn hoạt động, bạn chọn lại món nhé.`, { tone: 'alert' });
    } catch (err) {
      toast(err.message || 'Chưa mở được công thức, bạn thử lại nhé.', { tone: 'alert' });
    } finally {
      setOpening(null);
    }
  };

  const exitEdit = () => {
    setEditing(null);
    setForm(draft ?? emptyForm());
    setDraft(null);
    setTouched({});
    setConfirmLeave(false);
    setTab('sent');
    window.scrollTo({ top: 0 });
  };
  // Đã sửa mà bấm Hủy → hỏi trước, tránh mất công sửa
  const cancelEdit = () => (dirty ? setConfirmLeave(true) : exitEdit());

  const submit = async () => {
    if (!canSend || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        dish: form.dish,
        title: form.title,
        description: form.description.trim() || null,
        thumbnailUrl: form.thumbnail || null,
        youtubeUrl: form.youtube.trim() || null,
        caloriesKcal: calories,
        servings: form.servings,
        prepTimeMinutes: prep,
        cookTimeMinutes: cook,
        ...Object.fromEntries(NUTRIENTS.map((n) => [n.api, nutrients[n.key]])),
        ingredients: cleanIngredients(form.ingredients),
        instructions: form.steps.map(oneLine).filter(Boolean).join('\n'),
      };
      if (editing) {
        // Gửi lại = cập nhật CÙNG công thức, quay về Chờ duyệt, xoá lý do cũ
        const { recipe: updated } = await recipeService.resubmitRecipe(editing.id, payload);
        setRecipes((list) => list.map((r) => (r.id === updated.id ? updated : r)));
        setEditing(null);
        setForm(draft ?? emptyForm());
        setDraft(null);
      } else {
        const { recipe: created } = await recipeService.createRecipe(payload);
        setRecipes((list) => [created, ...list]);
        setSentStatus('ready');
        setForm(emptyForm());
      }
      setTouched({});
      setTab('sent');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast(editing ? 'Đã gửi lại. Công thức đang chờ duyệt.' : 'Đã gửi công thức. Admin sẽ duyệt trước khi công khai.', { tone: 'success' });
    } catch (err) {
      // Lỗi → giữ nguyên nháp để người dùng sửa rồi gửi lại
      toast(err.message || 'Gửi chưa được, bạn thử lại nhé.', { tone: 'alert' });
      if (err.status === 409) {
        loadDishes(); // món vừa bị ẩn / đã có sẵn → tải lại danh sách món
        if (editing) loadSent(); // công thức không còn ở trạng thái Bị từ chối → cập nhật danh sách
      }
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = recipes.filter((r) => r.status === 'pending').length;

  // Khoi's code: trang này không cần ô tìm kiếm → ẩn (điện thoại vẫn giữ nút ☰ mở menu)
  const topbar = ({ openMenu }) => (
    <FeedTopbar hideSearch value="" onChange={() => {}} onSearch={() => {}} onOpenMenu={openMenu} />
  );

  const sentTotalPages = Math.max(1, Math.ceil(recipes.length / SENT_PAGE_SIZE));
  const sentCurrent = Math.min(sentPage, sentTotalPages);
  const sentShown = recipes.slice((sentCurrent - 1) * SENT_PAGE_SIZE, sentCurrent * SENT_PAGE_SIZE);

  return (
    <MemberLayout
      user={user}
      accountMenu={accountMenu}
      onCreate={() => window.location.assign('/?compose=1')}
      renderTopbar={topbar}
    >
    <div className={s.page}>
      {editing ? (
        <PageHeader
          breadcrumb={[{ label: 'Tài khoản' }, { label: 'Công thức đã gửi' }, { label: 'Sửa' }]}
          title="Sửa công thức"
          description={editing.status === 'approved'
            ? 'Bản sửa thay cho bản cũ và phải chờ Admin duyệt lại. Trong lúc chờ, công thức tạm ẩn với mọi người.'
            : 'Sửa theo góp ý rồi gửi lại. Bản gửi lại thay cho bản cũ và quay về trạng thái Chờ duyệt.'}
        />
      ) : (
        <>
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
        </>
      )}

      {editing || tab === 'create' ? (
        <div className={s.grid} role={editing ? undefined : 'tabpanel'} aria-label={editing ? 'Sửa công thức' : 'Tạo công thức'}>
          <div className={s.form}>
            {editing?.moderationNote && (
              <Notice tone="alert" title="Admin từ chối lần trước vì">{editing.moderationNote}</Notice>
            )}
            <Section
              id="rc-dish"
              title="Công thức này nấu món gì?"
              hint="Một món có thể có nhiều công thức. Chọn món để công thức nằm đúng chỗ."
            >
              <DishPicker value={form.dish} onChange={set('dish')} dishes={dishes.items} required />
              {dishWord && (
                <p className={s.flag} role="status">
                  <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
                  Tên món đề xuất có từ “{dishWord}”, có thể không phải đồ chay. Vẫn gửi được, Admin sẽ kiểm tra lại.
                </p>
              )}
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
              {titleWord && (
                <p className={s.flag} role="status">
                  <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
                  Tên công thức có từ “{titleWord}”, có thể không phải đồ chay. Vẫn gửi được, Admin sẽ kiểm tra lại.
                </p>
              )}
              <TextArea
                label="Mô tả ngắn"
                value={form.description}
                onChange={set('description')}
                rows={2}
                maxRows={6}
                maxLength={1000}
                placeholder="Vài câu giới thiệu: món này hợp bữa nào, vị ra sao…"
              />
              <ImageUpload label="Ảnh bìa" value={form.thumbnail} onChange={set('thumbnail')} onUpload={postService.uploadImage} ratio="16/9" />
              <TextField
                label="Video hướng dẫn trên YouTube"
                type="url"
                icon="youtube"
                value={form.youtube}
                onChange={set('youtube')}
                onBlur={() => setTouched((t) => ({ ...t, youtube: true }))}
                maxLength={500}
                placeholder="https://youtu.be/…"
                hint={ytText.hint || 'Không bắt buộc. Dán link video YouTube nếu bạn có quay lại cách nấu.'}
                error={(touched.youtube || form.youtube.length > 20) && youtubeFormatBad
                  ? 'Link YouTube không hợp lệ. Dán link dạng youtube.com/watch?v=… hoặc youtu.be/…'
                  : ytText.error}
              />
              <div id="rc-meta" className={`${s.row3} ${s.anchor}`}>
                <NumberStepper
                  label="Khẩu phần" required value={form.servings} onChange={(v) => { set('servings')(v); setTouched((t) => ({ ...t, servings: true })); }}
                  min={1} max={20} unit="người" error={touched.servings ? metaError.servings : undefined}
                />
                <TextField
                  label="Chuẩn bị" required type="number" inputMode="numeric" min={0} max={600} suffix="phút"
                  value={form.prep} onChange={set('prep')} placeholder="15"
                  onBlur={() => setTouched((t) => ({ ...t, prep: true }))} error={showMeta('prep', prep)}
                />
                <TextField
                  label="Nấu" required type="number" inputMode="numeric" min={0} max={600} suffix="phút"
                  value={form.cook} onChange={set('cook')} placeholder="20"
                  onBlur={() => setTouched((t) => ({ ...t, cook: true }))} error={showMeta('cook', cook)}
                />
              </div>

              {/* Khoi's code: Dinh dưỡng tuỳ chọn — bấm để mở/gập theo chiều dọc */}
              <div className={`${s.nutri} ${nutritionOpen ? s.nutriOpen : ''}`}>
                <button
                  type="button"
                  className={s.nutriToggle}
                  aria-expanded={nutritionOpen}
                  aria-controls="rc-nutrition"
                  onClick={() => setNutritionOpen((o) => !o)}
                >
                  <i className="bi bi-heart-pulse" aria-hidden="true" />
                  <span className={s.nutriTitle}>Dinh dưỡng <span className={s.nutriOptional}>(không bắt buộc)</span></span>
                  {nutritionBad
                    ? <span className={s.nutriBad}>Có ô nhập sai</span>
                    : nutritionCount > 0 && <span className={s.nutriCount}>Đã nhập {nutritionCount}</span>}
                  <i className={`bi bi-chevron-down ${s.nutriChevron}`} aria-hidden="true" />
                </button>
                <div id="rc-nutrition" className={s.nutriPanel} inert={!nutritionOpen}>
                  <div className={s.nutriInner}>
                    <p className={s.hint}>Ước tính cho 1 người. Không chắc thì để trống, có thể tra trên bao bì hoặc ứng dụng tính calo.</p>
                    <div className={s.nutriGrid}>
                      <TextField
                        label="Calo" type="number" inputMode="numeric" min={1} max={5000} suffix="kcal"
                        value={form.calories} onChange={set('calories')} placeholder="350"
                        error={caloriesBad ? 'Số nguyên từ 1 đến 5000' : undefined}
                      />
                      {NUTRIENTS.map((n) => (
                        <TextField
                          key={n.key} label={n.label} inputMode="decimal" suffix={n.unit}
                          value={form[n.key]} onChange={set(n.key)} placeholder={n.placeholder}
                          error={Number.isNaN(nutrients[n.key]) ? `Số từ 0 đến ${n.max.toLocaleString('vi-VN')}` : undefined}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            <Section id="rc-ing" title="Nguyên liệu" required hint="Mỗi dòng một nguyên liệu, có số lượng." onLeave={leave('ingredients')}>
              <IngredientEditor
                label=""
                value={form.ingredients}
                onChange={set('ingredients')}
                catalog={ingredientNames}
                hint={<>Gõ để tìm trong kho nguyên liệu. Không thấy thì chọn “+ Đề xuất nguyên liệu mới” ở cuối danh sách.<br />Đơn vị “ít”, “vừa đủ” không cần số lượng.</>}
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
              {(unknownCount > 0 || flaggedCount > 0 || flaggedText.length > 0) && (
                <ul className={s.notes} aria-live="polite">
                  {unknownCount > 0 && (
                    <li><i className="bi bi-info-circle" aria-hidden="true" />{unknownCount} nguyên liệu chưa có trong kho, sẽ gửi Admin duyệt cùng công thức.</li>
                  )}
                  {flaggedCount > 0 && (
                    <li className={s.noteBad}><i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />{flaggedCount} nguyên liệu có thể không phải đồ chay. Vẫn gửi được, Admin sẽ kiểm tra lại.</li>
                  )}
                  {flaggedText.length > 0 && (
                    <li className={s.noteBad}><i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />{flaggedText.join(' và ').replace(/^./, (c) => c.toUpperCase())} có từ chỉ động vật. Admin sẽ kiểm tra lại.</li>
                  )}
                </ul>
              )}
              <Button block icon="send" loading={submitting} disabled={!canSend} onClick={submit}>
                {editing ? 'Gửi lại công thức' : 'Gửi công thức'}
              </Button>
              {editing && (
                <Button block variant="subtle" disabled={submitting} onClick={cancelEdit}>Hủy, quay lại danh sách</Button>
              )}
              <p className={canSend ? s.ok : s.hint} aria-live="polite">
                {!ready
                  ? (youtubeBad || nutritionBad
                    ? `Cần ${[youtubeBad && 'sửa link YouTube', nutritionBad && 'sửa chỉ số dinh dưỡng'].filter(Boolean).join(' và ')} ở khối Thông tin.`
                    : ingWithAmount >= 1 && ing.hasError ? 'Có dòng nguyên liệu bị lỗi, sửa rồi gửi nhé.' : 'Bấm vào mục chưa xong để tới đúng chỗ.')
                  : editing && !dirty
                    ? (editing.status === 'approved' ? 'Bạn chưa thay đổi gì.' : 'Bạn chưa thay đổi gì. Sửa theo lý do từ chối rồi gửi lại.')
                    : 'Sẵn sàng. Sau khi gửi, công thức chờ Admin duyệt rồi mới công khai.'}
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
                      calories > 0 && `${calories} kcal`,
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
        <div role="tabpanel" aria-label="Công thức đã gửi" className={`${s.sentWrap} ${s.anchor}`}>
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
              {sentShown.map((r) => (
                <li key={r.id} className={s.sentItem}>
                  <Photo src={r.thumbnailUrl || undefined} ratio="4/3" shape="rounded" className={s.sentImg} />
                  <div className={s.sentBody}>
                    <div className={s.sentTop}>
                      <h3 className={s.sentTitle}>
                        {/* Khoi's code: tạm ẩn link sang /recipes/:id — hiện lại khi làm xong trang công thức */}
                        {r.title}
                      </h3>
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
                    {/* Khoi's code: tạm ẩn "Xem công thức" — hiện lại khi làm xong trang công thức.
                        Công thức đã duyệt sửa được, gửi lại thì quay về Chờ duyệt. */}
                    {r.status === 'approved' && (
                      <div className={s.sentActs}>
                        <Button variant="outline" icon="pencil" loading={opening === r.id} disabled={!!opening} onClick={() => startEdit(r)}>Sửa công thức</Button>
                      </div>
                    )}
                    {r.status === 'rejected' && (
                      <>
                        {r.moderationNote && <Notice tone="alert" title="Lý do từ chối" className={s.reason}>{r.moderationNote}</Notice>}
                        <div className={s.sentActs}>
                          <Button icon="pencil" loading={opening === r.id} disabled={!!opening} onClick={() => startEdit(r)}>Sửa và gửi lại</Button>
                        </div>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ))}
          {sentStatus === 'ready' && (
            <Pagination
              page={sentCurrent}
              totalPages={sentTotalPages}
              onChange={(p) => { setSentPage(p); document.querySelector(`.${s.sentWrap}`)?.scrollIntoView({ block: 'start' }); }}
              totalItems={recipes.length}
              pageSize={SENT_PAGE_SIZE}
              itemLabel="công thức"
            />
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmLeave}
        title="Bỏ các thay đổi?"
        message="Những gì bạn vừa sửa sẽ mất. Công thức vẫn giữ nguyên như trước."
        confirmLabel="Bỏ thay đổi"
        cancelLabel="Sửa tiếp"
        onConfirm={exitEdit}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
    </MemberLayout>
  );
}
