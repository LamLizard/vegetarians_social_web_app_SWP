import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLayout, Button, ConfirmDialog, EmptyState, ErrorDialog, Notice, PageHeader, Panel, Photo, Spinner, StatusBadge } from '../components';
import useAuth from '../hooks/useAuth';
import recipeService from '../services/recipe.service';
import YouTubeEmbed from '../components/YouTubeEmbed/YouTubeEmbed'; // Khoi's code: xem video người dùng gửi kèm
import styles from './AdminRecipeVerifyPage.module.css';

// Khoi's code: chỉ số dinh dưỡng tuỳ chọn (1 người) người dùng nhập ở form Tạo công thức
const NUTRITION_FACTS = [
  ['caloriesKcal', 'Calo', 'kcal'], ['proteinG', 'Đạm', 'g'], ['carbG', 'Tinh bột', 'g'], ['fatG', 'Chất béo', 'g'],
  ['fiberG', 'Chất xơ', 'g'], ['sugarG', 'Đường', 'g'], ['sodiumMg', 'Natri', 'mg'],
];

const STATUS_TABS = [
  { key: 'pending', label: 'Đang chờ', icon: 'hourglass-split' },
  { key: 'approved', label: 'Đã duyệt', icon: 'check-circle' },
  { key: 'rejected', label: 'Bị từ chối', icon: 'x-circle' },
];

