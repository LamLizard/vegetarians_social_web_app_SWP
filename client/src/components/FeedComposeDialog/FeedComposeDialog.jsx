// Khoi's code (01/11/2026): hộp Đăng bài của BẢNG TIN theo prototype v4 (src/v4/components/Dialogs.jsx → ComposeDialog).
// CHỨC NĂNG giữ y hệt CreatePostModal (Sprint 2 · UC-03 Blog, UC-04 Video), chỉ đổi giao diện:
//   D-05 Blog/Video · D-11 tiêu đề ≤ 255, nội dung bắt buộc, **đậm** *nghiêng*, Xem trước · D-12 ≥ 1 chủ đề
//   D-13 ảnh bìa không bắt buộc (JPG/PNG/WEBP ≤ 5MB, tải lên qua onUpload) · D-14 video bắt buộc link + mô tả
//   kiểm tra video có cho phát ở trang khác không (useYouTubeCheck) · requestId chống đăng trùng khi thử lại
//   đóng hộp vẫn giữ nháp, đăng thành công mới xoá.
// Vì sao là file MỚI: CreatePostModal còn dùng ở trang Sửa bài của Duy (đang sửa ở nhánh khác) → không đụng để tránh conflict.
// Khác CreatePostModal: mở sẵn đúng loại bài theo nút vừa bấm (ô chữ/Ảnh → Blog, Camera → Video), icon Ảnh cuộn tới ô Ảnh bìa;
//   không có nút "Để sau" (đóng bằng X / Esc / bấm ra ngoài, nháp vẫn giữ).
import { useEffect, useId, useRef, useState } from 'react';
import Avatar from '../Avatar/Avatar';
import Button from '../Button/Button';
import Modal from '../Modal/Modal';
import Notice from '../Notice/Notice';
import PostRichText from '../PostRichText/PostRichText';
import Spinner from '../Spinner/Spinner';
import YouTubeEmbed from '../YouTubeEmbed/YouTubeEmbed';
import cx from '../cx';
import { rules, validate, hasErrors, getYouTubeId } from '../../utils/validate';
import useYouTubeCheck, { youTubeCheckText } from '../../hooks/useYouTubeCheck';
import { createPostContentRequestId } from '../../utils/postContentRequest';
import CoverUpload from './CoverUpload';
import TopicPicker from './TopicPicker';
import s from './FeedComposeDialog.module.css';

const MAX_TITLE = 255; // = VARCHAR(255) của post.title
const POPULAR_TOPICS = 4; // số chủ đề trong nhóm "Hay dùng"
const TOPICS_COLLAPSE = 8; // nhóm "Tất cả" dài hơn → gập, nút "+N chủ đề"
const EMPTY = { postType: 'blog', title: '', content: '', youtubeUrl: '', thumbnailUrl: '', categoryIds: [] };
const TYPES = [
  { value: 'blog', label: 'Blog', icon: 'journal-text' },
  { value: 'video', label: 'Video', icon: 'play-btn' },
];

/**
 * @param {boolean} open · @param {() => void} onClose
 * @param {number} openKey   tăng mỗi lần mở → áp lại initialType/focus (nháp giữ nguyên)
 * @param {'blog'|'video'} [initialType='blog'] · @param {'cover'} [focus]   'cover' → cuộn tới ô Ảnh bìa
 * @param {{name, avatarUrl?}} user
 * @param {{status: 'idle'|'loading'|'ready'|'error', items: {id, name, postCount?}[], error?: string}} categories
 * @param {() => void} onRetryCategories
 * @param {(post: {postType, title, content, youtubeUrl?, thumbnailUrl?, categoryIds, requestId}) => Promise<void>} onSubmit
 *        Ném lỗi → hiện câu lỗi trong hộp, giữ nguyên nháp
 * @param {(file: File, opts) => Promise<string>} onUpload   tải ảnh bìa, trả về link
 */
