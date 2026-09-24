import { useState } from 'react';
import {
  Avatar, Button, Chip, DishCard, EmptyState, IngredientEditor, IngredientList, Notice, NumberStepper, Photo,
  RecipeCard, RecipeFacts, RecipeSteps, ReportDialog, Select, ShopCard, ShopMenuItem, StatusBadge, StepEditor, Tabs,
  TextArea, TextField, ImageUpload, useToast,
  rules, validate, hasErrors, newIngredientRow, validateIngredients, cleanIngredients, timeAgo,
} from '../components';
import Section, { DemoLabel } from './Section';
import { mockUpload, wait } from './mock';
import styles from './kit.module.css';

// ---------------- Dữ liệu mẫu ----------------
const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
const at = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
const ME = { name: 'Lâm Anh Khôi' };

const DISHES = [
  { id: 1, name: 'Bún riêu chay', description: 'Nước dùng cà chua, me; riêu từ đậu hũ non và nấm rơm.', categories: [{ id: 1, name: 'Món nước' }, { id: 10, name: 'Bún & phở' }, { id: 14, name: 'Chay miền Nam' }], recipeCount: 12, shopCount: 5 },
  { id: 2, name: 'Đậu hũ kho nấm đông cô', description: 'Món mặn đưa cơm, kho tiêu với nước tương.', categories: [{ id: 9, name: 'Cơm' }], recipeCount: 8, shopCount: 2 },
  { id: 3, name: 'Gỏi cuốn chay', description: 'Cuốn bún, rau sống, đậu hũ chiên, chấm tương đậu phộng.', categories: [{ id: 8, name: 'Gỏi & salad' }], recipeCount: 0, shopCount: 9 },
];
const MY_DISHES = [
  { name: 'Bánh xèo chay nấm mỡ', categories: [{ id: 11, name: 'Bánh' }], status: 'pending' },
  { name: 'Cà ri chay', categories: [{ id: 1, name: 'Món nước' }], status: 'active', recipeCount: 3, shopCount: 1 },
  { name: 'Chả cá chay', categories: [{ id: 4, name: 'Món chiên' }], status: 'rejected', moderationNote: 'Đã có món "Chả cá chay thì là". Vui lòng viết công thức cho món đó.' },
];

const RECIPE = {
  title: 'Bún riêu chay nấm rơm, riêu xốp không bở',
  description: 'Riêu làm từ đậu hũ non và nấm rơm băm, hấp trước rồi mới thả vào nồi nên không bị tan.',
  author: { name: 'Dương Vĩ Lâm' },
  createdAt: ago(60 * 30),
  cookTimeMinutes: 75,
  servings: 4,
  calories: 420,
  ingredients: [
    { name: 'Đậu hũ non', amount: 300, unit: 'g' },
    { name: 'Nấm rơm', amount: 150, unit: 'g' },
    { name: 'Cà chua chín', amount: 4, unit: 'quả' },
    { name: 'Me chua', amount: 2, unit: 'muỗng canh' },
    { name: 'Củ cải trắng', amount: 1, unit: 'củ' },
    { name: 'Bún tươi', amount: 0.5, unit: 'kg' },
    { name: 'Muối', amount: null, unit: 'vừa đủ' },
  ],
  steps: [
    'Hầm củ cải, bắp và su su với 2 lít nước trong 45 phút, lọc lấy nước dùng.',
    'Tán nhuyễn đậu hũ non, trộn với nấm rơm băm, nêm muối tiêu. Hấp 15 phút cho riêu đông lại.',
    'Phi cà chua với me cho sệt, đổ vào nồi nước dùng. Cắt riêu thành miếng, thả vào nồi đun nhỏ lửa 5 phút.',
    'Chan nước dùng lên bún, ăn kèm rau sống và đậu hũ chiên.',
  ],
};
const RECIPES = [
  { id: 1, ...RECIPE, ingredientCount: 7 },
  { id: 2, title: 'Bún riêu chay kiểu Bắc, gạch cua từ đậu xanh', description: 'Dùng đậu xanh hấp và bột nghệ tạo màu gạch cua, nước dùng thanh vị.', author: { name: 'Mai Khương Duy' }, createdAt: ago(60 * 24 * 4), cookTimeMinutes: 60, servings: 3, calories: 380, ingredientCount: 9 },
  { id: 3, title: 'Bún riêu chay 30 phút cho người bận', author: ME, isOwner: true, createdAt: ago(60 * 24 * 12), cookTimeMinutes: 30, servings: 2, ingredientCount: 6 },
];
const SHOPS = [
  { id: 1, name: 'Quán Chay Tâm An', address: '123 Nguyễn Trãi, Phường 7, Quận 5, TP.HCM', openTime: '07:00', closeTime: '21:00', phone: '0909 123 456', dishCount: 42, now: at(10) },
  { id: 2, name: 'Bếp Chay Hoa Sen', address: '45 Lê Văn Sỹ, Phường 13, Quận 3, TP.HCM', openTime: '10:00', closeTime: '21:00', dishCount: 18, now: at(20, 45) },
  { id: 3, name: 'Chay Như Ý', address: '8 Trần Hưng Đạo, Quận 1, TP.HCM', openTime: '06:00', closeTime: '14:00', dishCount: 25, now: at(19) },
];
const MENU = [
  { id: 1, name: 'Bún riêu chay', price: 45000, ingredientNote: 'Riêu đậu hũ non, nấm rơm. Không hành tỏi.', isAvailable: true },
  { id: 2, name: 'Cơm tấm chay', price: 50000, ingredientNote: 'Sườn non chay, bì chay, trứng hấp chay.', isAvailable: true },
  { id: 3, name: 'Lẩu nấm thập cẩm', price: 180000, ingredientNote: 'Cho 2 đến 3 người.', isAvailable: false },
  { id: 4, name: 'Trà sen', price: null, isAvailable: true },
];
const ING_SUGGEST = ['Đậu hũ non', 'Đậu hũ chiên', 'Nấm rơm', 'Nấm đông cô', 'Nấm bào ngư', 'Cà chua', 'Me chua', 'Củ cải trắng', 'Bún tươi', 'Rau muống', 'Nước tương', 'Muối', 'Tiêu', 'Đường phèn', 'Sả', 'Ớt'];

