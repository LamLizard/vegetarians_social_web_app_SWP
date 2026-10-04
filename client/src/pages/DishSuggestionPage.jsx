import { useEffect, useState } from 'react';
import { Button, CategoryPicker, DishCard, EmptyState, Notice, PageHeader, Photo, TextArea, TextField } from '../components';
import { getDishCategories, getMyDishes, suggestDish } from '../services/dish.service';

const EMPTY_FORM = { name: '', description: '', thumbnailUrl: '', categoryIds: [] };

export default function DishSuggestionPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [categories, setCategories] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getDishCategories(), getMyDishes()])
      .then(([categoryItems, dishItems]) => {
        if (!active) return;
        setCategories(categoryItems.map((item) => ({ value: item.id, label: item.name })));
        setDishes(dishItems);
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
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
      const dish = await suggestDish(form);
      setDishes((current) => [dish, ...current]);
      setForm(EMPTY_FORM);
      setNotice('Đã gửi đề xuất. Món sẽ xuất hiện sau khi Admin duyệt.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="container py-4">
      <nav className="mb-3" aria-label="Điều hướng">
        <Button as="a" href="/feed" variant="outline" icon="arrow-left">Quay lại bảng tin</Button>
      </nav>
      <PageHeader
        title="Đề xuất món ăn"
        description="Chia sẻ món ăn chay chưa có trong danh mục. Đề xuất sẽ ở trạng thái chờ cho đến khi Admin xem xét."
      />
      {error && <Notice tone="alert" title="Không thể gửi đề xuất" className="mt-3">{error}</Notice>}
      {notice && <Notice tone="success" className="mt-3">{notice}</Notice>}
      <form className="rounded border p-3 mt-3" onSubmit={handleSubmit} noValidate>
        <div className="row g-3">
          <div className="col-12">
            <TextField label="Tên món ăn" value={form.name} onChange={updateField('name')} maxLength={200} required />
          </div>
          <div className="col-12">
            <TextArea label="Mô tả" value={form.description} onChange={updateField('description')} maxLength={500} rows={3} />
          </div>
          <div className="col-12">
            <TextField
              label="URL ảnh đại diện"
              type="url"
              value={form.thumbnailUrl}
              onChange={updateField('thumbnailUrl')}
              maxLength={500}
              hint="Không bắt buộc; cần là URL HTTPS."
            />
          </div>
          {form.thumbnailUrl && (
            <div className="col-12"><Photo src={form.thumbnailUrl} alt={`Ảnh xem trước món ${form.name}`} ratio="4/3" /></div>
          )}
          <div className="col-12">
            {loading ? <p role="status">Đang tải dữ liệu...</p> : (
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
          <Button type="submit" loading={saving} disabled={saving || loading}>Gửi đề xuất chờ duyệt</Button>
        </div>
      </form>

      <section className="mt-5" aria-labelledby="my-dishes-heading">
        <h2 id="my-dishes-heading" className="h4">Đề xuất của tôi</h2>
        {loading ? <p role="status">Đang tải danh sách...</p> : dishes.length === 0 ? (
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
