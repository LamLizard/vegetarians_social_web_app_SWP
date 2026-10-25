import { useEffect, useState } from 'react';
import { AdminLayout, Button, CategoryPicker, ErrorDialog, Notice, PageHeader, TextArea, TextField } from '../components';
import useAuth from '../hooks/useAuth';
import { createAdminDish, getDishCategories, searchAdminDishes } from '../services/dish.service';

const EMPTY_FORM = { name: '', description: '', categoryIds: [] };

// Duy's Code : Tạo danh mục món chung; công thức và biến thể món được quản lý riêng.
export default function AdminDishCreatePage() {
  const { user, logout } = useAuth();
  // Duy's Code: Giữ mã Recipe trên luồng quay về để liên kết ngay sau khi tạo Dish.
  const returnRecipeId = new URLSearchParams(window.location.search).get('returnRecipeId');
  const returnToRecipe = Boolean(returnRecipeId);
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
    // Duy's Code: Dish là món; Category chỉ là nhãn phân loại được chọn bên dưới.
    if (!form.name.trim()) return setError('Nhập tên món ăn.');
    if (exactMatch) return setError(`Món “${exactMatch.name}” đã tồn tại.`);
    if (!form.categoryIds.length) return setError('Chọn ít nhất một Category phân loại.');
    setSaving(true);
    try {
      const created = await createAdminDish({ ...form, name: form.name.trim(), description: form.description.trim() });
      if (returnRecipeId) {
        window.location.assign(`/admin/recipes/verify?createdDishId=${encodeURIComponent(created.id)}&returnRecipeId=${encodeURIComponent(returnRecipeId)}&dishName=${encodeURIComponent(created.name)}`);
        return;
      }
      setForm(EMPTY_FORM);
      setMatches([]);
      // Duy's Code: Báo đúng đối tượng vừa tạo theo luồng Dish.
      setSuccess(`Đã tạo món “${created.name}”.`);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <AdminLayout activeKey="dish-create" title="Tạo món ăn" user={user} onLogout={() => { logout(); window.location.assign('/'); }}>
      {/* Duy's Code: Khi tạo Dish từ Recipe Verify, breadcrumb quay lại đúng Recipe đang chờ. */}
      <PageHeader
        breadcrumb={[{ label: 'Quản lý món ăn', href: returnToRecipe ? `/admin/recipes/verify?recipeId=${encodeURIComponent(returnRecipeId)}` : '/admin/dishes' }, { label: 'Tạo món ăn' }]}
        title="Tạo món ăn"
        description={returnToRecipe
          ? 'Tạo Dish để liên kết với công thức đang chờ duyệt. Sau khi tạo, hệ thống sẽ tự nối công thức đó với món mới.'
          : 'Tạo một Dish. Các công thức được liên kết với món; Category chỉ dùng để phân loại món.'}
      />
      {/* Duy's Code: Đưa lỗi tạo danh mục lên hộp thoại để không bị khuất đầu trang. */}
      <ErrorDialog error={error} title="Chưa thể tạo món" />
      {success && <Notice tone="success" title="Đã tạo Dish" className="mt-3">{success}</Notice>}
      {/* Duy's Code: Báo lỗi tải danh mục phân loại bằng hộp thoại. */}
      <ErrorDialog error={categoriesError} title="Không tải được danh mục phân loại" />
      {/* Duy's Code : Mở rộng khung nhập theo toàn bộ vùng nội dung, giữ lề cân đối hai bên. */}
      <form className="mt-4 w-100" onSubmit={submit}>
        <div className="card border-0 shadow-sm"><div className="card-body p-4 p-lg-5 d-grid gap-4">
          <div>
            <TextField
              label="Tên món ăn (Dish)"
              value={form.name}
              onChange={update('name')}
              placeholder="Ví dụ: Bánh Mì, Cơm, Cháo, Chè"
              maxLength={200}
              required
            />
            {searching && <small className="text-body-secondary">Đang kiểm tra tên đã có…</small>}
            {exactMatch && <small className="text-danger d-block mt-1">Dish này đã tồn tại.</small>}
          </div>
          <TextArea label="Mô tả" value={form.description} onChange={update('description')} maxLength={500} rows={4} placeholder="Mô tả món ăn" />
          {loadingCategories
            ? <p className="text-body-secondary mb-0">Đang tải danh mục…</p>
            : <CategoryPicker label="Category phân loại" hint="Ví dụ: ăn sáng, món chính, món nước, dinh dưỡng… Đây là nhãn, không phải tên Dish." options={categories} value={form.categoryIds} onChange={update('categoryIds')} max={20} required />}
          <div className="d-flex flex-wrap justify-content-end gap-2 pt-2 border-top">
            {/* Duy's Code: Hủy tạo vẫn quay lại công thức nguồn nếu trang được mở từ Recipe Verify. */}
            <Button type="button" variant="outline" onClick={() => window.location.assign(returnToRecipe ? `/admin/recipes/verify?recipeId=${encodeURIComponent(returnRecipeId)}` : '/admin/dishes')}>Quay lại</Button>
            <Button type="submit" icon="plus-circle" loading={saving} disabled={saving || loadingCategories || !!categoriesError || searching || !!exactMatch}>Tạo Dish</Button>
          </div>
        </div></div>
      </form>
    </AdminLayout>
  );
}