export default function FeedComposeDialog({
  open, onClose, openKey = 0, initialType = 'blog', focus, user, categories, onRetryCategories, onSubmit, onUpload,
}) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(0); // số ảnh đang tải
  const [preview, setPreview] = useState(false);
  const [flash, setFlash] = useState(false);     // nháy viền ô Ảnh bìa khi mở từ icon Ảnh
  const [seenKey, setSeenKey] = useState(openKey);
  const formId = useId();
  const contentId = useId();
  const coverRef = useRef(null);
  const titleRef = useRef(null);
  const submissionRef = useRef(null);
  const busyRef = useRef(false);

  // Mỗi lần mở: đổi loại bài theo nút vừa bấm (cập nhật ngay lúc render, không cần effect)
  if (openKey !== seenKey) {
    setSeenKey(openKey);
    if (!sending) setForm((f) => (f.postType === initialType ? f : { ...f, postType: initialType }));
    setFlash(focus === 'cover');
  }

  // Sau khi Modal mở (showModal tự đặt focus vào nút X) → đưa con trỏ vào ô Tiêu đề; mở từ icon Ảnh thì cuộn tới Ảnh bìa
  useEffect(() => {
    if (!open) return undefined;
    const raf = requestAnimationFrame(() => {
      titleRef.current?.focus({ preventScroll: true });
      if (focus === 'cover') coverRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [open, openKey, focus]);

  const isVideo = form.postType === 'video';
  const videoId = isVideo ? getYouTubeId(form.youtubeUrl) : null;
  // Video có cho phát trên trang khác không — không cho thì khoá nút Đăng, ẩn khung xem trước
  const ytCheck = useYouTubeCheck(isVideo ? form.youtubeUrl : '');
  const ytText = youTubeCheckText(ytCheck);

  const set = (key) => (v) => {
    setForm((f) => ({ ...f, [key]: v }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    setServerError('');
  };

  const toggleTopic = (id) => {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.some((x) => String(x) === String(id)) ? f.categoryIds.filter((x) => String(x) !== String(id)) : [...f.categoryIds, id],
    }));
    if (errors.categoryIds) setErrors((e) => ({ ...e, categoryIds: undefined }));
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

  // ---- B / I: bọc phần chữ đang bôi đen bằng ** hoặc * ----
  const wrap = (mark, placeholder) => {
    const el = document.getElementById(contentId);
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const picked = value.slice(a, b) || placeholder;
    set('content')(`${value.slice(0, a)}${mark}${picked}${mark}${value.slice(b)}`);
    requestAnimationFrame(() => {
      const box = document.getElementById(contentId);
      box?.focus();
      box?.setSelectionRange(a + mark.length, a + mark.length + picked.length);
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
    if (busyRef.current || uploading > 0) return;
    const errs = validate(form, {
      title: [rules.required('Vui lòng nhập tiêu đề'), rules.maxLength(MAX_TITLE)],
      content: [rules.required(isVideo ? 'Vui lòng nhập mô tả cho video' : 'Vui lòng nhập nội dung bài viết')],
      youtubeUrl: isVideo ? [rules.required('Dán link video'), rules.youtubeUrl()] : [],
      categoryIds: [rules.minItems(1, 'Chọn ít nhất 1 chủ đề để mọi người dễ tìm')],
    });
    if (!errs.youtubeUrl && isVideo && ytCheck.rejected) errs.youtubeUrl = ytCheck.message;
    setErrors(errs);
    if (hasErrors(errs)) {
      // Form dài: cuộn tới lỗi đầu tiên
      requestAnimationFrame(() => document.getElementById(formId)?.querySelector('[aria-invalid="true"], [role="alert"]')
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      return;
    }

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
      // Tùng (I-AI-01): ID ổn định theo nháp → thử lại không tạo bài lần hai
      const signature = JSON.stringify({ ...data, categoryIds: [...data.categoryIds].sort() });
      if (submissionRef.current?.signature !== signature) {
        submissionRef.current = { signature, requestId: createPostContentRequestId() };
      }
      await onSubmit({ ...data, requestId: submissionRef.current.requestId });
      submissionRef.current = null;
      setForm(EMPTY);
      setErrors({});
      setPreview(false);
      onClose();
    } catch (err) {
      setServerError(err?.message || 'Chưa đăng được bài, vui lòng thử lại.');
    } finally {
      busyRef.current = false;
      setSending(false);
    }
  };

  const busy = sending || uploading > 0;
  // 4 chủ đề nhiều bài nhất → nhóm "Hay dùng" (postCount từ GET /api/categories)
  const popularIds = [...(categories?.items ?? [])]
    .filter((c) => c.postCount > 0)
    .sort((a, b) => b.postCount - a.postCount || a.name.localeCompare(b.name, 'vi'))
    .slice(0, POPULAR_TOPICS)
    .map((c) => c.id);
  const videoOk = videoId && !ytCheck.rejected && ytCheck.status !== 'checking';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Đăng bài mới"
      description="Bài viết sẽ được kiểm tra trước khi hiển thị."
      size="lg"
      dismissible={!sending}
      className={s.dialog}
      footer={(
        <>
          <span className={s.pending}><i className="bi bi-hourglass-split" aria-hidden="true" /> Bài sẽ hiển thị trên Bảng tin sau khi được duyệt.</span>
          <Button type="submit" form={formId} icon="send" loading={sending} disabled={uploading > 0 || (isVideo && ytCheck.rejected)}>
            {uploading > 0 ? 'Đang tải ảnh…' : 'Đăng bài'}
          </Button>
        </>
      )}
    >
      <form id={formId} className={s.form} onSubmit={submit} noValidate>
        {/* Người đăng + loại bài */}
        <div className={s.who}>
          <Avatar name={user?.name} src={user?.avatarUrl} size={42} />
          <div className={s.whoText}>
            <b>{user?.name}</b>
            <div className={s.seg} role="radiogroup" aria-label="Loại bài">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={form.postType === t.value}
                  className={cx(s.segBtn, form.postType === t.value && s.segOn)}
                  onClick={() => set('postType')(t.value)}
                  disabled={busy}
                >
                  <i className={`bi bi-${t.icon}`} aria-hidden="true" /> {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tiêu đề: ô lớn không viền — cảm giác "viết" chứ không phải "điền form" */}
        <div className={s.block}>
          <div className={s.titleWrap}>
            <textarea
              ref={titleRef}
              className={s.titleInput}
              rows={1}
              value={form.title}
              maxLength={MAX_TITLE}
              onChange={(e) => set('title')(e.target.value.replace(/\n/g, ' '))}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              placeholder={isVideo ? 'Tiêu đề video, vd: Cách làm chả lụa chay dai giòn tại nhà' : 'Tiêu đề, vd: Đậu hũ sốt cà chua 15 phút cho người mới ăn chay'}
              aria-label="Tiêu đề (bắt buộc)"
              aria-invalid={!!errors.title}
              disabled={sending}
            />
            <span className={s.counter} aria-hidden="true">{form.title.length}/{MAX_TITLE}</span>
          </div>
          {errors.title && <p className={s.err} role="alert">{errors.title}</p>}
        </div>

        {isVideo && (
          <div className={s.block}>
            <label className={s.label} htmlFor={`${formId}-yt`}>Link video<span className={s.req} aria-hidden="true">*</span></label>
            <div className={cx(s.urlBox, (errors.youtubeUrl || ytText.error) && s.invalid)}>
              <i className="bi bi-link-45deg" aria-hidden="true" />
              <input
                id={`${formId}-yt`}
                type="url"
                value={form.youtubeUrl}
                onChange={(e) => set('youtubeUrl')(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                aria-invalid={!!(errors.youtubeUrl || ytText.error)}
                disabled={sending}
              />
              {ytCheck.status === 'checking' && <Spinner size="sm" label="Đang kiểm tra video" />}
              {videoOk && <span className={s.ok}><i className="bi bi-check-circle-fill" aria-hidden="true" /> Hợp lệ</span>}
            </div>
            {errors.youtubeUrl || ytText.error
              ? <p className={s.err} role="alert">{errors.youtubeUrl || ytText.error}</p>
              : <p className={s.hint}>{ytText.hint || 'Dán link dạng youtube.com/watch?v=… hoặc youtu.be/…'}</p>}
            {videoId && !ytCheck.rejected && <YouTubeEmbed videoId={videoId} title={form.title || 'Xem trước video'} />}
          </div>
        )}

        <div className={s.block}>
          <div className={s.editorHead}>
            <label className={s.label} htmlFor={preview ? undefined : contentId}>
              {isVideo ? 'Mô tả video' : 'Nội dung'}<span className={s.req} aria-hidden="true">*</span>
            </label>
            <div className={s.tools} role="toolbar" aria-label="Định dạng nội dung">
              <button type="button" className={s.tool} onClick={() => wrap('**', 'chữ đậm')} disabled={preview || sending} title="In đậm (Ctrl+B)" aria-label="In đậm">
                <i className="bi bi-type-bold" aria-hidden="true" />
              </button>
              <button type="button" className={s.tool} onClick={() => wrap('*', 'chữ nghiêng')} disabled={preview || sending} title="In nghiêng (Ctrl+I)" aria-label="In nghiêng">
                <i className="bi bi-type-italic" aria-hidden="true" />
              </button>
              <button type="button" className={cx(s.tool, s.toolText, preview && s.toolOn)} onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
                <i className={`bi bi-${preview ? 'pencil' : 'eye'}`} aria-hidden="true" /> {preview ? 'Sửa' : 'Xem trước'}
              </button>
            </div>
          </div>
          {preview ? (
            <div className={s.previewBox} aria-live="polite">
              {form.content.trim() ? <PostRichText text={form.content} /> : <span className={s.hint}>Chưa có nội dung để xem trước.</span>}
            </div>
          ) : (
            <textarea
              id={contentId}
              className={cx(s.editor, errors.content && s.invalid)}
              rows={6}
              value={form.content}
              onChange={(e) => set('content')(e.target.value)}
              onKeyDown={onEditorKey}
              placeholder={isVideo ? 'Video hướng dẫn gì, cần chuẩn bị nguyên liệu nào…' : 'Chia sẻ công thức, mẹo nấu hoặc trải nghiệm ăn chay của bạn…'}
              aria-invalid={!!errors.content}
              required
              disabled={sending}
            />
          )}
          {errors.content
            ? <p className={s.err} role="alert">{errors.content}</p>
            : <p className={s.hint}>Bôi đen chữ rồi bấm B / I, hoặc gõ **đậm** · *nghiêng*.</p>}
        </div>

        <div ref={coverRef} className={cx(s.cover, flash && s.flash)} onAnimationEnd={() => setFlash(false)}>
          <CoverUpload
            hint={isVideo ? 'Bỏ trống thì dùng ảnh của video.' : 'JPG, PNG, WEBP · tối đa 5MB · khung 16:9'}
            value={form.thumbnailUrl}
            onChange={set('thumbnailUrl')}
            onUpload={upload}
            disabled={sending}
          />
        </div>

        {(categories?.status === 'loading' || categories?.status === 'idle') && <Spinner size="sm" label="Đang tải danh sách chủ đề…" showLabel />}
        {categories?.status === 'error' && (
          <Notice tone="alert" title="Không tải được danh sách chủ đề" action={{ label: 'Thử lại', onClick: onRetryCategories }}>
            {categories.error}
          </Notice>
        )}
        {categories?.status === 'ready' && (
          <TopicPicker
            options={categories.items}
            popularIds={popularIds}
            collapseAfter={TOPICS_COLLAPSE}
            value={form.categoryIds}
            onToggle={toggleTopic}
            error={errors.categoryIds}
            disabled={sending}
          />
        )}

        {/* Câu lỗi từ server đặt sát nút Đăng để người dùng thấy ngay */}
        {serverError && (
          <div ref={(el) => el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}>
            <Notice tone="alert" title="Chưa đăng được bài">{serverError}</Notice>
          </div>
        )}
      </form>
    </Modal>
  );
}