// ---------------- 4-03: Xem công thức (dùng lại trong trang mẫu) ----------------
function RecipeDetail({ recipe, onReport }) {
  const [servings, setServings] = useState(recipe.servings);
  return (
    <article className={styles.article}>
      <Photo ratio="16/9" shape="rounded" alt={recipe.title} />
      <h3 className={styles.articleTitle}>{recipe.title}</h3>
      <div className={styles.byline}>
        <Avatar name={recipe.author.name} size={36} />
        <div><b>{recipe.author.name}</b><span>{timeAgo(recipe.createdAt)}</span></div>
        <span className={styles.spacer} />
        {onReport && <Button size="sm" variant="subtle" icon="flag" onClick={onReport}>Báo cáo</Button>}
      </div>
      {recipe.description && <p className="mb-0">{recipe.description}</p>}
      <RecipeFacts cookTimeMinutes={recipe.cookTimeMinutes} servings={recipe.servings} calories={recipe.calories} />
      <div className={styles.recipeCols}>
        <div className={styles.stackSm}>
          <div className={styles.recipeHead}>
            <h4>Nguyên liệu</h4>
            <NumberStepper value={servings} onChange={setServings} min={1} max={20} unit="người" />
          </div>
          <IngredientList items={recipe.ingredients} baseServings={recipe.servings} servings={servings} checkable />
        </div>
        <div className={styles.stackSm}>
          <h4 className={styles.recipeH4}>Cách làm</h4>
          <RecipeSteps steps={recipe.steps} />
        </div>
      </div>
    </article>
  );
}