// Duy's Code : Gom hàng chờ và lịch sử công thức; phần chi tiết chỉ mở khi Admin yêu cầu.
export default function AdminRecipeVerifyPage() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [dishSearch, setDishSearch] = useState({});
  const [dishMatches, setDishMatches] = useState({});
  const [dishBusy, setDishBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let recipes = await recipeService.getAdminRecipes();
      const params = new URLSearchParams(window.location.search);
      const createdDishId = params.get('createdDishId');
      const returnRecipeId = params.get('returnRecipeId');
      const dishName = params.get('dishName');
      if (createdDishId && returnRecipeId) {
        const linked = await recipeService.linkRecipeDish(returnRecipeId, createdDishId);
        recipes = recipes.map((item) => String(item.id) === String(returnRecipeId)
          ? { ...item, dishId: createdDishId, dishName: linked.dishName || dishName, proposedDishName: null }
          : item);
        window.history.replaceState(null, '', '/admin/recipes/verify');
      }
      setItems(recipes);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => Object.fromEntries(STATUS_TABS.map(({ key }) => [key, items.filter((item) => item.status === key).length])), [items]);
  const visible = useMemo(() => items.filter((item) => item.status === status), [items, status]);

  const decide = async (note) => {
    if (!decision) return;
    setSaving(true);
    setError('');
    try {
      await recipeService.decideAdminRecipe(decision.id, decision.action, note);
      await load();
      setDecision(null);
      // Duy's Code: Sau khi duyệt, ở lại danh sách Đang chờ để tiếp tục xử lý.
      if (decision.action === 'reject') setStatus('rejected');
    } catch (e) { setError(e.message); setDecision(null); }
    finally { setSaving(false); }
  };

  const findDishes = async (item) => {
    const query = (dishSearch[item.id] ?? item.proposedDishName ?? '').trim();
    if (!query) return;
    setDishBusy(item.id);
    setError('');
    try {
      const found = await recipeService.searchAdminDishes(query);
      setDishMatches((current) => ({ ...current, [item.id]: found }));
    }
    catch (e) { setError(e.message); }
    finally { setDishBusy(''); }
  };

  const renameDish = async (item) => {
    const name = (dishSearch[item.id] ?? item.proposedDishName ?? '').trim();
    if (!name) return;
    setDishBusy(item.id);
    try {
      const renamed = await recipeService.renameRecipeDish(item.id, name);
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, proposedDishName: renamed.name } : row));
    } catch (e) { setError(e.message); }
    finally { setDishBusy(''); }
  };

  const linkDish = async (item, dish) => {
    setDishBusy(item.id);
    try {
      const linked = await recipeService.linkRecipeDish(item.id, dish.id);
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, dishId: linked.dishId, dishName: linked.dishName, proposedDishName: null } : row));
    } catch (e) { setError(e.message); }
    finally { setDishBusy(''); }
  };

  const handleLogout = () => { logout(); window.location.assign('/'); };

  return (
    <AdminLayout activeKey="recipe-verify" title="Duyệt công thức" user={user} onLogout={handleLogout}>
      <div className={styles.page}>
        <PageHeader
          title="Duyệt công thức"
          description="Theo dõi công thức thành viên gửi và lịch sử đã duyệt hoặc từ chối."
          actions={<Button variant="outline" icon="arrow-clockwise" onClick={load} disabled={loading}>Tải lại</Button>}
        />
        <div className={styles.tabs} role="tablist" aria-label="Trạng thái công thức">
          {STATUS_TABS.map((tab) => (
            <button key={tab.key} type="button" role="tab" aria-selected={status === tab.key} className={status === tab.key ? styles.activeTab : ''} onClick={() => setStatus(tab.key)}>
              <i className={`bi bi-${tab.icon}`} aria-hidden="true" />{tab.label}<span>{counts[tab.key] || 0}</span>
            </button>
          ))}
        </div>

        <div className={styles.list}>
          {loading ? <div className="py-5 text-center"><Spinner label="Đang tải công thức…" showLabel /></div>
            : visible.length === 0 ? <EmptyState icon={status === 'approved' ? 'check-circle' : status === 'rejected' ? 'x-circle' : 'journal-check'} title={status === 'pending' ? 'Không có công thức đang chờ' : status === 'approved' ? 'Chưa có công thức đã duyệt' : 'Chưa có công thức bị từ chối'} description="Các công thức theo trạng thái này sẽ hiển thị tại đây." />
              : visible.map((item) => {
                const isExpanded = !!expanded[item.id];
                const matches = dishMatches[item.id] || [];
                const searchValue = dishSearch[item.id] ?? item.proposedDishName ?? '';
                return (
                  <Panel key={item.id} className={styles.card}>
                    <article className={styles.summary}>
                      <Photo src={item.thumbnailUrl} alt={`Ảnh công thức ${item.title}`} ratio="4/3" className={styles.image} />
                      <div className={styles.main}>
                        <div className={styles.heading}>
                          <h2>{item.title}</h2>
                          <StatusBadge entity="recipe" status={item.status} size="sm" />
                          <Button size="sm" variant="outline" icon={isExpanded ? 'chevron-up' : 'eye'} onClick={() => setExpanded((current) => ({ ...current, [item.id]: !current[item.id] }))}>
                            {isExpanded ? 'Thu gọn' : 'Xem toàn bộ'}
                          </Button>
                        </div>
                        <p className={styles.meta}>Danh mục món: <b>{item.dishName || item.proposedDishName || 'Chưa liên kết'}</b></p>
                        <p className={styles.meta}>Gửi bởi {item.authorName || item.authorEmail || 'Thành viên'} · {item.servings || '—'} khẩu phần · {item.cookTimeMinutes ?? '—'} phút</p>
                        {item.moderationNote && <Notice tone={item.status === 'rejected' ? 'alert' : 'success'}>{item.moderationNote}</Notice>}
                        {item.status === 'pending' && <div className={styles.actions}>
                          <Button variant="alert" icon="x-circle" onClick={() => setDecision({ id: item.id, title: item.title, action: 'reject' })}>Từ chối</Button>
                          <Button icon="check-circle" disabled={!item.dishId} title={!item.dishId ? 'Liên kết công thức với danh mục món trước khi duyệt' : undefined} onClick={() => setDecision({ id: item.id, title: item.title, action: 'approve' })}>Duyệt công thức</Button>
                        </div>}
                      </div>
                    </article>

                    {isExpanded && <section className={styles.details}>
                      {item.status === 'pending' && item.proposedDishName && <div className={styles.dishLink}>
                        <h3>Liên kết danh mục món</h3>
                        <div className={styles.searchRow}>
                          <input className="form-control" value={searchValue} aria-label="Tên danh mục món" onChange={(event) => { setDishSearch((current) => ({ ...current, [item.id]: event.target.value })); setDishMatches((current) => ({ ...current, [item.id]: [] })); }} />
                          <Button variant="outline" loading={dishBusy === item.id} onClick={() => findDishes(item)}>Tìm danh mục</Button>
                          <Button variant="outline" disabled={dishBusy === item.id} onClick={() => renameDish(item)}>Lưu tên đề xuất</Button>
                        </div>
                        {matches.length > 0 && <ul className={styles.matchList}>{matches.map((dish) => <li key={dish.id}>{dish.name}<Button size="sm" variant="outline" disabled={dishBusy === item.id} onClick={() => linkDish(item, dish)}>Dùng danh mục này</Button></li>)}</ul>}
                        {Object.hasOwn(dishMatches, item.id) && matches.length === 0 && <div className={styles.createPrompt}>Không tìm thấy danh mục phù hợp. <Button size="sm" onClick={() => window.location.assign(`/admin/dishes/create?returnRecipeId=${encodeURIComponent(item.id)}&suggestedName=${encodeURIComponent(searchValue)}`)}>Tạo danh mục món</Button></div>}
                      </div>}
                      <div className={styles.facts}>
                        {item.prepTimeMinutes != null && <span><b>Chuẩn bị</b>{item.prepTimeMinutes} phút</span>}
                        {item.cookTimeMinutes != null && <span><b>Nấu</b>{item.cookTimeMinutes} phút</span>}
                        {item.servings != null && <span><b>Khẩu phần</b>{item.servings}</span>}
                        {/* Khoi's code: dinh dưỡng (tuỳ chọn, 1 người) */}
                        {NUTRITION_FACTS.filter(([key]) => item[key] != null).map(([key, label, unit]) => (
                          <span key={key}><b>{label}</b>{Number(item[key]).toLocaleString('vi-VN')} {unit}</span>
                        ))}
                      </div>
                      {/* Khoi's code: mô tả + video người dùng gửi kèm — Admin phải xem được để kiểm tra nội dung */}
                      {item.description && <div className={styles.extra}><h3>Mô tả</h3><p className={styles.instructions}>{item.description}</p></div>}
                      {item.youtubeUrl && (
                        <div className={styles.extra}>
                          <h3>Video hướng dẫn</h3>
                          <div className={styles.video}><YouTubeEmbed url={item.youtubeUrl} title={`Video của công thức ${item.title}`} /></div>
                          <a className={styles.videoLink} href={item.youtubeUrl} target="_blank" rel="noopener noreferrer">
                            <i className="bi bi-box-arrow-up-right" aria-hidden="true" /> {item.youtubeUrl}
                          </a>
                        </div>
                      )}
                      <div className={styles.detailColumns}>
                        <div><h3>Nguyên liệu</h3><ul>{[...(item.ingredients || []), ...(item.proposedIngredients || [])].map((ingredient, index) => <li key={`${ingredient.name}-${index}`}>{ingredient.name}{ingredient.amount ? ` · ${ingredient.amount}` : ''}{ingredient.unit ? ` ${ingredient.unit}` : ''}</li>)}</ul></div>
                        <div><h3>Cách làm</h3><p className={styles.instructions}>{item.instructions || 'Chưa có hướng dẫn.'}</p></div>
                      </div>
                    </section>}
                  </Panel>
                );
              })}
        </div>
      </div>
      {/* Duy's Code: Hiện lỗi duyệt công thức ngay giữa màn hình. */}
      <ErrorDialog error={error} title="Không thể tải hoặc xử lý công thức" />
      <ConfirmDialog
        open={!!decision}
        title={decision?.action === 'reject' ? 'Từ chối công thức?' : 'Duyệt công thức?'}
        message={`Công thức “${decision?.title || ''}” sẽ ${decision?.action === 'reject' ? 'bị từ chối' : 'được công khai sau khi duyệt'}.`}
        confirmLabel={decision?.action === 'reject' ? 'Từ chối' : 'Duyệt công thức'}
        tone={decision?.action === 'reject' ? 'alert' : 'primary'}
        reason={decision?.action === 'reject' ? { label: 'Lý do từ chối', required: true } : undefined}
        loading={saving}
        onConfirm={decide}
        onCancel={() => setDecision(null)}
      />
    </AdminLayout>
  );
}
