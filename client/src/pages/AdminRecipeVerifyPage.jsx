import { useCallback, useEffect, useState } from 'react';
import { AdminLayout, Button, ConfirmDialog, EmptyState, Notice, PageHeader, Panel, Photo, Spinner } from '../components';
import useAuth from '../hooks/useAuth';
import recipeService from '../services/recipe.service';
import AnimalWarnings from '../components/AnimalWarnings/AnimalWarnings'; // Khoi's code

export default function AdminRecipeVerifyPage() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState(null);
  const [dishSearch, setDishSearch] = useState({});
  const [dishMatches, setDishMatches] = useState({});
  const [dishBusy, setDishBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      let pending = await recipeService.getPendingAdminRecipes();
      const params = new URLSearchParams(window.location.search);
      const createdDishId = params.get('createdDishId');
      const returnRecipeId = params.get('returnRecipeId');
      const dishName = params.get('dishName');
      const createdFromRecipe = params.get('createdFromRecipe') === '1';
      if (createdDishId && returnRecipeId) {
        const linked = await recipeService.linkRecipeDish(returnRecipeId, createdDishId, { createdFromRecipe });
        pending = pending.map((item) => item.id === returnRecipeId
          ? { ...item, dishId: createdDishId, dishName: linked.dishName || dishName, proposedDishName: null, dishCreated: true }
          : item);
        window.history.replaceState(null, '', '/admin/recipes/verify');
      }
      setItems(pending);
    }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (note) => {
    if (!decision) return;
    setSaving(true); setError('');
    try {
      await recipeService.decideAdminRecipe(decision.id, decision.action, note);
      setItems((current) => current.filter((item) => item.id !== decision.id));
      setDecision(null);
    } catch (e) { setError(e.message); setDecision(null); }
    finally { setSaving(false); }
  };
  const findDishes = async (item) => {
    const query = (dishSearch[item.id] ?? item.proposedDishName ?? '').trim();
    if (!query) return;
    setDishBusy(item.id); setError('');
    try {
      const matches = await recipeService.searchAdminDishes(query);
      setDishMatches((current) => ({ ...current, [item.id]: matches }));
    }
    catch (e) { setError(e.message); }
    finally { setDishBusy(''); }
  };
  const renameDish = async (item) => {
    const name = (dishSearch[item.id] ?? item.proposedDishName ?? '').trim();
    if (!name) return;
    setDishBusy(item.id); setError('');
    try {
      const renamed = await recipeService.renameRecipeDish(item.id, name);
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, proposedDishName: renamed.name } : row));
    } catch (e) { setError(e.message); }
    finally { setDishBusy(''); }
  };
  const linkDish = async (item, dish) => {
    setDishBusy(item.id); setError('');
    try {
      const linked = await recipeService.linkRecipeDish(item.id, dish.id);
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, dishId: linked.dishId, dishName: linked.dishName, proposedDishName: null } : row));
    } catch (e) { setError(e.message); }
    finally { setDishBusy(''); }
  };
  const handleLogout = () => { logout(); window.location.assign('/'); };

  return <AdminLayout activeKey="recipe-verify" title="Duyệt công thức" user={user} onLogout={handleLogout}>
    <PageHeader title="Duyệt công thức" description="Kiểm tra công thức, nguyên liệu và món được đề xuất trước khi công khai." actions={<Button variant="outline" icon="arrow-clockwise" onClick={load} disabled={loading}>Tải lại</Button>} />
    {error && <Notice tone="alert" title="Không thể tải hoặc xử lý công thức" className="mt-3">{error}</Notice>}
    <div className="d-grid gap-3 mt-3">
      {loading ? <div className="py-5 text-center"><Spinner label="Đang tải công thức chờ duyệt..." showLabel /></div>
        : items.length === 0 ? <EmptyState icon="journal-check" title="Không có công thức chờ duyệt" description="Công thức mới gửi sẽ xuất hiện tại đây." />
          : items.map((item) => <Panel key={item.id} className="p-3">
            <div className="row g-3">
              <div className="col-12 col-md-4"><Photo src={item.thumbnailUrl} alt={`Ảnh công thức ${item.title}`} ratio="4/3" /></div>
              <div className="col-12 col-md-8">
                <h2 className="h5">{item.title}</h2>
                <AnimalWarnings warnings={item.animalWarnings} className="mb-3" />
                <p className="text-body-secondary mb-2">Món: <b>{item.proposedDishName || item.dishName || 'Chưa xác định'}</b> · Gửi bởi {item.authorName || item.authorEmail}</p>
                {item.proposedDishName ? <div className="border rounded p-3 mb-3">
                  <h3 className="h6">Đối chiếu món được đề xuất</h3>
                  <div className="d-flex flex-wrap gap-2"><input className="form-control flex-grow-1" style={{ minWidth: 180 }} aria-label="Tên món cần đối chiếu" value={dishSearch[item.id] ?? item.proposedDishName} onChange={(event) => { setDishSearch((current) => ({ ...current, [item.id]: event.target.value })); setDishMatches((current) => { const next = { ...current }; delete next[item.id]; return next; }); }} />
                    <Button variant="outline" onClick={() => findDishes(item)} loading={dishBusy === item.id}>Tìm món có sẵn</Button>
                    <Button variant="outline" onClick={() => renameDish(item)} disabled={dishBusy === item.id}>Lưu tên</Button>
                    <Button disabled={!Object.hasOwn(dishMatches, item.id) || dishMatches[item.id].length > 0 || dishBusy === item.id} onClick={() => { window.location.assign(`/admin/dishes/create?returnRecipeId=${encodeURIComponent(item.id)}&suggestedName=${encodeURIComponent(dishSearch[item.id] ?? item.proposedDishName)}`); }}>Tạo Dish</Button>
                  </div>
                  {(dishMatches[item.id] || []).length > 0 && <ul className="mt-2 mb-0">{dishMatches[item.id].map((dish) => <li key={dish.id} className="mb-1">{dish.name} <Button size="sm" variant="outline" disabled={dishBusy === item.id} onClick={() => linkDish(item, dish)}>Dùng món này</Button></li>)}</ul>}
                  {dishMatches[item.id]?.length === 0 && <p className="small text-body-secondary mt-2 mb-0">Không tìm thấy món phù hợp. Có thể tạo Dish mới.</p>}
                  {item.dishCreated && <Notice tone="success" className="mt-2">Dish “{item.dishName}” đã được tạo và liên kết với yêu cầu Recipe này.</Notice>}
                </div> : <Notice tone="success" className="mb-3">{item.dishCreated ? `Dish “${item.dishName}” đã được tạo, lưu vào Database và liên kết với Recipe này.` : `Recipe đã chọn Dish có sẵn: ${item.dishName}`}</Notice>}
                <p className="small mb-2">{item.servings ? `${item.servings} phần ăn · ` : ''}{item.prepTimeMinutes ? `${item.prepTimeMinutes} phút sơ chế · ` : ''}{item.cookTimeMinutes ? `${item.cookTimeMinutes} phút nấu` : ''}</p>
                <h3 className="h6">Nguyên liệu</h3>
                <ul>{[...(item.ingredients || []), ...(item.proposedIngredients || [])].map((ing, i) => <li key={`${ing.name}-${i}`}>{ing.name}{ing.amount ? ` — ${ing.amount}` : ''}{ing.unit ? ` ${ing.unit}` : ''}{item.proposedIngredients?.includes(ing) ? ' (nguyên liệu mới)' : ''}</li>)}</ul>
                <h3 className="h6">Cách làm</h3><p style={{ whiteSpace: 'pre-wrap' }}>{item.instructions}</p>
                <div className="d-flex flex-wrap gap-2"><Button variant="alert" icon="x-circle" onClick={() => setDecision({ id: item.id, title: item.title, action: 'reject' })}>Từ chối</Button><Button icon="check-circle" disabled={!item.dishId} title={!item.dishId ? 'Hãy liên kết Recipe với một Dish trước' : undefined} onClick={() => setDecision({ id: item.id, title: item.title, action: 'approve' })}>Duyệt công thức</Button></div>
              </div>
            </div>
          </Panel>)}
    </div>
    <ConfirmDialog open={!!decision} title={decision?.action === 'reject' ? 'Từ chối công thức?' : 'Duyệt công thức?'} message={`Công thức “${decision?.title || ''}” sẽ ${decision?.action === 'reject' ? 'bị từ chối' : 'được công khai sau khi duyệt'}.`} confirmLabel={decision?.action === 'reject' ? 'Từ chối' : 'Duyệt công thức'} tone={decision?.action === 'reject' ? 'alert' : 'primary'} reason={decision?.action === 'reject' ? { label: 'Lý do từ chối', required: true } : undefined} loading={saving} onConfirm={decide} onCancel={() => setDecision(null)} />
  </AdminLayout>;
}
