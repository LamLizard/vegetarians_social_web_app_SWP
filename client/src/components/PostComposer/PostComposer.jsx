import { useId, useState } from 'react';
import Avatar from '../Avatar/Avatar';
import Button from '../Button/Button';
import CategoryPicker from '../CategoryPicker/CategoryPicker';
import Chip from '../Chip/Chip';
import ImageUpload from '../ImageUpload/ImageUpload';
import Modal from '../Modal/Modal';
import Notice from '../Notice/Notice';
import TextArea from '../TextArea/TextArea';
import cx from '../cx';
import { rules, validate, hasErrors } from '../../utils/validate';
import styles from './PostComposer.module.css';

/** Câu mở đầu gợi ý. Bấm chip → điền sẵn vào ô chính. Trang có thể truyền `prompts` khác. */
export const COMPOSER_PROMPTS = [
  { icon: 'egg-fried', label: 'Hôm nay ăn gì?', text: 'Các bạn gợi ý cho mình hôm nay ăn gì với ạ?' },
  { icon: 'basket', label: 'Tủ lạnh còn…', text: 'Nhà mình còn … thì nấu được món chay gì nhỉ?' },
  { icon: 'shop', label: 'Hỏi quán', text: 'Có ai biết quán chay nào ngon ở … không ạ?' },
  { icon: 'stars', label: 'Khoe món', text: 'Hôm nay mình nấu thử món …, chia sẻ với mọi người nè!' },
];

const EMPTY = { title: '', content: '', thumbnailUrl: '', categoryIds: [] };
const firstName = (name = '') => name.trim().split(/\s+/).pop();

/**
 * Ô "đăng nhanh" đầu bảng tin (M-01), kiểu "Bạn đang nghĩ gì?" của Facebook.
 * Dùng cho câu hỏi ngắn: "Hôm nay ăn gì?", "Nhà còn đậu hũ nấu gì?"...
 *
 * Theo Report v4.0 KHÔNG có loại bài "status" → bài đăng nhanh vẫn là Post **blog**:
 *   câu hỏi → post.title (bắt buộc) · chi tiết → post.content (tuỳ chọn) · ảnh → post.thumbnail_url
 *   danh mục → ít nhất 1 (UC-03) · đăng xong status = pending, chờ Admin duyệt.
 * Bài dài / video thì bấm "Viết blog" / "Video" để sang form đầy đủ (M-05, M-06).
 *
 * Nháp được giữ khi đóng hộp (bấm ra ngoài không mất chữ). Đăng thành công mới xoá.
 *
 * @param {{name: string, avatarUrl?: string}} [currentUser]  không có → khách, bấm vào gọi onRequireLogin
 * @param {{value: string|number, label: string}[]} categories  danh sách category (category_id, name)
 * @param {(post: {postType: 'blog', title, content, thumbnailUrl, categoryIds}) => Promise<void>} onSubmit
 *        Ném lỗi (throw new Error('Bạn đã đăng 3 bài trong 1 giờ...')) → hiện trong hộp, giữ nguyên nháp
 * @param {(file, opts) => Promise<string>} [onUpload]  hàm tải ảnh lên cloud; không truyền → ẩn nút Ảnh
 * @param {(draft) => void} [onOpenBlogEditor]  sang form Viết Blog đầy đủ, nhận nháp hiện tại để điền sẵn
 * @param {() => void} [onOpenVideoEditor]     sang form Đăng Video
 * @param {() => void} [onRequireLogin]
 * @param {{icon, label, text}[]} [prompts=COMPOSER_PROMPTS]  [] → ẩn chip gợi ý
 * @param {number} [maxCategories=3]
 */
