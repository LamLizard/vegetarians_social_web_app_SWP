import { useEffect, useRef, useState } from 'react';
import {
  Avatar, Button, FormField, IconButton, Modal, Photo, Tag,
} from '../../../components';
import cx from '../../../components/cx';
import { useApp, useCurrentUser } from '../../store/AppStore';
import { POST_TYPES } from '../../store/mockData';
import { readImageFile } from '../../utils/format';
import { mentionsEggMilk } from './rules';
import styles from './compose.module.css';

const PLACEHOLDERS = {
  share: 'hôm nay bạn ăn chay món gì?',
  recipe: 'giới thiệu món ăn, mẹo nấu cho ngon…',
  review: 'không gian, món ngon, giá cả của quán thế nào?',
  question: 'bạn muốn hỏi cộng đồng điều gì?',
};
const RECIPE_TAGS = ['Giàu đạm thực vật', 'Nhiều chất xơ', 'Ăn sáng nhanh', 'Nhẹ bụng', 'Đồ ngọt'];
const INGREDIENT_PRESETS = ['Thuần chay: không trứng, không sữa.', 'Có trứng, không có sữa.', 'Có sữa, không có trứng.', 'Có cả trứng và sữa.'];

const emptyForm = (type) => ({
  type,
  content: '',
  image: null,
  recipe: { title: '', cookTime: '', kcal: '', tag: '', ingredientsNote: '' },
  restaurant: { name: '', address: '', rating: 0 },
});

/**
 * Hộp thoại đăng bài. Bài mới luôn ở trạng thái "Chờ duyệt".
 * @param {'share'|'recipe'|'review'|'question'|null} openType  null = đóng
 * @param {()=>void} onClose
 * @param {(post)=>void} onCreated
 */
