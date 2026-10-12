import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLayout, Button, EmptyState, Notice, PageHeader, Panel, Photo, SearchInput, Spinner, StatusBadge, Tabs } from '../components';
import useAuth from '../hooks/useAuth';
import { getAdminDishes } from '../services/dish.service';
import styles from './AdminDishManagementPage.module.css';

const formatDate = (value) => {
  if (!value) return 'Không rõ thời gian';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Không rõ thời gian' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export default function AdminDishManagementPage() {
  const { user, logout } = useAuth();
  const [dishes, setDishes] = useState([]);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedItems, setExpandedItems] = useState({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setDishes(await getAdminDishes()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    all: dishes.length,
    active: dishes.filter((dish) => dish.status === 'active' || dish.status === 'approved').length,
    pending: dishes.filter((dish) => dish.status === 'pending').length,
    rejected: dishes.filter((dish) => dish.status === 'rejected').length,
  }), [dishes]);
  const visible = useMemo(() => dishes.filter((dish) => {
    const matchesStatus = status === 'all'
      || (status === 'active' && (dish.status === 'active' || dish.status === 'approved'))
      || dish.status === status;
    const needle = query.trim().toLocaleLowerCase('vi');
    const matchesQuery = !needle || [dish.name, dish.recipeTitle, dish.description, dish.creatorName, dish.creatorEmail, dish.reviewerName, dish.reviewerEmail, ...(dish.categories || []).map((category) => category.name)]
      .some((value) => String(value || '').toLocaleLowerCase('vi').includes(needle));
    return matchesStatus && matchesQuery;
  }), [dishes, status, query]);
  const handleLogout = () => { logout(); window.location.assign('/'); };

  return <AdminLayout activeKey="dish-management" title="Quản lý món ăn" user={user} onLogout={handleLogout}>
    <div className={styles.page}>
      <PageHeader title="Quản lý món ăn" description="Tra cứu Dish và lịch sử Recipe, gồm các yêu cầu đã duyệt, đang chờ hoặc bị từ chối; xem người tạo và Admin xử lý." actions={<Button variant="outline" icon="arrow-clockwise" onClick={load} disabled={loading}>Tải lại</Button>} />
      {error && <Notice tone="alert" title="Không tải được danh sách món ăn" action={{ label: 'Thử lại', onClick: load }}>{error}</Notice>}
      <Tabs label="Lọc món ăn theo trạng thái" value={status} onChange={setStatus} items={[
        { key: 'all', label: 'Tất cả', icon: 'egg-fried', count: counts.all },
        { key: 'active', label: 'Đã duyệt', icon: 'check-circle', count: counts.active },
        { key: 'pending', label: 'Đang chờ', icon: 'hourglass-split', count: counts.pending },
        { key: 'rejected', label: 'Bị từ chối', icon: 'x-circle', count: counts.rejected },
      ]} />
      <div className={styles.search}><SearchInput value={query} onChange={setQuery} placeholder="Tìm tên món, mô tả, người tạo hoặc danh mục" label="Tìm món ăn" /></div>
      <div className={styles.list}>
        {loading ? <div className="py-5 text-center"><Spinner label="Đang tải danh sách món ăn…" showLabel /></div>
          : visible.length === 0 ? <EmptyState icon="egg-fried" title={query ? 'Không tìm thấy món phù hợp' : 'Chưa có món ăn trong trạng thái này'} description={query ? 'Thử từ khóa khác hoặc chọn trạng thái khác.' : 'Các món được tạo và các đề xuất cũ sẽ được lưu tại đây.'} />
            : visible.map((dish) => {
              const itemKey = `${dish.recordType}:${dish.id}`;
              const isExpanded = !!expandedItems[itemKey];
              const ingredients = dish.ingredients || [];
              return <Panel key={itemKey} className={styles.card}>
              <article className={styles.item}>
                <Photo src={dish.thumbnailUrl} alt={`Ảnh món ${dish.name}`} ratio="4/3" className={styles.image} />
                <div className={styles.body}>
                <div className={styles.titleRow}><h2>{dish.name}</h2><StatusBadge entity={dish.recordType === 'recipe' ? 'recipe' : 'dish'} status={dish.status} size="sm" />{dish.recordType === 'recipe' && <span className={styles.recordType}>Recipe</span>}<button type="button" className={styles.moreButton} aria-expanded={isExpanded} aria-controls={`dish-details-${itemKey}`} onClick={() => setExpandedItems((current) => ({ ...current, [itemKey]: !current[itemKey] }))}>{isExpanded ? 'Thu gọn' : 'Xem thêm'}</button></div>
                {dish.recipeTitle && <p className={styles.recipeTitle}>Công thức: <b>{dish.recipeTitle}</b></p>}
                <p className={`${styles.description} ${dish.recordType === 'recipe' ? styles.clamp : ''}`}>{dish.description || 'Chưa có mô tả.'}</p>
                {!!dish.categories?.length && <div className={styles.categories}>{dish.categories.map((category) => <span key={category.id}>{category.name}</span>)}</div>}
                <div className={styles.people}>
                  <div><b>Người tạo</b><span>{dish.creatorName || 'Không rõ'}</span>{dish.creatorEmail && <small>{dish.creatorEmail}</small>}</div>
                  <div><b>Người duyệt</b><span>{dish.reviewerName || (dish.status === 'pending' ? 'Chưa được duyệt' : 'Không qua bước duyệt (Admin tạo trực tiếp)')}</span>{dish.reviewerEmail && <small>{dish.reviewerEmail}</small>}</div>
                  <time dateTime={dish.moderatedAt || dish.createdAt}>{dish.moderatedAt ? 'Duyệt lúc' : 'Tạo lúc'} {formatDate(dish.moderatedAt || dish.createdAt)}</time>
                </div>
                {dish.moderationNote && <Notice tone="alert" title="Lý do từ chối" className={styles.note}>{dish.moderationNote}</Notice>}
                </div>
              </article>
              {isExpanded && <section className={styles.details} id={`dish-details-${itemKey}`} aria-label={`Chi tiết ${dish.name}`}>
                <h3>{dish.recordType === 'recipe' || dish.recipeTitle ? 'Chi tiết công thức người dùng gửi' : 'Chi tiết món ăn'}</h3>
                {(dish.recordType === 'recipe' || dish.recipeTitle) ? <>
                  {dish.recipeTitle && <p><b>Tên công thức:</b> {dish.recipeTitle}</p>}
                  {dish.proposedDishName && <p><b>Dish đề xuất:</b> {dish.proposedDishName}</p>}
                  <div className={styles.facts}>
                    {dish.servings != null && <span><b>Khẩu phần:</b> {dish.servings}</span>}
                    {dish.prepTimeMinutes != null && <span><b>Thời gian chuẩn bị:</b> {dish.prepTimeMinutes} phút</span>}
                    {dish.cookTimeMinutes != null && <span><b>Thời gian nấu:</b> {dish.cookTimeMinutes} phút</span>}
                  </div>
                  <div className={styles.detailColumns}>
                    <div><h4>Nguyên liệu ({ingredients.length})</h4>{ingredients.length ? <ul>{ingredients.map((ingredient, index) => <li key={`${ingredient.name}-${index}`}>{ingredient.name}{ingredient.amount ? ` · ${ingredient.amount}` : ''}{ingredient.unit ? ` ${ingredient.unit}` : ''}</li>)}</ul> : <p>Không có thông tin nguyên liệu.</p>}</div>
                    {dish.proposedIngredients?.length > 0 && <div><h4>Nguyên liệu cần Admin kiểm tra</h4><ul>{dish.proposedIngredients.map((ingredient, index) => <li key={`${ingredient.name}-${index}`}>{ingredient.name}{ingredient.amount ? ` · ${ingredient.amount}` : ''}{ingredient.unit ? ` ${ingredient.unit}` : ''}</li>)}</ul></div>}
                  </div>
                  <div><h4>Cách làm</h4><p className={styles.instructions}>{dish.instructions || 'Không có hướng dẫn.'}</p></div>
                </> : <>
                  <p><b>Mô tả:</b> {dish.description || 'Chưa có mô tả.'}</p>
                  <p><b>Danh mục:</b> {dish.categories?.length ? dish.categories.map((category) => category.name).join(', ') : 'Chưa gán danh mục.'}</p>
                  {dish.moderationNote && <p><b>Lý do xử lý:</b> {dish.moderationNote}</p>}
                  <p><b>Mã Dish:</b> {dish.id}</p>
                </>}
                <p className={styles.detailMeta}><b>Mã bản ghi:</b> {dish.recordType === 'recipe' ? `Recipe #${dish.id}` : `Dish #${dish.id}`}{dish.dishId && dish.recordType === 'recipe' ? ` · Dish #${dish.dishId}` : ''}</p>
              </section>}
            </Panel>})}
      </div>
    </div>
  </AdminLayout>;
}
