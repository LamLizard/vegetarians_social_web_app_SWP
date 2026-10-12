import { useEffect, useMemo, useState } from 'react';
import { AdminLayout, Button, CategoryPicker, Field, ImageUpload, IngredientEditor, Notice, NumberStepper, PageHeader, Photo, StepEditor, TextArea, TextField } from '../components';
import Avatar from '../components/Avatar/Avatar';
import useAuth from '../hooks/useAuth';
import { createAdminDish, createAdminDishWithRecipe, getDishCategories, searchAdminDishes } from '../services/dish.service';
import recipeService from '../services/recipe.service';
import postService from '../services/post.service';
import styles from './RecipeCreatePage.module.css';
import pageStyles from './AdminDishCreatePage.module.css';
import pickerStyles from '../components/DishPicker/DishPicker.module.css';
import { matchScore, plain } from '../utils/dishMatch';
import { cleanIngredients, newIngredientRow, validateIngredients } from '../utils/ingredient';

const EMPTY_FORM = { name: '', description: '', thumbnailUrl: '', categoryIds: [] };
const createEmptyRecipe = () => ({ title: '', servings: null, prep: '', cook: '', ingredients: [newIngredientRow()], steps: [''] });
const toMinutes = (value) => (value === '' || value == null ? null : Math.max(0, Math.min(600, Number(value))));
const nameKey = (value) => value.trim().replace(/\s+/g, ' ').toLowerCase();

function ingredientNote(check) {
  if (!check) return undefined;
  const missing = check.known ? '' : ' Chưa có trong kho nguyên liệu đã duyệt.';
  if (check.isAnimalDerived) return { tone: 'bad', text: `Kho ghi đây là nguyên liệu có nguồn gốc động vật.${missing}` };
  if (check.keyword) return { tone: 'bad', text: `Tên có từ “${check.keyword}”, cần kiểm tra nguồn gốc.${missing}` };
  if (!check.known) return { tone: 'warn', text: missing.trim() };
  return undefined;
}

