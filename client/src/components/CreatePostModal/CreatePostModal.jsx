// Khoi's code: Hộp thoại Đăng bài đầy đủ (Sprint 2 · UC-03 Blog, UC-04 Video).
// Theo "Quyết định Sprint 2 – Đăng bài":
//   D-05 Blog + Video · D-11 tiêu đề ≤ 255, nội dung bắt buộc, có **đậm** *nghiêng* · D-12 ít nhất 1 tag
//   D-13 ảnh bìa không bắt buộc · D-14 video bắt buộc mô tả · D-10 đăng xong ở lại trang, báo "đang chờ duyệt".
// Component KHÔNG gọi API: trang truyền categories, onSubmit, onUpload (giống các component khác trong kit).
// Nháp được giữ khi đóng hộp (state nằm ngoài Modal); đăng thành công mới xoá.
import { useId, useRef, useState } from 'react';
import Button from '../Button/Button';
import CategoryPicker from '../CategoryPicker/CategoryPicker';
import ImageUpload from '../ImageUpload/ImageUpload';
import Modal from '../Modal/Modal';
import Notice from '../Notice/Notice';
import PostRichText from '../PostRichText/PostRichText';
import RadioGroup from '../RadioGroup/RadioGroup';
import Spinner from '../Spinner/Spinner';
import TextArea from '../TextArea/TextArea';
import TextField from '../TextField/TextField';
import YouTubeEmbed from '../YouTubeEmbed/YouTubeEmbed';
import { rules, validate, hasErrors, getYouTubeId } from '../../utils/validate';
import styles from './CreatePostModal.module.css';

const MAX_TITLE = 255; // = VARCHAR(255) của post.title
const EMPTY = { postType: 'blog', title: '', content: '', youtubeUrl: '', thumbnailUrl: '', categoryIds: [] };
const TYPES = [
  { value: 'blog', label: 'Blog', icon: 'journal-text' },
  { value: 'video', label: 'Video', icon: 'play-btn' },
];

/**
 * @param {boolean} open · @param {() => void} onClose
 * @param {{status: 'loading'|'ready'|'error', items: {id: string, name: string}[], error?: string}} categories
 * @param {() => void} onRetryCategories
 * @param {(post: {postType, title, content, youtubeUrl?, thumbnailUrl?, categoryIds}) => Promise<void>} onSubmit
 *        Ném lỗi → hiện câu lỗi trong hộp, giữ nguyên nháp
 * @param {(file: File, opts) => Promise<string>} onUpload  tải ảnh bìa, trả về link
 */
