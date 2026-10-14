import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLayout, Button, EmptyState, Notice, PageHeader, Panel, Photo, SearchInput, Spinner } from '../components';
import useAuth from '../hooks/useAuth';
import { getAdminDishes } from '../services/dish.service';
import styles from './AdminDishManagementPage.module.css';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date);
};

// Duy's Code : Nhận diện tên món chung để gom các món cùng họ vào một nhóm mà không sửa dữ liệu DB.
const DISH_FAMILIES = [
  'Bánh Mì', 'Bánh Cuốn', 'Bánh Xèo', 'Bánh Canh', 'Gỏi Cuốn', 'Hủ Tiếu', 'Nước Ép', 'Sinh Tố', 'Yến Mạch',
  'Cà Ri', 'Đậu Hũ', 'Rau Củ', 'Nấm', 'Cơm', 'Bún', 'Phở', 'Mì', 'Cháo', 'Chè', 'Gỏi', 'Canh', 'Lẩu',
  'Xôi', 'Súp', 'Salad', 'Nộm', 'Bánh',
].sort((a, b) => b.length - a.length);

function normalizeDishKey(value = '') {
  return String(value)
    .normalize('NFC')
    .trim()
    .replace(/[.,;:!?()\[\]{}"'`_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('vi');
}

function getDishFamily(name = '') {
  const normalized = String(name).normalize('NFC').trim().replace(/\s+/g, ' ');
  const lowerName = normalizeDishKey(normalized);
  const family = DISH_FAMILIES.find((item) => {
    const lowerFamily = normalizeDishKey(item);
    return lowerName === lowerFamily || lowerName.startsWith(`${lowerFamily} `);
  });
  return family || normalized;
}

function matchesSearch(dish, needle) {
  return [dish.name, dish.description, ...(dish.categories || []).map((category) => category.name), ...(dish.recipes || []).map((recipe) => recipe.title)]
    .some((value) => String(value || '').toLocaleLowerCase('vi').includes(needle));
}

// Duy's Code : Trình bày theo nhóm món chung > từng món cụ thể > công thức đã duyệt.
export default function AdminDishManagementPage() {
  const { user, logout } = useAuth();
  const [dishes, setDishes] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedFamily, setExpandedFamily] = useState({});
  const [expandedDish, setExpandedDish] = useState({});
  const [expandedRecipe, setExpandedRecipe] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setDishes(await getAdminDishes()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('vi');
    const filtered = needle ? dishes.filter((dish) => matchesSearch(dish, needle)) : dishes;
    const byFamily = new Map();
    filtered.forEach((dish) => {
      const family = getDishFamily(dish.name);
      if (!byFamily.has(family)) byFamily.set(family, []);
      byFamily.get(family).push(dish);
    });
    return [...byFamily.entries()]
      .map(([name, items]) => {
        // Duplicate rows with the same normalized name are displayed once; all their
        // recipes and categories remain reachable from that one variant.
        const byDishName = new Map();
        items.forEach((dish) => {
          const key = normalizeDishKey(dish.name);
          const existing = byDishName.get(key);
          if (!existing) {
            byDishName.set(key, {
              ...dish,
              displayKey: `${name}:${key}`,
              categories: [...(dish.categories || [])],
              recipes: [...(dish.recipes || [])],
            });
            return;
          }

          const categories = new Map(existing.categories.map((category) => [normalizeDishKey(category.name), category]));
          (dish.categories || []).forEach((category) => {
            const categoryKey = normalizeDishKey(category.name);
            if (!categories.has(categoryKey)) categories.set(categoryKey, category);
          });
          existing.categories = [...categories.values()];

          const recipes = new Map(existing.recipes.map((recipe, index) => [recipe.id || `${normalizeDishKey(recipe.title)}:${recipe.createdAt || index}`, recipe]));
          (dish.recipes || []).forEach((recipe, index) => {
            const recipeKey = recipe.id || `${normalizeDishKey(recipe.title)}:${recipe.createdAt || index}`;
            if (!recipes.has(recipeKey)) recipes.set(recipeKey, recipe);
          });
          existing.recipes = [...recipes.values()];
          if (!existing.description && dish.description) existing.description = dish.description;
        });
        return { name, dishes: [...byDishName.values()] };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [dishes, query]);

  return (
    <AdminLayout activeKey="dish-management" title="Quản lý món ăn" user={user} onLogout={() => { logout(); window.location.assign('/'); }}>
      <div className={styles.page}>
        <PageHeader
          title="Quản lý món ăn"
          description="Các món được gom theo danh mục chung. Chọn một nhóm để xem từng món và công thức đã duyệt."
          actions={<Button variant="outline" icon="arrow-clockwise" onClick={load} disabled={loading}>Tải lại</Button>}
        />
        {error && <Notice tone="alert" title="Không tải được danh mục món ăn" action={{ label: 'Thử lại', onClick: load }}>{error}</Notice>}
        <div className={styles.toolbar}>
          <SearchInput value={query} onChange={setQuery} placeholder="Tìm danh mục hoặc công thức" label="Tìm món ăn" />
          <span>{groups.length} nhóm · {groups.reduce((total, group) => total + group.dishes.length, 0)} món</span>
        </div>

        <div className={styles.list}>
          {loading ? <div className="py-5 text-center"><Spinner label="Đang tải danh mục món ăn…" showLabel /></div>
            : groups.length === 0 ? <EmptyState icon="egg-fried" title={query ? 'Không tìm thấy món phù hợp' : 'Chưa có danh mục món ăn'} description={query ? 'Thử từ khóa khác.' : 'Tạo danh mục chung như Bánh Mì, Cơm, Cháo hoặc Chè để nhóm các công thức.'} />
              : groups.map((group) => {
                const familyOpen = Boolean(expandedFamily[group.name]);
                const recipeCount = group.dishes.reduce((total, dish) => total + (dish.recipes || []).length, 0);
                return (
                  <Panel key={group.name} className={styles.family}>
                    <button type="button" className={styles.familyHeader} aria-expanded={familyOpen} onClick={() => setExpandedFamily((current) => ({ ...current, [group.name]: !current[group.name] }))}>
                      <span className={styles.familyIcon}><i className="bi bi-collection" aria-hidden="true" /></span>
                      <span className={styles.familyTitle}>{group.name}</span>
                      <span className={styles.familyCount}>{group.dishes.length} món · {recipeCount} công thức</span>
                      <i className={`bi bi-chevron-${familyOpen ? 'up' : 'down'} ${styles.chevron}`} aria-hidden="true" />
                    </button>
                    {familyOpen && <div className={styles.variants}>
                      {group.dishes.map((dish) => {
                        const dishOpen = Boolean(expandedDish[dish.displayKey]);
                        const recipes = dish.recipes || [];
                        return <section className={styles.variant} key={dish.displayKey}>
                          <button type="button" className={styles.variantHeader} aria-expanded={dishOpen} onClick={() => setExpandedDish((current) => ({ ...current, [dish.displayKey]: !current[dish.displayKey] }))}>
                            <span className={styles.variantText}>
                              <span className={styles.variantTitle}>{dish.name}</span>
                              {dish.description && <span className={styles.description}>{dish.description}</span>}
                              <span className={styles.categories}>{(dish.categories || []).map((category) => <span key={category.id}>{category.name}</span>)}</span>
                            </span>
                            <span className={styles.recipeCount}>{recipes.length} công thức</span>
                            <i className={`bi bi-chevron-${dishOpen ? 'up' : 'down'} ${styles.chevron}`} aria-hidden="true" />
                          </button>
                          {dishOpen && <div className={styles.recipeList}>
                            {recipes.length === 0 ? <p className={styles.noRecipes}>Chưa có công thức nào được duyệt trong món này.</p>
                              : recipes.map((recipe) => {
                                const recipeOpen = Boolean(expandedRecipe[recipe.id]);
                                return <article className={styles.recipe} key={recipe.id}>
                                  <div className={styles.recipeSummary}>
                                    <Photo src={recipe.thumbnailUrl} alt={`Ảnh ${recipe.title}`} ratio="1/1" className={styles.recipeImage} />
                                    <div className={styles.recipeInfo}>
                                      <h3>{recipe.title}</h3>
                                      <p>{[recipe.servings && `${recipe.servings} khẩu phần`, recipe.cookTimeMinutes != null && `${recipe.cookTimeMinutes} phút`, formatDate(recipe.createdAt)].filter(Boolean).join(' · ')}</p>
                                    </div>
                                    <Button size="sm" variant="outline" icon={recipeOpen ? 'chevron-up' : 'eye'} onClick={() => setExpandedRecipe((current) => ({ ...current, [recipe.id]: !current[recipe.id] }))}>{recipeOpen ? 'Thu gọn' : 'Xem công thức'}</Button>
                                  </div>
                                  {recipeOpen && <div className={styles.recipeDetails}>
                                    <div><h4>Nguyên liệu</h4><ul>{(recipe.ingredients || []).map((ingredient, index) => <li key={`${ingredient.name}-${index}`}>{ingredient.name}{ingredient.amount ? ` · ${ingredient.amount}` : ''}{ingredient.unit ? ` ${ingredient.unit}` : ''}</li>)}</ul></div>
                                    <div><h4>Cách làm</h4><p>{recipe.instructions || 'Chưa có hướng dẫn.'}</p></div>
                                  </div>}
                                </article>;
                              })}
                          </div>}
                        </section>;
                      })}
                    </div>}
                  </Panel>
                );
              })}
        </div>
      </div>
    </AdminLayout>
  );
}