export default function AdminDishCreatePage() {
  const { user, logout } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const returnRecipeId = params.get('returnRecipeId');
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, name: params.get('suggestedName') || '' }));
  const [recipeForm, setRecipeForm] = useState(createEmptyRecipe);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
  const [recipeContext, setRecipeContext] = useState(null);
  const [loadingRecipe, setLoadingRecipe] = useState(!!returnRecipeId);
  const [recipeError, setRecipeError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [dishMatches, setDishMatches] = useState([]);
  const [searchingDishes, setSearchingDishes] = useState(false);
  const [dishSearchError, setDishSearchError] = useState('');
  const [dishNameFocused, setDishNameFocused] = useState(false);
  const [checkedDishName, setCheckedDishName] = useState('');
  const [ingredientNames, setIngredientNames] = useState([]);
  const [ingredientChecks, setIngredientChecks] = useState({});

  useEffect(() => {
    const query = form.name.trim();
    if (!query) {
      setDishMatches([]);
      setDishSearchError('');
      setSearchingDishes(false);
      setCheckedDishName('');
      return undefined;
    }
    let active = true;
    setSearchingDishes(true);
    setCheckedDishName('');
    const timer = window.setTimeout(() => {
      searchAdminDishes(query)
        .then((items) => { if (active) { setDishMatches(items); setDishSearchError(''); setCheckedDishName(query); } })
        .catch((e) => { if (active) setDishSearchError(e.message); })
        .finally(() => { if (active) setSearchingDishes(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [form.name]);

  const rankedDishMatches = useMemo(() => dishMatches
    .map((dish) => ({ dish, score: matchScore(form.name, dish.name) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.dish.name.localeCompare(b.dish.name, 'vi'))
    .slice(0, 8), [dishMatches, form.name]);
  const exactDishMatch = rankedDishMatches.find(({ dish }) => plain(dish.name) === plain(form.name))?.dish;
  const ingredientValidation = useMemo(() => validateIngredients(recipeForm.ingredients), [recipeForm.ingredients]);
  const namesToCheck = useMemo(() => {
    const seen = new Set();
    return recipeForm.ingredients.map((row) => row.name.trim()).filter((name) => name && !seen.has(nameKey(name)) && seen.add(nameKey(name)));
  }, [recipeForm.ingredients]);
  const ingredientCheckKey = namesToCheck.map(nameKey).join('\n');
  const rowNotes = recipeForm.ingredients.map((row) => (row.name.trim() ? ingredientNote(ingredientChecks[nameKey(row.name)]) : undefined));
  const unknownIngredientCount = recipeForm.ingredients.filter((row) => row.name.trim() && ingredientChecks[nameKey(row.name)]?.known === false).length;
  const flaggedIngredientCount = rowNotes.filter((note) => note?.tone === 'bad').length;
  const ingredientCount = recipeForm.ingredients.filter((row) => row.name.trim() && row.amount > 0).length;
  const stepCount = recipeForm.steps.filter((step) => step.trim()).length;

  useEffect(() => {
    let active = true;
    recipeService.getIngredientNames().then(({ items }) => { if (active) setIngredientNames(items); }).catch(() => {});
    getDishCategories()
      .then((items) => { if (active) setCategories(items.map((item) => ({ value: item.id, label: item.name }))); })
      .catch((e) => { if (active) setCategoriesError(e.message); })
      .finally(() => { if (active) setLoadingCategories(false); });
    if (returnRecipeId) {
      recipeService.getPendingAdminRecipes()
        .then((items) => {
          if (!active) return;
          const found = items.find((item) => String(item.id) === String(returnRecipeId));
          if (!found || !found.proposedDishName) {
            setRecipeError('Không tìm thấy yêu cầu Recipe đang đề xuất Dish. Hãy quay lại hàng chờ và mở đúng yêu cầu.');
            return;
          }
          setRecipeContext(found);
          setForm((current) => ({ ...current, name: found.proposedDishName }));
        })
        .catch((e) => { if (active) setRecipeError(e.message); })
        .finally(() => { if (active) setLoadingRecipe(false); });
    }
    return () => { active = false; };
  }, [returnRecipeId]);

  useEffect(() => {
    const pending = namesToCheck.filter((name) => !ingredientChecks[nameKey(name)]);
    if (!pending.length) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      recipeService.checkIngredients(pending, { signal: controller.signal }).then(({ items }) => {
        setIngredientChecks((current) => {
          const next = { ...current };
          items.forEach((item) => { next[nameKey(item.name)] = item; });
          return next;
        });
      }).catch(() => {});
    }, 500);
    return () => { window.clearTimeout(timer); controller.abort(); };
    // Run only when ingredient names change; checks are cached by normalized name.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredientCheckKey]);

  const retryCategories = async () => {
    setLoadingCategories(true); setCategoriesError('');
    try {
      const items = await getDishCategories();
      setCategories(items.map((item) => ({ value: item.id, label: item.name })));
    } catch (e) { setCategoriesError(e.message); }
    finally { setLoadingCategories(false); }
  };

  const updateField = (field) => (value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
    setSuccess('');
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };
  const updateRecipe = (field) => (value) => {
    setRecipeForm((current) => ({ ...current, [field]: value }));
    setError('');
    setSuccess('');
    const errorKey = ({ title: 'recipeTitle', ingredients: 'ingredients', steps: 'steps' })[field];
    if (errorKey) setFieldErrors((current) => ({ ...current, [errorKey]: undefined }));
  };

  const validate = () => {
    const next = {};
    const name = form.name.trim();
    const description = form.description.trim();
    if (!name) next.name = 'Nhập tên món ăn.';
    else if ([...name].length > 200) next.name = 'Tên món ăn không được vượt quá 200 ký tự.';
    else if (exactDishMatch) next.name = `Món “${exactDishMatch.name}” đã có trong Database (${exactDishMatch.status}).`;
    if ([...description].length > 500) next.description = 'Mô tả không được vượt quá 500 ký tự.';
    if (!form.categoryIds.length) next.categoryIds = 'Chọn ít nhất một danh mục.';
    else if (form.categoryIds.length > 20) next.categoryIds = 'Chọn tối đa 20 danh mục.';
    if (!returnRecipeId) {
      if (!recipeForm.title.trim()) next.recipeTitle = 'Nhập tên công thức.';
      if (ingredientCount < 1) next.ingredients = 'Cần ít nhất một nguyên liệu có số lượng.';
      else if (ingredientValidation.hasError) next.ingredients = 'Kiểm tra lại các dòng nguyên liệu.';
      if (stepCount < 1) next.steps = 'Cần ít nhất một bước nấu.';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (returnRecipeId && (!recipeContext || loadingRecipe || recipeError)) return;
    if (!ready) return;
    if (!validate()) return;
    setSaving(true);
    try {
      const dishInput = {
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        thumbnailUrl: recipeContext ? (recipeContext.thumbnailUrl || null) : (form.thumbnailUrl || null),
      };
      if (returnRecipeId) {
        const dish = await createAdminDish(dishInput);
        window.location.assign(`/admin/recipes/verify?createdDishId=${dish.id}&returnRecipeId=${encodeURIComponent(returnRecipeId)}&dishName=${encodeURIComponent(dish.name)}&createdFromRecipe=1`);
        return;
      }
      const created = await createAdminDishWithRecipe({
        ...dishInput,
        recipe: {
          title: recipeForm.title.trim(),
          servings: recipeForm.servings,
          prepTimeMinutes: toMinutes(recipeForm.prep),
          cookTimeMinutes: toMinutes(recipeForm.cook),
          ingredients: cleanIngredients(recipeForm.ingredients),
          instructions: recipeForm.steps.filter((step) => step.trim()).join('\n'),
        },
      });
      setForm(EMPTY_FORM);
      setRecipeForm(createEmptyRecipe());
      setFieldErrors({});
      setSuccess(`Đã tạo Dish “${created.dish.name}” và duyệt công thức “${created.recipe.title}”.`);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleLogout = () => { logout(); window.location.assign('/'); };
  const recipeReady = !!recipeForm.title.trim() && ingredientCount >= 1 && !ingredientValidation.hasError && stepCount >= 1;
  const ready = !!form.name.trim() && plain(checkedDishName) === plain(form.name.trim()) && !exactDishMatch && !searchingDishes && !dishSearchError && form.categoryIds.length > 0 && (!!returnRecipeId || recipeReady);
  const progress = [
    { key: 'dish', label: 'Đặt tên món ăn', done: !!form.name.trim() && !exactDishMatch, target: 'admin-dish-info' },
    { key: 'title', label: 'Đặt tên công thức', done: !!recipeForm.title.trim(), target: 'admin-recipe-info' },
    { key: 'ingredients', label: 'Ít nhất 1 nguyên liệu có số lượng', done: ingredientCount >= 1 && !ingredientValidation.hasError, target: 'admin-recipe-ingredients' },
    { key: 'steps', label: 'Ít nhất 1 bước nấu', done: stepCount >= 1, target: 'admin-recipe-steps' },
  ];
  const doneCount = progress.filter((item) => item.done).length;
  const goTo = (target) => {
    const element = document.getElementById(target);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    element?.querySelector('input, textarea, button')?.focus({ preventScroll: true });
  };

  return <AdminLayout activeKey="dish-create" title="Tạo món ăn" user={user} onLogout={handleLogout}>
    <div className={pageStyles.page}>
      <PageHeader
        breadcrumb={[{ label: 'Duyệt công thức', href: '/admin/recipes/verify' }, { label: 'Tạo món ăn' }]}
        title="Tạo món ăn"
        description="Thêm Dish vào danh mục đang hoạt động. Các mục có dấu * là bắt buộc."
        actions={returnRecipeId ? <Button variant="outline" icon="arrow-left" onClick={() => window.location.assign('/admin/recipes/verify')}>Quay lại duyệt Recipe</Button> : undefined}
      />

      {error && <Notice tone="alert" title="Không thể tạo món ăn">{error}</Notice>}
      {success && <Notice tone="success" title="Đã tạo Dish và Recipe">{success}</Notice>}
      {categoriesError && <Notice tone="alert" title="Không tải được danh mục" action={{ label: 'Tải lại', onClick: retryCategories }}>{categoriesError}</Notice>}
      {recipeError && <Notice tone="alert" title="Không tải được Recipe">{recipeError}</Notice>}

      <form className={pageStyles.grid} onSubmit={submit} noValidate>
        <div className={styles.form}>
          {returnRecipeId && <section className={styles.card} aria-labelledby="dish-recipe-context">
            <div className={styles.head}>
              <h2 id="dish-recipe-context" className={styles.h2}>Recipe cần liên kết</h2>
              <p className={styles.hint}>Dish được tạo tại đây sẽ tự động liên kết với đúng yêu cầu này khi lưu.</p>
            </div>
            {loadingRecipe ? <p className={styles.hint} role="status">Đang tải yêu cầu Recipe…</p> : recipeContext && <div className={pageStyles.recipeContext}>
              <Photo src={recipeContext.thumbnailUrl} alt={`Ảnh công thức ${recipeContext.title}`} ratio="16/9" className={pageStyles.recipeImage} />
              <div className={pageStyles.recipeDetails}><h3 className={styles.h2}>{recipeContext.title}</h3><p className="mb-1">Tên Dish đề xuất: <b>{recipeContext.proposedDishName}</b></p><p className="mb-1 text-body-secondary">{recipeContext.servings ? `${recipeContext.servings} khẩu phần` : ''}{recipeContext.cookTimeMinutes ? ` · ${recipeContext.cookTimeMinutes} phút nấu` : ''}{recipeContext.ingredients?.length ? ` · ${recipeContext.ingredients.length + (recipeContext.proposedIngredients?.length || 0)} nguyên liệu` : ''}</p><small className="text-body-secondary">Recipe #{recipeContext.id} · {recipeContext.authorName || recipeContext.authorEmail}</small></div>
            </div>}
          </section>}

          <section className={styles.card} id="admin-dish-info" aria-labelledby="dish-info-title">
            <div className={styles.head}>
              <h2 id="dish-info-title" className={styles.h2}>Thông tin món ăn</h2>
              <p className={styles.hint}>Kiểm tra tên món đề xuất và bổ sung thông tin danh mục trước khi lưu.</p>
            </div>
            <Field id="admin-dish-name" label="Tên món ăn" required error={fieldErrors.name} hint={exactDishMatch ? undefined : 'Tìm trong các Dish đã được tạo để tránh trùng tên.'} counter={{ value: form.name.length, max: 200 }}>
              <div className={pickerStyles.wrap}>
                <i className={`bi bi-search ${pickerStyles.icon}`} aria-hidden="true" />
                <input
                  id="admin-dish-name"
                  className={`form-control ${pickerStyles.input} ${fieldErrors.name ? 'is-invalid' : ''}`}
                  type="text"
                  role="combobox"
                  aria-expanded={dishNameFocused && rankedDishMatches.length > 0}
                  aria-autocomplete="list"
                  aria-controls="admin-dish-name-results"
                  aria-describedby="admin-dish-name-desc"
                  autoComplete="off"
                  placeholder="Nhập tên món để tìm món đã có"
                  value={form.name}
                  maxLength={200}
                  onChange={(event) => updateField('name')(event.target.value)}
                  onFocus={() => setDishNameFocused(true)}
                  onBlur={() => setDishNameFocused(false)}
                />
                {dishNameFocused && form.name.trim() && (
                  <ul className={pickerStyles.list} id="admin-dish-name-results" role="listbox" aria-label="Dish đã được tạo">
                    {searchingDishes && <li className={pickerStyles.empty} role="presentation">Đang tìm Dish…</li>}
                    {!searchingDishes && rankedDishMatches.map(({ dish, score }) => (
                      <li key={dish.id} className={pickerStyles.opt} role="option" aria-selected={plain(dish.name) === plain(form.name)} onMouseDown={(event) => event.preventDefault()} onClick={() => { updateField('name')(dish.name); setDishNameFocused(false); }}>
                        <i className="bi bi-bookmark" aria-hidden="true" />
                        <span>{dish.name}</span>
                        <span className={pickerStyles.same}>{score === 100 ? `Đã tồn tại · ${dish.status}` : `Gần giống · ${dish.status}`}</span>
                      </li>
                    ))}
                    {!searchingDishes && !dishSearchError && rankedDishMatches.length === 0 && <li className={pickerStyles.empty} role="presentation">Chưa tìm thấy Dish phù hợp.</li>}
                    {dishSearchError && <li className={pickerStyles.empty} role="alert">Không kiểm tra được Dish đã tạo: {dishSearchError}</li>}
                  </ul>
                )}
              </div>
            </Field>
            {exactDishMatch && <p className="text-danger small mt-1" role="alert">Dish “{exactDishMatch.name}” đã tồn tại. Hãy đổi tên hoặc quay lại yêu cầu Recipe để liên kết món có sẵn.</p>}
            {!exactDishMatch && rankedDishMatches.some(({ score }) => score >= 65) && <p className="text-warning-emphasis small mt-1" role="status">Có Dish tên gần giống. Hãy kiểm tra danh sách trước khi tạo mới.</p>}
            {dishSearchError && <p className="text-danger small mt-1" role="alert">Không thể xác minh trùng tên, vui lòng thử lại trước khi tạo Dish.</p>}
            <TextArea label="Mô tả" value={form.description} onChange={updateField('description')} maxLength={500} rows={4} error={fieldErrors.description} />
            {!returnRecipeId && <ImageUpload label="Ảnh món ăn và ảnh bìa công thức" value={form.thumbnailUrl} onChange={updateField('thumbnailUrl')} onUpload={postService.uploadImage} ratio="16/9" />}
            {returnRecipeId && <p className={styles.hint}>Ảnh Dish sẽ được lấy tự động từ ảnh bìa của Recipe đang duyệt.</p>}
            {loadingCategories ? <p className={styles.hint} role="status">Đang tải danh mục…</p> : <CategoryPicker label="Danh mục" options={categories} value={form.categoryIds} onChange={updateField('categoryIds')} max={20} required error={fieldErrors.categoryIds} />}
          </section>

          {!returnRecipeId && <>
            <section className={styles.card} id="admin-recipe-info" aria-labelledby="admin-recipe-info-title">
              <div className={styles.head}><h2 id="admin-recipe-info-title" className={styles.h2}>Thông tin công thức</h2><p className={styles.hint}>Recipe này được tạo cùng Dish và công khai ngay sau khi lưu.</p></div>
              <TextField label="Tên công thức" value={recipeForm.title} onChange={updateRecipe('title')} maxLength={255} required error={fieldErrors.recipeTitle} placeholder="Ví dụ: Đậu hũ sốt cà chua kiểu nhà làm" />
              <div className={styles.row3}>
                <NumberStepper label="Khẩu phần" value={recipeForm.servings} onChange={updateRecipe('servings')} min={1} max={20} unit="người" />
                <TextField label="Chuẩn bị" type="number" inputMode="numeric" min={0} max={600} step={1} suffix="phút" value={recipeForm.prep} onChange={updateRecipe('prep')} placeholder="15" />
                <TextField label="Nấu" type="number" inputMode="numeric" min={0} max={600} step={1} suffix="phút" value={recipeForm.cook} onChange={updateRecipe('cook')} placeholder="20" />
              </div>
            </section>
            <section className={styles.card} id="admin-recipe-ingredients" aria-labelledby="admin-recipe-ingredients-title">
              <div className={styles.head}><h2 id="admin-recipe-ingredients-title" className={styles.h2}>Nguyên liệu <span className={styles.req}>*</span></h2><p className={styles.hint}>Mỗi dòng một nguyên liệu, có số lượng.</p></div>
              <IngredientEditor label="" value={recipeForm.ingredients} onChange={updateRecipe('ingredients')} suggestions={ingredientNames} hint={'Đơn vị “ít”, “vừa đủ” không cần số lượng. Nhấn Enter để thêm dòng.'} error={fieldErrors.ingredients} rowErrors={ingredientValidation.rowErrors} rowNotes={rowNotes} />
            </section>
            <section className={styles.card} id="admin-recipe-steps" aria-labelledby="admin-recipe-steps-title">
              <div className={styles.head}><h2 id="admin-recipe-steps-title" className={styles.h2}>Cách làm <span className={styles.req}>*</span></h2><p className={styles.hint}>Viết từng bước ngắn gọn, theo thứ tự nấu.</p></div>
              <StepEditor label="" value={recipeForm.steps} onChange={updateRecipe('steps')} hint="Ghi thời gian và mức lửa nếu cần. Dùng nút ↑ ↓ để đổi thứ tự." error={fieldErrors.steps} />
            </section>
          </>}
        </div>

        <aside className={styles.aside} aria-label="Xem trước và lưu món ăn">
          <section className={`${styles.card} ${styles.submit}`}>
            {!returnRecipeId && <>
              <div className={styles.progHead}><span className={styles.progTitle}>Mục bắt buộc</span><span className={styles.progCount}>{doneCount}/4</span></div>
              <div className={styles.track} role="progressbar" aria-label="Tiến trình tạo Dish và Recipe" aria-valuemin={0} aria-valuemax={4} aria-valuenow={doneCount}><span className={styles.fill} style={{ width: `${doneCount * 25}%` }} /></div>
              <ul className={styles.checklist}>{progress.map((item) => <li key={item.key}><button type="button" className={`${styles.checkItem} ${item.done ? styles.checkDone : ''}`} onClick={() => goTo(item.target)}><i className={`bi bi-${item.done ? 'check-circle-fill' : 'circle'}`} aria-hidden="true" /><span>{item.label}</span>{!item.done && <i className={`bi bi-arrow-right-short ${styles.go}`} aria-hidden="true" />}</button></li>)}</ul>
              {(unknownIngredientCount > 0 || flaggedIngredientCount > 0) && <ul className={styles.notes} aria-live="polite">{unknownIngredientCount > 0 && <li><i className="bi bi-info-circle" aria-hidden="true" />{unknownIngredientCount} nguyên liệu chưa có trong kho đã duyệt.</li>}{flaggedIngredientCount > 0 && <li className={styles.noteBad}><i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />{flaggedIngredientCount} nguyên liệu cần kiểm tra nguồn gốc.</li>}</ul>}
            </>}
            <div className={styles.head}><h2 className={styles.h2}>{returnRecipeId ? 'Lưu Dish' : 'Tạo Dish & Recipe'}</h2><p className={styles.hint}>{returnRecipeId ? 'Món do Admin tạo sẽ hoạt động ngay sau khi lưu.' : 'Dish được tạo mới và Recipe sẽ được duyệt ngay.'}</p></div>
            <Button block type="submit" icon="check-circle" loading={saving} disabled={saving || loadingCategories || !!categoriesError || loadingRecipe || !!recipeError || (!!returnRecipeId && !recipeContext) || !ready}>{returnRecipeId ? 'Tạo Dish' : 'Tạo Dish & Recipe'}</Button>
            <p className={styles.ok} aria-live="polite">{returnRecipeId ? 'Sau khi lưu, bạn sẽ quay lại đúng yêu cầu Recipe để tiếp tục duyệt.' : 'Dish, thông tin công thức và nguyên liệu sẽ được lưu cùng nhau.'}</p>
          </section>
          <section className={styles.card} aria-labelledby="dish-preview-title">
            <div className={styles.head}><h2 id="dish-preview-title" className={styles.h2}>Xem trước</h2><p className={styles.hint}>Thông tin Dish sau khi được tạo.</p></div>
            <article className={styles.preview}>
              <Photo src={(recipeContext?.thumbnailUrl || (!returnRecipeId && form.thumbnailUrl)) || undefined} alt={recipeContext ? `Ảnh từ công thức ${recipeContext.title}` : form.thumbnailUrl ? `Ảnh món ${form.name}` : ''} ratio="16/9" />
              <div className={styles.pBody}>
                <small className={styles.pMeta}>{form.name.trim() || 'Chưa chọn món'}</small>
                <h3 className={`${styles.pTitle} ${(recipeContext?.title || recipeForm.title).trim() ? '' : styles.pPlaceholder}`}>{recipeContext?.title || recipeForm.title || 'Tên công thức'}</h3>
                <p className={styles.pMeta}>{form.description.trim() || 'Mô tả món ăn sẽ hiển thị tại đây.'}</p>
                {!returnRecipeId && <>
                  <p className={styles.pMeta}>{[recipeForm.servings && `${recipeForm.servings} người`, (Number(recipeForm.prep) || 0) + (Number(recipeForm.cook) || 0) > 0 && `${(Number(recipeForm.prep) || 0) + (Number(recipeForm.cook) || 0)} phút`, cleanIngredients(recipeForm.ingredients).length > 0 && `${cleanIngredients(recipeForm.ingredients).length} nguyên liệu`].filter(Boolean).join(' · ') || 'Khẩu phần, thời gian sẽ hiện ở đây'}</p>
                  <div className={styles.pBy}><Avatar name={user?.fullName || 'Admin'} src={user?.avatarUrl || undefined} size={24} /><span>{user?.fullName || 'Admin'}</span></div>
                </>}
                {recipeContext && <p className={styles.pMeta}>Ảnh và yêu cầu được lấy từ Recipe: <b>{recipeContext.title}</b></p>}
                {categories.filter((category) => form.categoryIds.includes(category.value)).map((category) => <span key={category.value} className="badge rounded-pill text-bg-light border">{category.label}</span>)}
              </div>
            </article>
          </section>
        </aside>
      </form>
    </div>
  </AdminLayout>;
}
