import { useEffect, useState } from 'react';
import { AdminLayout, Button, CategoryPicker, Notice, PageHeader, TextArea, TextField } from '../components';
import useAuth from '../hooks/useAuth';
import { createAdminDish, getDishCategories, searchAdminDishes } from '../services/dish.service';

const EMPTY_FORM = { name: '', description: '', categoryIds: [] };

// Duy's Code : Tạo danh mục món chung; công thức và biến thể món được quản lý riêng.
export default function AdminDishCreatePage() {
  const { user, logout } = useAuth();
  const returnRecipeId = new URLSearchParams(window.location.search).get('returnRecipeId');
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, name: new URLSearchParams(window.location.search).get('suggestedName') || '' }));
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getDishCategories()
      .then((items) => { if (active) setCategories(items.map((item) => ({ value: item.id, label: item.name }))); })
      .catch((e) => { if (active) setCategoriesError(e.message); })
      .finally(() => { if (active) setLoadingCategories(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const query = form.name.trim();
    if (!query) { setMatches([]); setSearching(false); return undefined; }
    let active = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchAdminDishes(query)
        .then((items) => { if (active) setMatches(items); })
        .catch(() => { if (active) setMatches([]); })
        .finally(() => { if (active) setSearching(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [form.name]);

  const exactMatch = matches.find((item) => item.name.trim().toLocaleLowerCase('vi') === form.name.trim().toLocaleLowerCase('vi'));
  const update = (field) => (value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
    setSuccess('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Nhập tên danh mục món ăn.');
    if (exactMatch) return setError(`Danh mục “${exactMatch.name}” đã tồn tại.`);
    if (!form.categoryIds.length) return setError('Chọn ít nhất một danh mục.');
    setSaving(true);
    try {
      const created = await createAdminDish({ ...form, name: form.name.trim(), description: form.description.trim() });
      if (returnRecipeId) {
        window.location.assign(`/admin/recipes/verify?createdDishId=${encodeURIComponent(created.id)}&returnRecipeId=${encodeURIComponent(returnRecipeId)}&dishName=${encodeURIComponent(created.name)}`);
        return;
      }
      setForm(EMPTY_FORM);
      setMatches([]);
      setSuccess(`Đã tạo danh mục món “${created.name}”.`);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <AdminLayout activeKey="dish-create" title="Tạo danh mục món ăn" user={user} onLogout={() => { logout(); window.location.assign('/'); }}>
      <PageHeader
        breadcrumb={[{ label: 'Quản lý món ăn', href: '/admin/dishes' }, { label: 'Tạo danh mục món ăn' }]}
        title="Tạo danh mục món ăn"
        description="Tạo tên món chung như Bánh Mì, Cơm, Cháo hoặc Chè. Công thức và biến thể cụ thể sẽ được liên kết riêng."
      />
      {error && <Notice tone="alert" title="Chưa thể tạo danh mục" className="mt-3">{error}</Notice>}
      {success && <Notice tone="success" title="Đã tạo danh mục" className="mt-3">{success}</Notice>}
      {categoriesError && <Notice tone="alert" title="Không tải được danh mục" className="mt-3">{categoriesError}</Notice>}
      {/* Duy's Code : Mở rộng khung nhập theo toàn bộ vùng nội dung, giữ lề cân đối hai bên. */}
      <form className="mt-4 w-100" onSubmit={submit}>
        <div className="card border-0 shadow-sm"><div className="card-body p-4 p-lg-5 d-grid gap-4">
          <div>
            <TextField
              label="Tên danh mục món ăn"
              value={form.name}
              onChange={update('name')}
              placeholder="Ví dụ: Bánh Mì, Cơm, Cháo, Chè"
              maxLength={200}
              required
            />
            {searching && <small className="text-body-secondary">Đang kiểm tra tên đã có…</small>}
            {exactMatch && <small className="text-danger d-block mt-1">Tên này đã có trong danh mục.</small>}
          </div>
          <TextArea label="Mô tả" value={form.description} onChange={update('description')} maxLength={500} rows={4} placeholder="Mô tả ngắn về nhóm món ăn" />
          {loadingCategories
            ? <p className="text-body-secondary mb-0">Đang tải danh mục…</p>
            : <CategoryPicker label="Danh mục phân loại" hint="Ví dụ: ăn sáng, món chính, món nước, dinh dưỡng…" options={categories} value={form.categoryIds} onChange={update('categoryIds')} max={20} required />}
          <div className="d-flex flex-wrap justify-content-end gap-2 pt-2 border-top">
            <Button type="button" variant="outline" onClick={() => window.location.assign('/admin/dishes')}>Quay lại</Button>
            <Button type="submit" icon="plus-circle" loading={saving} disabled={saving || loadingCategories || !!categoriesError || searching || !!exactMatch}>Tạo danh mục món ăn</Button>
          </div>
        </div></div>
      </form>
    </AdminLayout>
  );
}
