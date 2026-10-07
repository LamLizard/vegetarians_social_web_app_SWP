import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, CategoryPicker, DishCard, EmptyState, Notice, PageHeader, Photo, TextArea, TextField } from '../components';
import { getDishCategories, getMyDishes, suggestDish } from '../services/dish.service';

// Duy's code: Dữ liệu mặc định dùng cho form đề xuất của Member.
const EMPTY_FORM = { name: '', description: '', thumbnailUrl: '', categoryIds: [] };

// Duy's code: Trang Member tạo đề xuất mới và theo dõi trạng thái các đề xuất.
export default function DishSuggestionPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [categories, setCategories] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [dishesLoading, setDishesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
  const [dishesError, setDishesError] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState('');
  const isMounted = useRef(false);
  const dishesRequestId = useRef(0);

  // Duy's Code: Tải danh mục độc lập để lỗi danh sách đề xuất không chặn form.
  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError('');
    try {
      const items = await getDishCategories();
      if (isMounted.current) setCategories(items.map((item) => ({ value: item.id, label: item.name })));
    } catch (requestError) {
      if (isMounted.current) setCategoriesError(requestError.message);
    } finally {
      if (isMounted.current) setCategoriesLoading(false);
    }
  }, []);

  // Duy's Code: Tải riêng đề xuất hiện có và bỏ qua phản hồi cũ hơn lần tải gần nhất.
  const loadDishes = useCallback(async () => {
    const requestId = dishesRequestId.current + 1;
    dishesRequestId.current = requestId;
    setDishesLoading(true);
    setDishesError('');
    try {
      const items = await getMyDishes();
      if (isMounted.current && dishesRequestId.current === requestId) setDishes(items);
    } catch (requestError) {
      if (isMounted.current && dishesRequestId.current === requestId) setDishesError(requestError.message);
    } finally {
      if (isMounted.current && dishesRequestId.current === requestId) setDishesLoading(false);
    }
  }, []);

  // Duy's Code: Tải hai phần độc lập và ngăn cập nhật state sau khi rời trang.
  useEffect(() => {
    isMounted.current = true;
    loadCategories();
    loadDishes();
    return () => { isMounted.current = false; };
  }, [loadCategories, loadDishes]);

  // Duy's Code: Xóa phản hồi cũ và lỗi đúng trường khi Member bắt đầu chỉnh sửa.
  const updateField = (field) => (value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSubmitError('');
    setNotice('');
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  // Duy's Code: Đồng bộ validation phía client với giới hạn của API Dish.
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

  // Duy's Code: Gửi dữ liệu đã chuẩn hóa ở trạng thái pending rồi cập nhật danh sách.
  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    setNotice('');
    if (categoriesLoading || categoriesError || !validateForm()) return;
    setSaving(true);
    try {
      const dish = await suggestDish({
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        thumbnailUrl: form.thumbnailUrl.trim(),
      });
      // Duy's Code: Vô hiệu hóa phản hồi danh sách cũ đang bay để không ghi đè món vừa gửi.
      dishesRequestId.current += 1;
      setDishesLoading(false);
      setDishesError('');
      setDishes((current) => [dish, ...current]);
      setForm(EMPTY_FORM);
      setFieldErrors({});
      setNotice('Đã gửi đề xuất. Món sẽ xuất hiện sau khi Admin duyệt.');
    } catch (requestError) {
      setSubmitError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="container py-4">
      <nav className="mb-3" aria-label="Điều hướng">
        <Button as="a" href="/feed" variant="outline" icon="arrow-left">Quay lại bảng tin</Button>
      </nav>
      {/* Duy's code: Cho Member biết đề xuất chỉ xuất hiện sau khi Admin duyệt. */}
      <PageHeader
        title="Đề xuất món ăn"
        description="Chia sẻ món ăn chay chưa có trong danh mục. Đề xuất sẽ ở trạng thái chờ cho đến khi Admin xem xét."
      />
      {submitError && <Notice tone="alert" title="Không thể gửi đề xuất" className="mt-3">{submitError}</Notice>}
      {notice && <Notice tone="success" className="mt-3">{notice}</Notice>}
      {/* Duy's code: Nhận thông tin Dish và gửi lên backend ở trạng thái pending. */}
      {/* Duy's Code: Form Member dùng cùng giới hạn đầu vào với form tạo món Admin. */}
      <form className="rounded border p-3 mt-3" onSubmit={handleSubmit} noValidate>
        {/* Duy's Code: Khóa các trường trong lúc gửi để tránh mất phần nhập mới. */}
        <fieldset disabled={saving} className="border-0 p-0 m-0">
        <div className="row g-3">
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
              hint="Không bắt buộc; cần là URL HTTPS."
              error={fieldErrors.thumbnailUrl}
            />
          </div>
          {form.thumbnailUrl && (
            <div className="col-12"><Photo src={form.thumbnailUrl} alt={`Ảnh xem trước món ${form.name}`} ratio="4/3" /></div>
          )}
          <div className="col-12">
            {categoriesLoading ? <p role="status">Đang tải danh mục...</p> : categoriesError ? (
              <Notice tone="alert" title="Không tải được danh mục">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <span>{categoriesError}</span>
                  <Button type="button" variant="outline" size="sm" onClick={loadCategories} loading={categoriesLoading}>Thử tải lại</Button>
                </div>
              </Notice>
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
          <Button type="submit" loading={saving} disabled={saving || categoriesLoading || !!categoriesError}>Gửi đề xuất chờ duyệt</Button>
        </div>
      </form>

      {/* Duy's code: Cho Member theo dõi trạng thái và lý do từ chối đề xuất của mình. */}
      <section className="mt-5" aria-labelledby="my-dishes-heading">
        <h2 id="my-dishes-heading" className="h4">Đề xuất của tôi</h2>
        {dishesError && (
          <Notice tone="alert" title="Không tải được danh sách đề xuất">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
              <span>{dishesError}</span>
              <Button type="button" variant="outline" size="sm" onClick={loadDishes} loading={dishesLoading}>Thử tải lại</Button>
            </div>
          </Notice>
        )}
        {dishesLoading ? <p role="status">Đang tải danh sách...</p> : dishesError ? null : dishes.length === 0 ? (
          <EmptyState title="Bạn chưa đề xuất món nào" description="Các món bạn gửi sẽ xuất hiện tại đây." />
        ) : (
          <div className="d-grid gap-3">
            {dishes.map((dish) => (
              <DishCard
                key={dish.id}
                layout="row"
                name={dish.name}
                description={dish.description}
                imageUrl={dish.thumbnailUrl}
                categories={dish.categories}
                status={dish.status}
                showStatus
                moderationNote={dish.moderationNote}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