export default function CreatePostModal({ open, onClose, categories, onRetryCategories, onSubmit, onUpload }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(0); // số ảnh đang tải
  const [preview, setPreview] = useState(false);
  const formId = useId();
  const contentId = useId();
  const pendingCaret = useRef(null);

  const isVideo = form.postType === 'video';
  const videoId = isVideo ? getYouTubeId(form.youtubeUrl) : null;

  const set = (key) => (v) => {
    setForm((f) => ({ ...f, [key]: v }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    setServerError('');
  };

  // Bọc onUpload để biết còn ảnh đang tải → chưa cho bấm Đăng (tránh đăng bài thiếu ảnh bìa)
  const upload = async (file, opts) => {
    setUploading((n) => n + 1);
    try {
      return await onUpload(file, opts);
    } finally {
      setUploading((n) => n - 1);
    }
  };

  // ---- Nút B / I: bọc phần chữ đang bôi đen bằng ** hoặc * ----
  const wrap = (mark, placeholder) => {
    const el = document.getElementById(contentId);
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const picked = value.slice(s, e) || placeholder;
    const next = `${value.slice(0, s)}${mark}${picked}${mark}${value.slice(e)}`;
    set('content')(next);
    // Chọn lại phần chữ vừa bọc để người dùng gõ đè được ngay
    pendingCaret.current = [s + mark.length, s + mark.length + picked.length];
    requestAnimationFrame(() => {
      const box = document.getElementById(contentId);
      if (!box || !pendingCaret.current) return;
      box.focus();
      box.setSelectionRange(...pendingCaret.current);
      pendingCaret.current = null;
    });
  };
  const onEditorKey = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); wrap('**', 'chữ đậm'); }
    if (k === 'i') { e.preventDefault(); wrap('*', 'chữ nghiêng'); }
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(form, {
      title: [rules.required('Vui lòng nhập tiêu đề'), rules.maxLength(MAX_TITLE)],
      content: [rules.required(isVideo ? 'Vui lòng nhập mô tả cho video' : 'Vui lòng nhập nội dung bài viết')],
      youtubeUrl: isVideo ? [rules.required('Dán link video YouTube'), rules.youtubeUrl()] : [],
      categoryIds: [rules.minItems(1, 'Chọn ít nhất 1 tag để mọi người dễ tìm')],
    });
    setErrors(errs);
    if (hasErrors(errs)) return;

    setSending(true);
    setServerError('');
    try {
      await onSubmit({
        postType: form.postType,
        title: form.title.trim(),
        content: form.content.trim(),
        youtubeUrl: isVideo ? form.youtubeUrl.trim() : undefined,
        thumbnailUrl: form.thumbnailUrl || undefined,
        categoryIds: form.categoryIds,
      });
      setForm(EMPTY);
      setErrors({});
      setPreview(false);
      onClose();
    } catch (err) {
      setServerError(err?.message || 'Chưa đăng được bài, vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  };

  const busy = sending || uploading > 0;
  const options = (categories?.items ?? []).map((c) => ({ value: c.id, label: c.name }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Đăng bài mới"
      description="Bài sẽ hiện trên Bảng tin sau khi Admin duyệt."
      size="lg"
      dismissible={!sending}
      footer={(
        <>
          <Button variant="subtle" onClick={onClose} disabled={sending}>Để sau</Button>
          <Button type="submit" form={formId} icon="send" loading={sending} disabled={uploading > 0}>
            {uploading > 0 ? 'Đang tải ảnh…' : 'Đăng bài'}
          </Button>
        </>
      )}
    >
      <form id={formId} className={styles.form} onSubmit={submit} noValidate>
        <RadioGroup
          label="Loại bài"
          variant="segmented"
          options={TYPES}
          value={form.postType}
          onChange={set('postType')}
          disabled={busy}
        />

        <TextField
          label="Tiêu đề"
          value={form.title}
          onChange={set('title')}
          error={errors.title}
          maxLength={MAX_TITLE}
          placeholder={isVideo ? 'Ví dụ: Cách làm chả lụa chay dai giòn tại nhà' : 'Ví dụ: Đậu hũ sốt cà chua 15 phút cho người mới ăn chay'}
          required
          disabled={sending}
          autoFocus
        />

        {isVideo && (
          <>
            <TextField
              label="Link YouTube"
              type="url"
              icon="youtube"
              value={form.youtubeUrl}
              onChange={set('youtubeUrl')}
              error={errors.youtubeUrl}
              hint="Dán link dạng youtube.com/watch?v=… hoặc youtu.be/…"
              placeholder="https://www.youtube.com/watch?v=..."
              required
              disabled={sending}
            />
            {videoId && <YouTubeEmbed videoId={videoId} title={form.title || 'Xem trước video'} />}
          </>
        )}

        <div className={styles.editor}>
          <label className={styles.label} htmlFor={preview ? undefined : contentId}>
            {isVideo ? 'Mô tả video' : 'Nội dung'}<span className={styles.req} aria-hidden="true">*</span>
          </label>
          <div className={styles.toolbar} role="toolbar" aria-label="Định dạng nội dung">
            <button type="button" className={styles.tool} onClick={() => wrap('**', 'chữ đậm')} disabled={preview || sending} title="In đậm (Ctrl+B)" aria-label="In đậm">
              <i className="bi bi-type-bold" aria-hidden="true" />
            </button>
            <button type="button" className={styles.tool} onClick={() => wrap('*', 'chữ nghiêng')} disabled={preview || sending} title="In nghiêng (Ctrl+I)" aria-label="In nghiêng">
              <i className="bi bi-type-italic" aria-hidden="true" />
            </button>
            <button type="button" className={`${styles.tool} ${preview ? styles.toolOn : ''}`} onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
              <i className={`bi bi-${preview ? 'pencil' : 'eye'}`} aria-hidden="true" />&nbsp;{preview ? 'Sửa' : 'Xem trước'}
            </button>
            <span className={styles.toolbarHint}>**đậm** · *nghiêng*</span>
          </div>
          {preview ? (
            <div className={styles.preview} aria-live="polite">
              {form.content.trim() ? <PostRichText text={form.content} /> : <span className={styles.previewEmpty}>Chưa có nội dung để xem trước.</span>}
            </div>
          ) : (
            <TextArea
              id={contentId}
              value={form.content}
              onChange={set('content')}
              onKeyDown={onEditorKey}
              error={errors.content}
              rows={6}
              maxRows={16}
              placeholder={isVideo ? 'Video hướng dẫn gì, cần chuẩn bị nguyên liệu nào…' : 'Chia sẻ công thức, mẹo nấu hoặc trải nghiệm ăn chay của bạn…'}
              required
              disabled={sending}
            />
          )}
        </div>

        <ImageUpload
          label="Ảnh bìa"
          hint={isVideo ? 'Không bắt buộc. Bỏ trống thì dùng ảnh của video YouTube.' : 'Không bắt buộc. JPG, PNG, WEBP, tối đa 5MB.'}
          value={form.thumbnailUrl}
          onChange={set('thumbnailUrl')}
          onUpload={upload}
          ratio="16/9"
          disabled={sending}
        />

        {categories?.status === 'loading' && <Spinner size="sm" label="Đang tải danh sách tag…" showLabel />}
        {categories?.status === 'error' && (
          <Notice tone="alert" title="Không tải được danh sách tag" action={{ label: 'Thử lại', onClick: onRetryCategories }}>
            {categories.error}
          </Notice>
        )}
        {categories?.status === 'ready' && (
          <CategoryPicker
            label="Tag"
            options={options}
            value={form.categoryIds}
            onChange={set('categoryIds')}
            error={errors.categoryIds}
            hint="Chọn ít nhất 1 tag."
            required
            disabled={sending}
          />
        )}

        {/* Câu lỗi từ server đặt sát nút Đăng để người dùng thấy ngay (form dài, đầu form có thể đã cuộn khuất) */}
        {serverError && (
          <div ref={(el) => el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}>
            <Notice tone="alert" title="Chưa đăng được bài">{serverError}</Notice>
          </div>
        )}

        <p className={styles.pendingNote}>
          <i className="bi bi-hourglass-split" aria-hidden="true" /> Sau khi đăng, bài ở trạng thái <b>chờ duyệt</b> và chỉ hiện trên Bảng tin khi Admin duyệt.
        </p>
      </form>
    </Modal>
  );
}
