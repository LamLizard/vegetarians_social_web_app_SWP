import { useEffect, useState } from 'react';
import {
  AdminLayout, Button, CategoryPicker, Notice, PageHeader, Panel, Photo, TextArea, TextField,
} from '../components';
import useAuth from '../hooks/useAuth';
import { createAdminDish, getDishCategories } from '../services/dish.service';

// Duy's code: Giá trị khởi đầu để reset form sau khi tạo Dish thành công.
const EMPTY_FORM = { name: '', description: '', thumbnailUrl: '', categoryIds: [] };

// Duy's code: Màn hình Admin tải danh mục và gửi Dish mới thẳng vào active.
export default function AdminDishCreatePage() {
  const { user, logout } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Duy's Code: Tải danh mục một lần và giữ lỗi riêng để Admin có thể thử lại.
  useEffect(() => {
    let active = true;
    getDishCategories()
      .then((items) => { if (active) setCategories(items.map((item) => ({ value: item.id, label: item.name }))); })
      .catch((requestError) => { if (active) setCategoriesError(requestError.message); }) // Duy's Code: Không trộn lỗi tải danh mục với lỗi lưu món.
      .finally(() => { if (active) setLoadingCategories(false); });
    return () => { active = false; };
  }, []);

  // Duy's Code: Tải lại danh mục khi yêu cầu ban đầu thất bại.
  const retryCategories = async () => {
    setLoadingCategories(true);
    setCategoriesError('');
    try {
      const items = await getDishCategories();
      setCategories(items.map((item) => ({ value: item.id, label: item.name })));
    } catch (requestError) {
      setCategoriesError(requestError.message);
    } finally {
      setLoadingCategories(false);
    }
  };

  // Duy's Code: Cập nhật một trường form và xóa phản hồi/lỗi cũ khi người dùng sửa.
  const updateField = (field) => (value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
    setNotice('');
    setFieldErrors((current) => ({ ...current, [field]: undefined })); // Duy's Code: Xóa lỗi tại trường đang được sửa.
  };

  // Duy's Code: Kiểm tra dữ liệu ngay trên form theo cùng giới hạn của backend.
  const validateForm = () => {
    const nextErrors = {};
    const name = form.name.trim();
    const description = form.description.trim();
    const thumbnailUrl = form.thumbnailUrl.trim();
    if (!name) nextErrors.name = 'Vui lòng nhập tên món ăn.';
    else if ([...name].length > 200) nextErrors.name = 'Tên món ăn không được vượt quá 200 ký tự.';
    if ([...description].length > 500) nextErrors.description = 'Mô tả không được vượt quá 500 ký tự.';
    if (thumbnailUrl) {
      try {
        if (new URL(thumbnailUrl).protocol !== 'https:' || thumbnailUrl.length > 500) throw new Error('invalid');
      } catch {
        nextErrors.thumbnailUrl = 'Nhập URL HTTPS hợp lệ, tối đa 500 ký tự.';
      }
    }
    if (!form.categoryIds.length) nextErrors.categoryIds = 'Chọn ít nhất một danh mục.';
    else if (form.categoryIds.length > 20) nextErrors.categoryIds = 'Chọn tối đa 20 danh mục.';
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // Duy's Code: Kiểm tra dữ liệu rồi tạo món ở trạng thái active, báo kết quả khi hoàn tất.
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!validateForm()) return;
    setSaving(true);
    try {
      const dish = await createAdminDish({
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        thumbnailUrl: form.thumbnailUrl.trim(),
      });
      setForm(EMPTY_FORM);
      setFieldErrors({});
      setNotice(`Đã tạo món “${dish.name}” ở trạng thái Đã duyệt.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  // Duy's code: Đăng xuất Admin và điều hướng về trang gốc.
  const handleLogout = () => { logout(); window.location.assign('/'); };

  return (
    <AdminLayout activeKey="dish-create" title="Tạo món ăn" user={user} onLogout={handleLogout}>
      {/* Duy's code: Nêu rõ Dish Admin tạo sẽ hoạt động ngay và có AdminLog. */}
      <PageHeader
        title="Tạo món ăn"
        description="Món do Admin khởi tạo được đưa thẳng vào danh mục đang hoạt động và ghi nhật ký quản trị."
      />
      <Panel className="mt-3">
        {error && <Notice tone="alert" title="Không thể tạo món ăn" className="mb-3">{error}</Notice>}
        {notice && <Notice tone="success" className="mb-3">{notice}</Notice>}
        {categoriesError && (
          <Notice tone="alert" title="Không tải được danh mục" className="mb-3">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
              <span>{categoriesError}</span>
              <Button type="button" variant="outline" size="sm" onClick={retryCategories} loading={loadingCategories}>Thử tải lại</Button>
            </div>
          </Notice>
        )}
        {/* Duy's code: Thu thập tên, mô tả, ảnh và danh mục cho Dish mới. */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Duy's Code: Khóa các trường khi lưu để không mất chỉnh sửa phát sinh giữa request. */}
          <fieldset disabled={saving} className="border-0 p-0 m-0">
          <div className="row g-3">
            {/* Duy's code: Chỉ hiển thị bộ chọn sau khi danh mục hoạt động đã tải xong. */}
            <div className="col-12">
              <TextField
                label="Tên món ăn"
                value={form.name}
                onChange={updateField('name')}
                maxLength={200}
                required
                error={fieldErrors.name}
              />
            </div>
            <div className="col-12">
              <TextArea
                label="Mô tả"
                value={form.description}
                onChange={updateField('description')}
                maxLength={500}
                rows={3}
                error={fieldErrors.description}
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
                error={fieldErrors.thumbnailUrl}
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
                  error={fieldErrors.categoryIds}
                />
              )}
            </div>
          </div>
          </fieldset>
          <div className="d-flex justify-content-end mt-4">
            <Button type="submit" loading={saving} disabled={saving || loadingCategories || !!categoriesError}>
              Tạo món ở trạng thái Đã duyệt
            </Button>
          </div>
        </form>
      </Panel>
    </AdminLayout>
  );
}