// ---------------- 4-08: Trang mẫu Dish Detail (M-13) ----------------
function DishDetail() {
  const toast = useToast();
  const [tab, setTab] = useState('recipes');
  const [sort, setSort] = useState('newest');
  const [open, setOpen] = useState(null);
  const [report, setReport] = useState(null);
  const [pending, setPending] = useState(false);
  const dish = DISHES[0];

  const sorted = [...RECIPES].sort((a, b) => {
    if (sort === 'fastest') return a.cookTimeMinutes - b.cookTimeMinutes;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return (
    <div className={styles.detail}>
      <div className={styles.row}>
        <Button size="sm" variant="outline" icon={pending ? 'hourglass-split' : 'check-circle'} onClick={() => setPending((v) => !v)}>
          {pending ? 'Đang xem: món chờ duyệt' : 'Đang xem: món đã duyệt'}
        </Button>
      </div>

      <header className={styles.dishHead}>
        <Photo ratio="4/3" shape="leaf" alt={dish.name} className={styles.dishPhoto} />
        <div className={styles.stackSm}>
          <div className={styles.chipsRow}>{dish.categories.map((c) => <Chip key={c.id}>{c.name}</Chip>)}</div>
          <h3 className={styles.articleTitle}>{dish.name}</h3>
          <p className="mb-0 text-body-secondary">{dish.description}</p>
          {pending && <StatusBadge entity="dish" status="pending" />}
        </div>
      </header>

      {pending ? (
        <Notice tone="info" title="Món đang chờ Admin duyệt">
          Khi món được duyệt, bạn và mọi người mới có thể viết công thức cho món này (UC-11).
        </Notice>
      ) : (
        <>
          <Tabs
            label="Nội dung món"
            value={tab}
            onChange={setTab}
            items={[
              { key: 'recipes', label: 'Công thức', icon: 'journal-richtext', count: RECIPES.length },
              { key: 'shops', label: 'Quán có món này', icon: 'shop', count: 2 },
            ]}
          />
          {tab === 'recipes' ? (
            <div className={styles.stackSm}>
              <div className={styles.toolbar}>
                <Select size="sm" value={sort} onChange={setSort} aria-label="Sắp xếp công thức"
                  options={[{ value: 'newest', label: 'Mới nhất' }, { value: 'fastest', label: 'Nấu nhanh nhất' }]} />
                <Button size="sm" icon="plus-lg" as="a" href="#4-09">Viết công thức của bạn</Button>
              </div>
              {sorted.map((r) => (
                <RecipeCard key={r.id} {...r} href="#4-08"
                  onEdit={() => toast('Mở form sửa công thức', { tone: 'info' })}
                  onDelete={() => toast('Mở hộp xác nhận xoá', { tone: 'info' })}
                  onReport={() => setReport(r.title)} />
              ))}
              <Button variant="outline" size="sm" icon={open ? 'chevron-up' : 'book'} onClick={() => setOpen((v) => !v)}>
                {open ? 'Thu gọn công thức' : 'Xem thử chi tiết công thức đầu tiên'}
              </Button>
              {open && <RecipeDetail recipe={RECIPE} onReport={() => setReport(RECIPE.title)} />}
            </div>
          ) : (
            <div className={styles.stackSm}>
              <ShopCard layout="row" {...SHOPS[0]} matchedDish={{ name: dish.name, price: 45000 }} href="#4-10" />
              <ShopCard layout="row" {...SHOPS[1]} matchedDish={{ name: dish.name, price: 52000 }} href="#4-10" />
              <p className="small text-body-secondary mb-0">Chỉ hiện quán đã xác minh và món đang bán (UC-08). Không có khoảng cách/km.</p>
            </div>
          )}
        </>
      )}

      <ReportDialog open={!!report} targetType="recipe" targetTitle={report}
        onSubmit={async () => { await wait(600); toast('Đã gửi báo cáo công thức', { tone: 'info' }); }}
        onClose={() => setReport(null)} />
    </div>
  );
}

// ---------------- 4-09: Form mẫu Tạo Recipe (M-19) ----------------
const EMPTY_RECIPE = () => ({
  title: '', description: '', imageUrl: '', cookTime: '', servings: 2, calories: '',
  ingredients: [newIngredientRow()], steps: [''],
});

function RecipeForm() {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_RECIPE);
  const [errors, setErrors] = useState({});
  const [ingErr, setIngErr] = useState({ rowErrors: [] });
  const [sending, setSending] = useState(false);
  const [payload, setPayload] = useState(null);
  const set = (key) => (v) => {
    setForm((f) => ({ ...f, [key]: v }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(form, {
      title: [rules.required('Đặt tên cho công thức'), rules.maxLength(200)],
      cookTime: [rules.required('Nhập thời gian nấu'), rules.between(1, 600, 'phút')],
      calories: [rules.between(0, 3000, 'kcal')],
    });
    const steps = form.steps.map((s) => s.trim()).filter(Boolean);
    if (!steps.length) errs.steps = 'Cần ít nhất 1 bước nấu';
    const ing = validateIngredients(form.ingredients);
    setErrors(errs);
    setIngErr(ing);
    if (hasErrors(errs) || ing.hasError) {
      toast('Còn vài chỗ cần sửa, xem chữ đỏ bên dưới', { tone: 'alert' });
      return;
    }
    setSending(true);
    await wait(900);
    setSending(false);
    setPayload({
      dish_id: 1,
      title: form.title.trim(),
      description: form.description.trim() || null,
      image_url: form.imageUrl || null,
      cook_time: Number(form.cookTime),
      servings: form.servings,
      calories: form.calories === '' ? null : Number(form.calories),
      instructions: steps.join('\n'),
      ingredients: cleanIngredients(form.ingredients).map((r) => ({ name: r.name, amount: r.amount, unit: r.unit || null })),
    });
    toast('Đã đăng công thức');
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.row}>
        <span className="small text-body-secondary">Công thức cho món:</span>
        <Chip icon="bookmark">Bún riêu chay</Chip>
        <StatusBadge entity="dish" status="active" size="sm" />
      </div>
      <TextField label="Tên công thức" value={form.title} onChange={set('title')} error={errors.title} maxLength={200} required
        placeholder="vd: Bún riêu chay nấm rơm, riêu xốp không bở" />
      <TextArea label="Giới thiệu ngắn" value={form.description} onChange={set('description')} maxLength={500} rows={2}
        hint="Điểm khác biệt của cách nấu này so với công thức khác." />
      <div className={styles.grid3}>
        <TextField label="Thời gian nấu" type="number" inputMode="numeric" suffix="phút" value={form.cookTime} onChange={set('cookTime')} error={errors.cookTime} required />
        <NumberStepper label="Khẩu phần" value={form.servings} onChange={set('servings')} min={1} max={20} unit="người" />
        <TextField label="Năng lượng" type="number" inputMode="numeric" suffix="kcal/người" value={form.calories} onChange={set('calories')} error={errors.calories} hint="Không bắt buộc" />
      </div>
      <ImageUpload label="Ảnh món đã nấu" value={form.imageUrl} onChange={set('imageUrl')} onUpload={mockUpload(false)} ratio="16/9" />
      <IngredientEditor value={form.ingredients} onChange={(v) => { set('ingredients')(v); setIngErr({ rowErrors: [] }); }}
        suggestions={ING_SUGGEST} error={ingErr.error} rowErrors={ingErr.rowErrors} required />
      <StepEditor value={form.steps} onChange={set('steps')} error={errors.steps} required />
      <div className={styles.formActions}>
        <Button variant="subtle" onClick={() => { setForm(EMPTY_RECIPE()); setErrors({}); setIngErr({ rowErrors: [] }); setPayload(null); }}>Làm lại</Button>
        <Button type="submit" icon="send" loading={sending}>Đăng công thức</Button>
      </div>
      {payload && (
        <div className={styles.stackSm}>
          <DemoLabel>Dữ liệu gửi API (POST /recipes) sau khi bấm Đăng</DemoLabel>
          <pre className={styles.payload}>{JSON.stringify(payload, null, 2)}</pre>
        </div>
      )}
    </form>
  );
}

// ---------------- 4-10: Trang mẫu Chi tiết Shop (M-09) + Quán của tôi (M-18) ----------------
function ShopDetail() {
  const toast = useToast();
  const [owner, setOwner] = useState(false);
  const [menu, setMenu] = useState(MENU);
  const [toggling, setToggling] = useState(null);
  const shop = SHOPS[0];

  const toggle = async (id, next) => {
    setToggling(id);
    setMenu((m) => m.map((x) => (x.id === id ? { ...x, isAvailable: next } : x))); // đổi ngay
    await wait(500);
    setToggling(null);
    toast(next ? 'Đã mở bán lại món' : 'Đã chuyển món sang Tạm hết');
  };
  const shown = owner ? menu : [...menu].sort((a, b) => Number(b.isAvailable) - Number(a.isAvailable));

  return (
    <div className={styles.detail}>
      <div className={styles.row}>
        <Button size="sm" variant={owner ? 'primary' : 'outline'} icon={owner ? 'shop-window' : 'person'} onClick={() => setOwner((v) => !v)}>
          {owner ? 'Đang xem với vai: Chủ quán (M-18)' : 'Đang xem với vai: Khách (M-09)'}
        </Button>
      </div>
      <ShopCard layout="row" {...shop} showStatus={owner} status="verified" href="#4-10" />
      <section className={styles.stackSm} aria-labelledby="menu-title">
        <div className={styles.toolbar}>
          <h4 id="menu-title" className={styles.recipeH4}>Menu <small className="text-body-secondary">({menu.length} món)</small></h4>
          {owner && <Button size="sm" icon="plus-lg" onClick={() => toast('Mở hộp thêm món: chọn Dish + giá + ghi chú', { tone: 'info' })}>Thêm món</Button>}
        </div>
        {menu.length ? (
          <ul className={styles.menuList}>
            {shown.map((m) => (
              <ShopMenuItem key={m.id} {...m} dishHref="#4-08" editable={owner} toggling={toggling === m.id}
                onToggleAvailable={(v) => toggle(m.id, v)}
                onEdit={() => toast('Mở hộp sửa giá / ghi chú', { tone: 'info' })}
                onDelete={() => setMenu((l) => l.filter((x) => x.id !== m.id))} />
            ))}
          </ul>
        ) : (
          <EmptyState icon="card-list" title="Menu đang trống">Thêm món đầu tiên để khách tìm thấy quán khi tìm món.</EmptyState>
        )}
      </section>
    </div>
  );
}

// ---------------- Các mục đợt 4 ----------------
export default function Batch4() {
  const toast = useToast();
  const [ingredients, setIngredients] = useState([
    newIngredientRow({ name: 'Đậu hũ non', amount: 300, unit: 'g' }),
    newIngredientRow({ name: 'Nấm rơm', amount: 150, unit: 'g' }),
    newIngredientRow({ name: 'Muối', unit: 'vừa đủ' }),
  ]);
  const [ingCheck, setIngCheck] = useState({ rowErrors: [] });
  const [steps, setSteps] = useState(['Hầm củ cải với 2 lít nước trong 45 phút.', 'Hấp riêu 15 phút.']);
  const [servings, setServings] = useState(4);

  return (
    <>
      <h2 className={styles.groupTitle}>Đợt 4 · Món, công thức, quán <small>10 mục</small></h2>

      <Section
        code="4-01"
        title="DishCard"
        file="components/DishCard"
        when="danh mục món, kết quả tìm món (card). Dạng row cho danh sách gọn: chọn món khi đổi món trong Meal Plan (có nút action), 'Món tôi đề xuất', hàng chờ duyệt Dish của admin."
        props={[
          ['layout', "'card'|'row'", "'card'", ''],
          ['name · description · imageUrl', 'string', '', 'dish.*'],
          ['href · linkAs', '', '', 'Tới Dish Detail M-13. Cả thẻ bấm được'],
          ['categories', '{id, name}[]', '[]', 'Hiện tối đa 2'],
          ['recipeCount · shopCount', 'number', '', 'Không truyền → ẩn'],
          ['status · showStatus · moderationNote', '', '', 'Chỉ người đề xuất / admin thấy'],
          ['action', 'ReactNode', '', 'Nút bên phải ở dạng row'],
        ]}
        usage={`const toDish = (d) => ({
  name: d.name, description: d.description, imageUrl: d.image_url, href: \`/dishes/\${d.dish_id}\`,
  categories: d.categories.map((c) => ({ id: c.category_id, name: c.name })),
  recipeCount: d.recipe_count, shopCount: d.shop_count,
});
<DishCard {...toDish(d)} linkAs={Link} />
<DishCard layout="row" {...toDish(d)} action={<Button size="sm" onClick={() => pick(d)}>Chọn</Button>} />`}
      >
        <div className={styles.grid3}>
          {DISHES.map((d) => <DishCard key={d.id} {...d} href="#4-08" />)}
        </div>
        <div className={styles.grid2}>
          <div className={styles.stackSm}>
            <DemoLabel>Món tôi đề xuất (showStatus)</DemoLabel>
            {MY_DISHES.map((d) => <DishCard key={d.name} layout="row" {...d} showStatus href="#4-08" />)}
          </div>
          <div className={styles.stackSm}>
            <DemoLabel>Đổi món trong Meal Plan (có action)</DemoLabel>
            {DISHES.map((d) => (
              <DishCard key={d.id} layout="row" {...d} href="#4-08"
                action={<Button size="sm" variant="outline" onClick={() => toast(`Đã chọn ${d.name}`)}>Chọn</Button>} />
            ))}
          </div>
        </div>
      </Section>

      <Section
        code="4-02"
        title="RecipeCard"
        file="components/RecipeCard"
        when="danh sách công thức trong Dish Detail (row), Công thức của tôi (row + dishName), lưới nổi bật (card). Recipe không có vote và không chờ duyệt; người khác chỉ Báo cáo."
        props={[
          ['layout', "'row'|'card'", "'row'", ''],
          ['title · description · imageUrl · href · linkAs', '', '', ''],
          ['author · createdAt', '', '', ''],
          ['cookTimeMinutes · servings · calories', 'number', '', 'calories tính cho 1 người'],
          ['ingredientCount', 'number', '', ''],
          ['dishName', 'string', '', 'Hiện khi thẻ nằm ngoài trang món'],
          ['isOwner · onEdit · onDelete · onReport', '', '', ''],
        ]}
        usage={`<RecipeCard {...toRecipe(r)} linkAs={Link} isOwner={r.author_id === user?.account_id}
  onEdit={() => navigate(\`/recipes/\${r.recipe_id}/edit\`)} onDelete={() => setDeleting(r)}
  onReport={() => setReport({ type: 'recipe', id: r.recipe_id, title: r.title })} />`}
      >
        <div className={styles.stackSm}>
          {RECIPES.slice(0, 2).map((r) => <RecipeCard key={r.id} {...r} href="#4-08" onReport={() => toast('Mở ReportDialog (recipe)', { tone: 'info' })} />)}
          <RecipeCard {...RECIPES[2]} dishName="Bún riêu chay" href="#4-08" onEdit={() => toast('Sửa', { tone: 'info' })} onDelete={() => toast('Xoá', { tone: 'info' })} />
        </div>
        <div className={styles.grid3}>
          {RECIPES.map((r) => <RecipeCard key={r.id} layout="card" {...r} href="#4-08" onReport={() => {}} />)}
        </div>
      </Section>

      <Section
        code="4-03"
        title="RecipeFacts · IngredientList · RecipeSteps"
        file="components/RecipeView"
        when="đọc công thức. IngredientList tự nhân số lượng khi đổi khẩu phần và cho tick những thứ đã chuẩn bị. RecipeSteps nhận mảng hoặc chuỗi instructions (mỗi dòng 1 bước)."
        props={[
          ['RecipeFacts', 'cookTimeMinutes · servings · calories · size', '', 'Thiếu số nào ẩn số đó'],
          ['IngredientList items', '{name, amount, unit}[]', '', ''],
          ['IngredientList baseServings · servings', 'number', '', '300g cho 4 người, xem 2 người → 150g'],
          ['IngredientList checkable', 'boolean', 'false', 'Chỉ lưu tạm trên màn hình'],
          ['RecipeSteps steps', 'string[] | string', '', 'recipe.instructions'],
        ]}
        usage={`const [servings, setServings] = useState(recipe.servings);
<RecipeFacts cookTimeMinutes={recipe.cook_time} servings={recipe.servings} calories={recipe.calories} />
<NumberStepper value={servings} onChange={setServings} min={1} unit="người" />
<IngredientList items={recipe.ingredients} baseServings={recipe.servings} servings={servings} checkable />
<RecipeSteps steps={recipe.instructions} />`}
      >
        <RecipeFacts cookTimeMinutes={RECIPE.cookTimeMinutes} servings={RECIPE.servings} calories={RECIPE.calories} />
        <div className={styles.grid2}>
          <div className={styles.stackSm}>
            <div className={styles.recipeHead}>
              <DemoLabel>Nguyên liệu (thử đổi khẩu phần)</DemoLabel>
              <NumberStepper value={servings} onChange={setServings} min={1} max={20} unit="người" />
            </div>
            <IngredientList items={RECIPE.ingredients} baseServings={RECIPE.servings} servings={servings} checkable />
          </div>
          <div className={styles.stackSm}>
            <DemoLabel>Cách làm</DemoLabel>
            <RecipeSteps steps={RECIPE.steps} />
          </div>
        </div>
      </Section>

      <Section
        code="4-04"
        title="IngredientEditor"
        file="components/IngredientEditor"
        when="nhập nguyên liệu khi tạo/sửa công thức (M-19). Tên và đơn vị gõ tự do nhưng có gợi ý; số lượng nhận 2, 0,5 hoặc 1/2; đơn vị 'ít', 'vừa đủ' tự khoá ô số. Enter ở dòng cuối thêm dòng mới."
        note="Thử: xoá tên ở dòng 2, gõ trùng 'Đậu hũ non', hoặc gõ đơn vị mà bỏ trống số lượng, rồi bấm Kiểm tra."
        props={[
          ['value', '{key, name, amount, unit}[]', '', 'Tạo dòng bằng newIngredientRow()'],
          ['onChange', '(rows) => void', '', ''],
          ['suggestions', 'string[]', '[]', 'Tên từ bảng ingredient'],
          ['error · rowErrors', 'string · object[]', '', 'Lấy từ validateIngredients(rows)'],
          ['max', 'number', '40', ''],
        ]}
        usage={`const [rows, setRows] = useState([newIngredientRow()]);
// Sửa công thức: dữ liệu API → dòng
// setRows(recipe.ingredients.map((i) => newIngredientRow({ name: i.name, amount: i.amount, unit: i.unit ?? '' })));

const check = validateIngredients(rows);           // { error, rowErrors, hasError }
<IngredientEditor value={rows} onChange={setRows} suggestions={ingredientNames}
  error={check.error} rowErrors={check.rowErrors} required />

// Gửi API: cleanIngredients(rows) → [{ name, amount, unit }] (đã bỏ dòng trống và key)`}
      >
        <IngredientEditor value={ingredients} onChange={(v) => { setIngredients(v); setIngCheck({ rowErrors: [] }); }}
          suggestions={ING_SUGGEST} error={ingCheck.error} rowErrors={ingCheck.rowErrors} required />
        <div className={styles.row}>
          <Button size="sm" variant="outline" icon="check2-square" onClick={() => {
            const r = validateIngredients(ingredients);
            setIngCheck(r);
            if (!r.hasError) toast(`Hợp lệ: ${cleanIngredients(ingredients).length} nguyên liệu`);
          }}>Kiểm tra</Button>
        </div>
      </Section>

      <Section
        code="4-05"
        title="StepEditor"
        file="components/StepEditor"
        when="nhập các bước nấu (M-19). Mỗi bước 1 ô, tự đánh số, đổi thứ tự bằng nút lên/xuống. Database chỉ có recipe.instructions nên gửi API bằng steps.join('\\n')."
        props={[
          ['value · onChange', 'string[]', '', ''],
          ['max · maxLength', 'number', '30 · 1000', ''],
          ['label · hint · error · required · disabled', '', '', ''],
        ]}
        usage={`const [steps, setSteps] = useState(recipe ? recipe.instructions.split('\\n') : ['']);
<StepEditor value={steps} onChange={setSteps} error={errors.steps} required />
// Gửi API: instructions = steps.map((s) => s.trim()).filter(Boolean).join('\\n')`}
      >
        <StepEditor value={steps} onChange={setSteps} />
      </Section>

      <Section
        code="4-06"
        title="ShopCard"
        file="components/ShopCard"
        when="Danh sách Shop M-08 (card), 'Quán có món này' UC-08 (row + matchedDish), Quán của tôi / hàng chờ xác minh (showStatus). Tự tính Đang mở / Sắp đóng / Đã đóng từ giờ mở cửa. Không có km (BR-07)."
        props={[
          ['layout', "'card'|'row'", "'card'", ''],
          ['name · imageUrl · address · phone', 'string', '', ''],
          ['openTime · closeTime', "'HH:mm'", '', 'Mở qua đêm vẫn tính đúng'],
          ['now', 'Date', 'new Date()', 'Chỉ truyền khi test'],
          ['href · linkAs', '', '', 'Tới M-09'],
          ['dishCount', 'number', '', ''],
          ['matchedDish', '{name, price?}', '', 'UC-08'],
          ['status · showStatus · moderationNote', '', '', 'verification_status'],
          ['showDirections', 'boolean', 'true', 'Mở Google Maps theo địa chỉ'],
        ]}
        usage={`<ShopCard name={s.name} imageUrl={s.image_url} address={s.address} phone={s.phone}
  openTime={s.open_time} closeTime={s.close_time} dishCount={s.dish_count}
  href={\`/shops/\${s.shop_id}\`} linkAs={Link} />

// UC-08: GET /dishes/:id/shops → mỗi quán kèm giá món
<ShopCard layout="row" {...toShop(s)} matchedDish={{ name: dish.name, price: s.price }} />`}
      >
        <div className={styles.grid3}>
          {SHOPS.map((s) => <ShopCard key={s.id} {...s} href="#4-10" />)}
        </div>
        <div className={styles.grid2}>
          <div className={styles.stackSm}>
            <DemoLabel>Quán có món "Bún riêu chay" (UC-08)</DemoLabel>
            <ShopCard layout="row" {...SHOPS[0]} matchedDish={{ name: 'Bún riêu chay', price: 45000 }} href="#4-10" />
          </div>
          <div className={styles.stackSm}>
            <DemoLabel>Quán của tôi (showStatus)</DemoLabel>
            <ShopCard layout="row" name="Chay Bình An" address="12 Phan Xích Long, Phú Nhuận" openTime="08:00" closeTime="20:00" showStatus status="pending" href="#4-10" />
            <ShopCard layout="row" name="Chay Bình An" address="12 Phan Xích Long, Phú Nhuận" showStatus status="rejected"
              moderationNote="Địa chỉ chưa đúng, vui lòng bổ sung số nhà và ảnh mặt tiền." href="#4-10" />
          </div>
        </div>
      </Section>

      <Section
        code="4-07"
        title="ShopMenuItem"
        file="components/ShopMenuItem"
        when="1 món trong menu quán (shop_dish). Khách: món tạm hết bị mờ + nhãn. Chủ quán (editable): công tắc Đang bán bật/tắt tức thì, menu Sửa/Xoá. Đặt trong <ul>."
        props={[
          ['name', 'string', '', 'dish.name'],
          ['price', 'number', '', 'Trống → "Liên hệ"'],
          ['ingredientNote', 'string', '', 'shop_dish.ingredient_note'],
          ['isAvailable', 'boolean', 'true', 'shop_dish.is_available'],
          ['showPhoto · imageUrl', '', 'false', 'Ảnh món bên trái'],
          ['dishHref · linkAs', '', '', 'Bấm tên → Dish Detail'],
          ['editable · onToggleAvailable · toggling', '', '', 'Chế độ chủ quán'],
          ['onEdit · onDelete', '() => void', '', ''],
        ]}
        usage={`<ul className="list-unstyled">
  {menu.map((m) => (
    <ShopMenuItem key={m.shop_dish_id} name={m.dish.name} price={m.price} ingredientNote={m.ingredient_note}
      isAvailable={m.is_available} dishHref={\`/dishes/\${m.dish_id}\`} linkAs={Link}
      editable={isOwner} toggling={saving === m.shop_dish_id}
      onToggleAvailable={(v) => api.updateShopDish(m.shop_dish_id, { is_available: v })} />
  ))}
</ul>`}
      >
        <div className={styles.grid2}>
          <div>
            <DemoLabel>Khách xem</DemoLabel>
            <ul className={styles.menuList}>{MENU.map((m) => <ShopMenuItem key={m.id} {...m} dishHref="#4-08" />)}</ul>
          </div>
          <div>
            <DemoLabel>Chủ quán (có ảnh)</DemoLabel>
            <ul className={styles.menuList}>{MENU.slice(0, 3).map((m) => <ShopMenuItem key={m.id} {...m} showPhoto editable onToggleAvailable={() => toast('Đổi trạng thái (demo đầy đủ ở 4-10)', { tone: 'info' })} onEdit={() => {}} onDelete={() => {}} />)}</ul>
          </div>
        </div>
      </Section>

      <Section
        code="4-08"
        title="Trang mẫu: Dish Detail (M-13)"
        file="kit/Batch4.jsx › DishDetail"
        when="tham khảo cách ghép: đầu trang món, tab Công thức / Quán có món này, sắp xếp, báo cáo công thức, xem chi tiết công thức có đổi khẩu phần."
        note="Bấm nút ở đầu để xem trường hợp món còn chờ duyệt (chưa được viết công thức)."
      >
        <DishDetail />
      </Section>

      <Section
        code="4-09"
        title="Form mẫu: Tạo Recipe (M-19)"
        file="kit/Batch4.jsx › RecipeForm"
        when="form đầy đủ theo UC-11: tiêu đề, mô tả, thời gian, khẩu phần, calo, ảnh, nguyên liệu (amount/unit), các bước. Bấm Đăng để xem đúng dữ liệu gửi API (key database)."
      >
        <RecipeForm />
      </Section>

      <Section
        code="4-10"
        title="Trang mẫu: Chi tiết Shop (M-09) · Quán của tôi (M-18)"
        file="kit/Batch4.jsx › ShopDetail"
        when="thông tin quán + menu. Chuyển vai Chủ quán để bật/tắt Đang bán từng món, thêm/sửa/xoá món."
      >
        <ShopDetail />
      </Section>
    </>
  );
}