export default function CreatePostModal({ openType, onClose, onCreated }) {
  const { actions } = useApp();
  const me = useCurrentUser();
  const [form, setForm] = useState(emptyForm('share'));
  const [errors, setErrors] = useState({});
  const [imageError, setImageError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    if (openType) {
      setForm(emptyForm(openType));
      setErrors({});
      setImageError('');
    }
  }, [openType]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setRecipe = (key, value) => setForm((f) => ({ ...f, recipe: { ...f.recipe, [key]: value } }));
  const setPlace = (key, value) => setForm((f) => ({ ...f, restaurant: { ...f.restaurant, [key]: value } }));

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('Chỉ nhận file ảnh (JPG, PNG, WEBP…).');
      return;
    }
    try {
      set('image', await readImageFile(file));
      setImageError('');
    } catch (err) {
      setImageError(err.message);
    }
  };

  const validate = () => {
    const e = {};
    if (form.content.trim().length < 10) e.content = 'Viết thêm chút nữa nhé (ít nhất 10 ký tự).';
    if (form.type === 'recipe') {
      if (!form.recipe.title.trim()) e.title = 'Nhập tên món.';
      if (!form.recipe.ingredientsNote.trim() || !mentionsEggMilk(form.recipe.ingredientsNote)) {
        e.ingredientsNote = 'Ghi chú thành phần bắt buộc phải nêu rõ có trứng/sữa hay không (BR-01).';
      }
    }
    if (form.type === 'review') {
      if (!form.restaurant.name.trim()) e.placeName = 'Nhập tên quán.';
      if (!form.restaurant.address.trim()) e.address = 'Nhập địa chỉ quán.';
      if (!form.restaurant.rating) e.rating = 'Chọn số sao đánh giá.';
    }
    return e;
  };

  const submit = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      // Đưa người dùng tới ô lỗi đầu tiên (có thể đang bị khuất trong hộp thoại)
      requestAnimationFrame(() => {
        const field = document.querySelector('dialog[open] .is-invalid');
        field?.focus();
        field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
      return;
    }
    const post = actions.createPost({
      type: form.type,
      content: form.content.trim(),
      image: form.image,
      ...(form.type === 'recipe' && {
        recipe: { ...form.recipe, kcal: form.recipe.kcal ? Number(form.recipe.kcal) : undefined },
      }),
      ...(form.type === 'review' && { restaurant: form.restaurant }),
    });
    onCreated?.(post);
    onClose();
  };

  return (
    <Modal
      open={!!openType}
      onClose={onClose}
      title="Tạo bài viết"
      footer={(
        <>
          <Button variant="subtle" onClick={onClose}>Hủy</Button>
          <Button icon="send" onClick={submit} disabled={!form.content.trim()}>Đăng bài</Button>
        </>
      )}
    >
      <div className={styles.createHead}>
        <Avatar name={me.fullName} src={me.avatar} size={42} />
        <div>
          <b>{me.fullName}</b>
          <small><i className="bi bi-hourglass-split" aria-hidden="true" /> Bài sẽ được quản trị viên duyệt trước khi hiển thị công khai</small>
        </div>
      </div>

      <div className={styles.typeRow} role="group" aria-label="Loại bài viết">
        {Object.entries(POST_TYPES).map(([key, t]) => (
          <Tag key={key} icon={t.icon} active={form.type === key} onClick={() => { set('type', key); setErrors({}); }}>
            {t.label}
          </Tag>
        ))}
      </div>

      <FormField
        multiline
        label="Nội dung"
        className={styles.contentField}
        placeholder={`${me.fullName.split(' ').pop()} ơi, ${PLACEHOLDERS[form.type]}`}
        value={form.content}
        onChange={(e) => set('content', e.target.value)}
        error={errors.content}
        maxLength={2000}
        rows={4}
      />

      {form.type === 'recipe' && (
        <fieldset className={styles.extra}>
          <legend>Thông tin công thức</legend>
          <FormField label="Tên món" required placeholder="Vd: Bún riêu chay" value={form.recipe.title} onChange={(e) => setRecipe('title', e.target.value)} error={errors.title} />
          <div className="row g-2">
            <div className="col-6">
              <FormField label="Thời gian nấu" placeholder="Vd: 30 phút" value={form.recipe.cookTime} onChange={(e) => setRecipe('cookTime', e.target.value)} />
            </div>
            <div className="col-6">
              <FormField label="Năng lượng (kcal)" type="number" min="0" inputMode="numeric" placeholder="Vd: 450" value={form.recipe.kcal} onChange={(e) => setRecipe('kcal', e.target.value)} />
            </div>
          </div>
          <div className="mb-3">
            <span className="form-label fw-semibold small mb-1 d-block">Nhãn nổi bật</span>
            <div className="d-flex flex-wrap gap-2">
              {RECIPE_TAGS.map((t) => (
                <Tag key={t} active={form.recipe.tag === t} onClick={() => setRecipe('tag', form.recipe.tag === t ? '' : t)}>{t}</Tag>
              ))}
            </div>
          </div>
          <FormField
            label="Ghi chú thành phần"
            required
            multiline
            placeholder="Món có trứng / sữa không? Dùng nước mắm chay hay nước tương?…"
            value={form.recipe.ingredientsNote}
            onChange={(e) => setRecipe('ingredientsNote', e.target.value)}
            error={errors.ingredientsNote}
            hint="Bắt buộc nêu rõ món có trứng/sữa hay không để người ăn thuần chay dễ lựa chọn."
            className="mb-2"
          />
          <div className={styles.presets}>
            {INGREDIENT_PRESETS.map((p) => (
              <button key={p} type="button" className={styles.preset} onClick={() => setRecipe('ingredientsNote', p)}>{p}</button>
            ))}
          </div>
        </fieldset>
      )}

      {form.type === 'review' && (
        <fieldset className={styles.extra}>
          <legend>Thông tin quán</legend>
          <FormField label="Tên quán" required placeholder="Vd: Cơm chay Tịnh Tâm" value={form.restaurant.name} onChange={(e) => setPlace('name', e.target.value)} error={errors.placeName} />
          <FormField label="Địa chỉ" required placeholder="Số nhà, đường, quận/huyện, tỉnh/thành" value={form.restaurant.address} onChange={(e) => setPlace('address', e.target.value)} error={errors.address} />
          <div className="mb-1">
            <span className="form-label fw-semibold small mb-1 d-block">Đánh giá<span className="text-danger ms-1" aria-hidden="true">*</span></span>
            <div className={styles.rateRow} role="radiogroup" aria-label="Số sao đánh giá">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={form.restaurant.rating === n}
                  aria-label={`${n} sao`}
                  className={cx(styles.rateStar, form.restaurant.rating >= n && styles.rateOn)}
                  onClick={() => setPlace('rating', n)}
                >
                  <i className={`bi bi-${form.restaurant.rating >= n ? 'star-fill' : 'star'}`} aria-hidden="true" />
                </button>
              ))}
              {form.restaurant.rating > 0 && <span className="small text-body-secondary ms-2">{form.restaurant.rating}/5</span>}
            </div>
            {errors.rating && <div className="invalid-feedback d-block">{errors.rating}</div>}
          </div>
        </fieldset>
      )}

      {form.image ? (
        <div className={styles.preview}>
          <Photo src={form.image} alt="Ảnh xem trước" className={styles.previewImg} />
          <IconButton icon="x-lg" label="Bỏ ảnh" size="sm" className={styles.previewRemove} onClick={() => set('image', null)} />
        </div>
      ) : (
        <button type="button" className={styles.addPhoto} onClick={() => fileRef.current?.click()}>
          <i className="bi bi-image" aria-hidden="true" />
          <span><b>Thêm ảnh món ăn</b><small>JPG, PNG · ảnh sẽ được thu nhỏ tự động</small></span>
        </button>
      )}
      {imageError && <div className="invalid-feedback d-block">{imageError}</div>}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />
    </Modal>
  );
}
