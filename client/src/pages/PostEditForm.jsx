import { useId, useRef, useState } from 'react';
import Button from '../components/Button/Button';
import CategoryPicker from '../components/CategoryPicker/CategoryPicker';
import ImageUpload from '../components/ImageUpload/ImageUpload';
import Notice from '../components/Notice/Notice';
import PostRichText from '../components/PostRichText/PostRichText';
import RadioGroup from '../components/RadioGroup/RadioGroup';
import TextArea from '../components/TextArea/TextArea';
import TextField from '../components/TextField/TextField';
import YouTubeEmbed from '../components/YouTubeEmbed/YouTubeEmbed';
import useYouTubeCheck, { youTubeCheckText } from '../hooks/useYouTubeCheck';
import { getYouTubeId, hasErrors, rules, validate } from '../utils/validate';
import { createPostContentRequestId } from '../utils/postContentRequest';
import styles from '../components/CreatePostModal/CreatePostModal.module.css';

const MAX_TITLE = 255;
const TYPES = [
  { value: 'blog', label: 'Blog', icon: 'journal-text' },
  { value: 'video', label: 'Video', icon: 'play-btn' },
];

// Sao chép tối thiểu phần điều phối form/validation/editor/submit từ CreatePostModal:
// nội dung form không được export; các component và tiện ích dùng chung vẫn được import.
export default function PostEditForm({ post, categories, onDirty, onSubmit, onUpload }) {
  const [form, setForm] = useState(() => ({
    postType: post.postType,
    title: post.title ?? '',
    content: post.content ?? '',
    youtubeUrl: post.youtubeUrl ?? '',
    thumbnailUrl: post.thumbnailUrl ?? '',
    categoryIds: (post.categories ?? []).map((category) => String(category.id)),
  }));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [preview, setPreview] = useState(false);
  const contentId = useId();
  const pendingCaret = useRef(null);
  const submissionRef = useRef(null);
  const busyRef = useRef(false);

  const isVideo = form.postType === 'video';
  const videoId = isVideo ? getYouTubeId(form.youtubeUrl) : null;
  const ytCheck = useYouTubeCheck(isVideo ? form.youtubeUrl : '');
  const ytText = youTubeCheckText(ytCheck);
  const busy = sending || uploading > 0;

  const set = (key) => (value) => {
    setForm((current) => ({ ...current, [key]: value }));
    onDirty?.();
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
    setServerError('');
  };

  const upload = async (file, options) => {
    setUploading((count) => count + 1);
    try {
      return await onUpload(file, options);
    } finally {
      setUploading((count) => count - 1);
    }
  };

  const wrap = (mark, placeholder) => {
    const editor = document.getElementById(contentId);
    if (!editor) return;
    const { selectionStart: start, selectionEnd: end, value } = editor;
    const selected = value.slice(start, end) || placeholder;
    set('content')(`${value.slice(0, start)}${mark}${selected}${mark}${value.slice(end)}`);
    pendingCaret.current = [start + mark.length, start + mark.length + selected.length];
    requestAnimationFrame(() => {
      const box = document.getElementById(contentId);
      if (!box || !pendingCaret.current) return;
      box.focus();
      box.setSelectionRange(...pendingCaret.current);
      pendingCaret.current = null;
    });
  };

  const onEditorKey = (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === 'b') { event.preventDefault(); wrap('**', 'chữ đậm'); }
    if (key === 'i') { event.preventDefault(); wrap('*', 'chữ nghiêng'); }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busyRef.current || uploading > 0) return;
    const nextErrors = validate(form, {
      title: [rules.required('Vui lòng nhập tiêu đề'), rules.maxLength(MAX_TITLE)],
      content: [rules.required(isVideo ? 'Vui lòng nhập mô tả cho video' : 'Vui lòng nhập nội dung bài viết')],
      youtubeUrl: isVideo ? [rules.required('Dán link video YouTube'), rules.youtubeUrl()] : [],
      categoryIds: [rules.minItems(1, 'Chọn ít nhất 1 chủ đề')],
    });
    if (!nextErrors.youtubeUrl && isVideo && ytCheck.rejected) nextErrors.youtubeUrl = ytCheck.message;
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    busyRef.current = true;
    setSending(true);
    setServerError('');
    try {
      const data = {
        postType: form.postType,
        title: form.title.trim(),
        content: form.content.trim(),
        youtubeUrl: isVideo ? form.youtubeUrl.trim() : undefined,
        thumbnailUrl: form.thumbnailUrl || undefined,
        categoryIds: form.categoryIds,
      };
      const signature = JSON.stringify({ ...data, categoryIds: [...data.categoryIds].sort() });
      if (submissionRef.current?.signature !== signature) {
        submissionRef.current = { signature, requestId: createPostContentRequestId() };
      }
      await onSubmit({ ...data, requestId: submissionRef.current.requestId });
      submissionRef.current = null;
    } catch (error) {
      setServerError(error?.message || 'Chưa lưu được bài viết, vui lòng thử lại.');
    } finally {
      busyRef.current = false;
      setSending(false);
    }
  };

  const options = (categories?.items ?? []).map((category) => ({ value: String(category.id), label: category.name }));
  const popularIds = [...(categories?.items ?? [])]
    .filter((category) => category.postCount > 0)
    .sort((a, b) => b.postCount - a.postCount || a.name.localeCompare(b.name, 'vi'))
    .slice(0, 4)
    .map((category) => String(category.id));

  return (
    <form className={`${styles.form} post-edit-form`} onSubmit={submit} noValidate>
      <RadioGroup label="Loại bài" variant="segmented" options={TYPES} value={form.postType} onChange={set('postType')} disabled={busy} />
      <TextField label="Tiêu đề" value={form.title} onChange={set('title')} error={errors.title} maxLength={MAX_TITLE}
        placeholder={isVideo ? 'Ví dụ: Cách làm chả lụa chay dai giòn tại nhà' : 'Ví dụ: Đậu hũ sốt cà chua 15 phút'} required disabled={sending} />

      {isVideo && <>
        <TextField label="Link YouTube" type="url" icon="youtube" value={form.youtubeUrl} onChange={set('youtubeUrl')}
          error={errors.youtubeUrl || ytText.error} hint={ytText.hint || 'Dán link youtube.com/watch?v=… hoặc youtu.be/…'}
          placeholder="https://www.youtube.com/watch?v=..." required disabled={sending} />
        {videoId && !ytCheck.rejected && <YouTubeEmbed videoId={videoId} title={form.title || 'Xem trước video'} />}
      </>}

      <div className={styles.editor}>
        <label className={styles.label} htmlFor={preview ? undefined : contentId}>
          {isVideo ? 'Mô tả video' : 'Nội dung'}<span className={styles.req} aria-hidden="true">*</span>
        </label>
        <div className={styles.toolbar} role="toolbar" aria-label="Định dạng nội dung">
          <button type="button" className={styles.tool} onClick={() => wrap('**', 'chữ đậm')} disabled={preview || sending} title="In đậm (Ctrl+B)" aria-label="In đậm"><i className="bi bi-type-bold" aria-hidden="true" /></button>
          <button type="button" className={styles.tool} onClick={() => wrap('*', 'chữ nghiêng')} disabled={preview || sending} title="In nghiêng (Ctrl+I)" aria-label="In nghiêng"><i className="bi bi-type-italic" aria-hidden="true" /></button>
          <button type="button" className={`${styles.tool} ${preview ? styles.toolOn : ''}`} onClick={() => setPreview((value) => !value)} aria-pressed={preview}>
            <i className={`bi bi-${preview ? 'pencil' : 'eye'}`} aria-hidden="true" />&nbsp;{preview ? 'Sửa' : 'Xem trước'}
          </button>
          <span className={styles.toolbarHint}>**đậm** · *nghiêng*</span>
        </div>
        {preview ? <div className={styles.preview} aria-live="polite">
          {form.content.trim() ? <PostRichText text={form.content} /> : <span className={styles.previewEmpty}>Chưa có nội dung để xem trước.</span>}
        </div> : <TextArea id={contentId} value={form.content} onChange={set('content')} onKeyDown={onEditorKey} error={errors.content}
          rows={6} maxRows={16} placeholder={isVideo ? 'Mô tả video và nguyên liệu cần chuẩn bị…' : 'Chia sẻ công thức, mẹo nấu hoặc trải nghiệm ăn chay…'} required disabled={sending} />}
      </div>

      <ImageUpload label="Ảnh bìa" hint={isVideo ? 'Không bắt buộc. Bỏ trống thì dùng ảnh của video YouTube.' : 'Không bắt buộc. JPG, PNG, WEBP, tối đa 5MB.'}
        value={form.thumbnailUrl} onChange={set('thumbnailUrl')} onUpload={upload} ratio="16/9" disabled={sending} />
      <CategoryPicker label="Chủ đề" noun="chủ đề" popularIds={popularIds} collapseAfter={8} searchFrom={0} options={options}
        value={form.categoryIds} onChange={set('categoryIds')} error={errors.categoryIds}
        hint={`Đã chọn ${form.categoryIds.length}. Chủ đề giúp mọi người tìm bài dễ hơn.`} required disabled={sending} />

      {serverError && <div role="status"><Notice tone="alert" title="Chưa lưu được bài">{serverError}</Notice></div>}
      <p className={styles.pendingNote}>
        <i className="bi bi-hourglass-split" aria-hidden="true" /> Bài hiện tại vẫn hiển thị công khai trong thời gian bản sửa chờ duyệt. Nếu admin từ chối, bạn sẽ nhận thông báo kèm lý do.
      </p>
      <div className="d-flex justify-content-end pt-2">
        <Button type="submit" icon="send" loading={sending} disabled={uploading > 0 || (isVideo && ytCheck.rejected)}>
          {uploading > 0 ? 'Đang tải ảnh…' : 'Lưu thay đổi'}
        </Button>
      </div>
    </form>
  );
}