export default function PostComposer({
  currentUser, categories = [], onSubmit, onUpload, onOpenBlogEditor, onOpenVideoEditor, onRequireLogin,
  prompts = COMPOSER_PROMPTS, maxCategories = 3, className,
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [showPhoto, setShowPhoto] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [sending, setSending] = useState(false);
  const formId = useId();

  const guest = !currentUser;
  const hasDraft = !!(form.title.trim() || form.content.trim() || form.thumbnailUrl);

  const set = (key) => (v) => {
    setForm((f) => ({ ...f, [key]: v }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    setServerError('');
  };

  const openWith = ({ photo = false } = {}) => {
    if (guest) { onRequireLogin?.(); return; }
    if (photo) setShowPhoto(true);
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(form, {
      title: [rules.required('Viết câu bạn muốn hỏi hoặc chia sẻ'), rules.maxLength(200)],
      categoryIds: [rules.minItems(1, 'Chọn ít nhất 1 danh mục để mọi người dễ tìm')],
    });
    setErrors(errs);
    if (hasErrors(errs)) return;
    setSending(true);
    setServerError('');
    try {
      await onSubmit?.({
        postType: 'blog',
        title: form.title.trim(),
        content: form.content.trim(),
        thumbnailUrl: form.thumbnailUrl || undefined,
        categoryIds: form.categoryIds,
      });
      setForm(EMPTY);
      setShowPhoto(false);
      setOpen(false);
    } catch (err) {
      setServerError(err?.message || 'Chưa đăng được bài, thử lại sau');
    } finally {
      setSending(false);
    }
  };

  const goFullEditor = () => {
    setOpen(false);
    onOpenBlogEditor?.(form);
  };

  return (
    <div className={cx(styles.box, className)}>
      <div className={styles.top}>
        {guest
          ? <span className={styles.guestIcon} aria-hidden="true"><i className="bi bi-person" /></span>
          : <Avatar src={currentUser.avatarUrl} name={currentUser.name} size={42} />}
        <button type="button" className={cx(styles.fake, hasDraft && styles.hasDraft)} onClick={() => openWith()}>
          {guest
            ? 'Đăng nhập để hỏi và chia sẻ với cộng đồng'
            : hasDraft ? form.title || 'Tiếp tục viết bài…' : `${firstName(currentUser.name)} ơi, hôm nay bạn muốn hỏi gì?`}
          {hasDraft && !guest && <span className={styles.draftTag}>Bản nháp</span>}
        </button>
      </div>
      <div className={styles.tools}>
        {onUpload && (
          <button type="button" className={styles.tool} onClick={() => openWith({ photo: true })}>
            <i className="bi bi-image" aria-hidden="true" />Ảnh
          </button>
        )}
        {onOpenVideoEditor && (
          <button type="button" className={styles.tool} onClick={guest ? onRequireLogin : onOpenVideoEditor}>
            <i className="bi bi-play-btn" aria-hidden="true" />Video
          </button>
        )}
        {onOpenBlogEditor && (
          <button type="button" className={styles.tool} onClick={guest ? onRequireLogin : () => onOpenBlogEditor(form)}>
            <i className="bi bi-journal-text" aria-hidden="true" />Viết blog
          </button>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Tạo bài viết"
        dismissible={!sending}
        footer={(
          <>
            {onOpenBlogEditor && (
              <Button variant="subtle" icon="arrows-angle-expand" onClick={goFullEditor} disabled={sending} className={styles.expand}>
                Viết blog đầy đủ
              </Button>
            )}
            <Button variant="subtle" onClick={() => setOpen(false)} disabled={sending}>Để sau</Button>
            <Button type="submit" form={formId} icon="send" loading={sending}>Đăng</Button>
          </>
        )}
      >
        <form id={formId} className={styles.form} onSubmit={submit} noValidate>
          {currentUser && (
            <div className={styles.who}>
              <Avatar src={currentUser.avatarUrl} name={currentUser.name} size={40} />
              <div>
                <b>{currentUser.name}</b>
                <span><i className="bi bi-journal-text" aria-hidden="true" /> Blog · hiển thị sau khi Admin duyệt</span>
              </div>
            </div>
          )}

          {prompts.length > 0 && !form.title.trim() && (
            <div className={styles.prompts} role="group" aria-label="Gợi ý câu mở đầu">
              {prompts.map((p) => (
                <Chip key={p.label} icon={p.icon} onClick={() => set('title')(p.text)}>{p.label}</Chip>
              ))}
            </div>
          )}

          <TextArea
            label="Câu hỏi hoặc điều bạn muốn chia sẻ"
            className={styles.main}
            value={form.title}
            onChange={set('title')}
            error={errors.title}
            maxLength={200}
            rows={2}
            maxRows={5}
            placeholder="Các bạn gợi ý cho mình hôm nay ăn gì với ạ?"
            required
            autoFocus
          />
          <TextArea
            label="Thêm chi tiết"
            hint="Không bắt buộc. Ví dụ: nhà còn nguyên liệu gì, nấu cho mấy người, kiêng gì."
            value={form.content}
            onChange={set('content')}
            maxLength={2000}
            rows={2}
            maxRows={8}
          />

          {showPhoto && onUpload && (
            <ImageUpload label="Ảnh" value={form.thumbnailUrl} onChange={set('thumbnailUrl')} onUpload={onUpload} ratio="16/9" />
          )}
          {!showPhoto && onUpload && (
            <Button variant="subtle" size="sm" icon="image" onClick={() => setShowPhoto(true)} className={styles.addPhoto}>Thêm ảnh</Button>
          )}

          <CategoryPicker
            label="Danh mục"
            options={categories}
            value={form.categoryIds}
            onChange={set('categoryIds')}
            max={maxCategories}
            error={errors.categoryIds}
            required
          />

          {serverError && <Notice tone="alert" title="Chưa đăng được">{serverError}</Notice>}
        </form>
      </Modal>
    </div>
  );
}
