import { useEffect, useState } from 'react';
import {
  AdminLayout, Button, CategoryPicker, Notice, PageHeader, Panel, Photo, TextArea, TextField,
} from '../components';
import useAuth from '../hooks/useAuth';
import { createAdminDish, getDishCategories } from '../services/dish.service';

const EMPTY_FORM = { name: '', description: '', thumbnailUrl: '', categoryIds: [] };

export default function AdminDishCreatePage() {
  const { user, logout } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    getDishCategories()
      .then((items) => { if (active) setCategories(items.map((item) => ({ value: item.id, label: item.name }))); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoadingCategories(false); });
    return () => { active = false; };
  }, []);

  const updateField = (field) => (value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
    setNotice('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!form.categoryIds.length) {
      setError('Vui lòng chọn ít nhất một danh mục.');
      return;
    }
    setSaving(true);
    try {
      const dish = await createAdminDish(form);
      setForm(EMPTY_FORM);
      setNotice(`Đã tạo món “${dish.name}” ở trạng thái Đã duyệt.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => { logout(); window.location.assign('/'); };

  return (
    <AdminLayout activeKey="dish-create" title="Tạo món ăn" user={user} onLogout={handleLogout}>
      <PageHeader
        title="Tạo món ăn"
        description="Món do Admin khởi tạo được đưa thẳng vào danh mục đang hoạt động và ghi nhật ký quản trị."
      />
      <Panel className="mt-3">
        {error && <Notice tone="alert" title="Không thể tạo món ăn" className="mb-3">{error}</Notice>}
        {notice && <Notice tone="success" className="mb-3">{notice}</Notice>}
        <form onSubmit={handleSubmit} noValidate>
          <div className="row g-3">
            <div className="col-12">
              <TextField
                label="Tên món ăn"
                value={form.name}
                onChange={updateField('name')}
                maxLength={200}
                required
              />
            </div>
            <div className="col-12">
              <TextArea
                label="Mô tả"
                value={form.description}
                onChange={updateField('description')}
                maxLength={500}
                rows={3}
              />
            </div>
            <div className="col-12">
              <TextField
                label="URL ảnh đại diện"
                type="url"
                value={form.thumbnailUrl}
                onChange={updateField('thumbnailUrl')}
                maxLength={500}
                hint="Dùng URL HTTPS; ảnh chỉ được tải từ nguồn đã cung cấp."
              />
            </div>
            {form.thumbnailUrl && (
              <div className="col-12">
                <Photo src={form.thumbnailUrl} alt={`Ảnh xem trước món ${form.name}`} ratio="4/3" />
              </div>
            )}
            <div className="col-12">
              {loadingCategories ? (
                <p role="status">Đang tải danh mục...</p>
              ) : (
                <CategoryPicker
                  label="Danh mục"
                  options={categories}
                  value={form.categoryIds}
                  onChange={updateField('categoryIds')}
                  max={20}
                  required
                />
              )}
            </div>
          </div>
          <div className="d-flex justify-content-end mt-4">
            <Button type="submit" loading={saving} disabled={saving || loadingCategories}>
              Tạo món ở trạng thái Đã duyệt
            </Button>
          </div>
        </form>
      </Panel>
    </AdminLayout>
  );
}
