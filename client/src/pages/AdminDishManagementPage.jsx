import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLayout, Button, EmptyState, ErrorDialog, PageHeader, Panel, Photo, SearchInput, Spinner } from '../components';
import useAuth from '../hooks/useAuth';
import { getAdminDishes } from '../services/dish.service';
import styles from './AdminDishManagementPage.module.css';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date);
};

const searchText = (value) => String(value || '').trim().toLocaleLowerCase('vi');

function dishMatchesSearch(dish, query) {
  if (!query) return true;
  const values = [
    dish.name,
    dish.description,
    ...(dish.categories || []).map((category) => category.name),
    ...(dish.recipes || []).flatMap((recipe) => [recipe.title, recipe.instructions, ...(recipe.ingredients || []).map((ingredient) => ingredient.name)]),
  ];
  return values.some((value) => searchText(value).includes(query));
}

// Mỗi bản ghi Dish trong DB là một món riêng; Recipe được tải từ quan hệ recipe.dish_id.
export default function AdminDishManagementPage() {
  const { user, logout } = useAuth();
  const [dishes, setDishes] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedDishes, setExpandedDishes] = useState({});
  const [expandedRecipes, setExpandedRecipes] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDishes(await getAdminDishes());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visibleDishes = useMemo(() => {
    const needle = searchText(query);
    return dishes.filter((dish) => dishMatchesSearch(dish, needle));
  }, [dishes, query]);

  const totalRecipes = visibleDishes.reduce((total, dish) => total + (dish.recipes || []).length, 0);

  return (
    <AdminLayout activeKey="dish-management" title="Quản lý món ăn" user={user} onLogout={() => { logout(); window.location.assign('/'); }}>
      <div className={styles.page}>
        <PageHeader
          title="Quản lý món ăn"
          description="Mỗi món là một Dish trong cơ sở dữ liệu. Các công thức đã duyệt được quản lý bên trong món; danh mục chỉ dùng để phân loại món."
          actions={(
            <>
              <Button variant="outline" icon="arrow-clockwise" onClick={load} disabled={loading}>Tải lại</Button>
              <Button icon="plus-circle" onClick={() => window.location.assign('/admin/dishes/create')}>Tạo món</Button>
            </>
          )}
        />

        <ErrorDialog error={error} title="Không tải được danh sách món ăn" onRetry={load} />

        <div className={styles.toolbar}>
          <SearchInput value={query} onChange={setQuery} placeholder="Tìm món, danh mục hoặc công thức" label="Tìm món ăn" />
          <span>{visibleDishes.length} món · {totalRecipes} công thức đã duyệt</span>
        </div>

        <div className={styles.list}>
          {loading ? <div className="py-5 text-center"><Spinner label="Đang tải món ăn…" showLabel /></div>
            : visibleDishes.length === 0 ? <EmptyState
              icon="egg-fried"
              title={query ? 'Không tìm thấy món phù hợp' : 'Chưa có món ăn'}
              description={query ? 'Thử từ khóa khác.' : 'Tạo một Dish để lưu các công thức và phân loại món.'}
            />
              : visibleDishes.map((dish) => {
                const recipes = dish.recipes || [];
                const dishOpen = Boolean(expandedDishes[dish.id]);
                return (
                  <Panel className={styles.dish} key={dish.id}>
                    <button
                      type="button"
                      className={styles.dishHeader}
                      aria-expanded={dishOpen}
                      onClick={() => setExpandedDishes((current) => ({ ...current, [dish.id]: !current[dish.id] }))}
                    >
                      <span className={styles.dishIcon}><i className="bi bi-egg-fried" aria-hidden="true" /></span>
                      <span className={styles.dishText}>
                        <span className={styles.dishTitle}>{dish.name}</span>
                        {dish.description && <span className={styles.description}>{dish.description}</span>}
                        <span className={styles.categories}>
                          {(dish.categories || []).length
                            ? dish.categories.map((category) => <span key={category.id}>{category.name}</span>)
                            : <span className={styles.noCategory}>Chưa gắn danh mục</span>}
                        </span>
                      </span>
                      <span className={styles.recipeCount}>{recipes.length} công thức</span>
                      <i className={`bi bi-chevron-${dishOpen ? 'up' : 'down'} ${styles.chevron}`} aria-hidden="true" />
                    </button>

                    {dishOpen && <div className={styles.recipeList}>
                      {recipes.length === 0 ? <p className={styles.noRecipes}>Dish này chưa có công thức nào được duyệt.</p>
                        : recipes.map((recipe) => {
                          const recipeOpen = Boolean(expandedRecipes[recipe.id]);
                          return (
                            <article className={styles.recipe} key={recipe.id}>
                              <div className={styles.recipeSummary}>
                                <Photo src={recipe.thumbnailUrl} alt={`Ảnh ${recipe.title}`} ratio="1/1" className={styles.recipeImage} />
                                <div className={styles.recipeInfo}>
                                  <h3>{recipe.title}</h3>
                                  <p>{[
                                    recipe.servings && `${recipe.servings} khẩu phần`,
                                    recipe.cookTimeMinutes != null && `${recipe.cookTimeMinutes} phút`,
                                    formatDate(recipe.createdAt),
                                  ].filter(Boolean).join(' · ')}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  icon={recipeOpen ? 'chevron-up' : 'eye'}
                                  onClick={() => setExpandedRecipes((current) => ({ ...current, [recipe.id]: !current[recipe.id] }))}
                                >{recipeOpen ? 'Thu gọn' : 'Xem công thức'}</Button>
                              </div>
                              {recipeOpen && <div className={styles.recipeDetails}>
                                <div>
                                  <h4>Nguyên liệu</h4>
                                  {(recipe.ingredients || []).length
                                    ? <ul>{recipe.ingredients.map((ingredient, index) => <li key={`${ingredient.name}-${index}`}>
                                      {ingredient.name}{ingredient.amount ? ` · ${ingredient.amount}` : ''}{ingredient.unit ? ` ${ingredient.unit}` : ''}
                                    </li>)}</ul>
                                    : <p>Chưa có nguyên liệu.</p>}
                                </div>
                                <div><h4>Cách làm</h4><p>{recipe.instructions || 'Chưa có hướng dẫn.'}</p></div>
                              </div>}
                            </article>
                          );
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
