import { useCallback, useEffect, useRef, useState } from 'react';
import Button from '../components/Button/Button';
import MemberLayout from '../components/MemberLayout/MemberLayout';
import Notice from '../components/Notice/Notice';
import PageHeader from '../components/PageHeader/PageHeader';
import Spinner from '../components/Spinner/Spinner';
import PostEditForm from './PostEditForm';
import postService from '../services/post.service';

const MY_POSTS_PATH = '/me/posts';

function postLoadMessage(error) {
  if (error?.status === 403) return 'Tài khoản của bạn không có quyền xem hoặc sửa bài viết này.';
  if (error?.status === 404) return 'Không tìm thấy bài viết hoặc bạn không có quyền truy cập.';
  return error?.message || 'Không tải được bài viết.';
}

export default function UserPostEditPage({ postId, user, accountMenu = [], shopAction }) {
  const [postState, setPostState] = useState({ status: 'loading', post: null, error: '' });
  const [categories, setCategories] = useState({ status: 'loading', items: [], error: '' });
  const [isDirty, setIsDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const dirtyRef = useRef(false);
  const pendingNavigationRef = useRef(null);
  const allowNavigationRef = useRef(false);
  const savingRef = useRef(false);
  const editUrlRef = useRef(window.location.href);

  const setDirty = useCallback((next) => {
    dirtyRef.current = next;
    setIsDirty(next);
  }, []);

  const loadCategories = useCallback(async () => {
    setCategories((current) => ({ ...current, status: 'loading', error: '' }));
    try {
      const result = await postService.getCategories();
      setCategories({ status: 'ready', items: result.items ?? [], error: '' });
    } catch (error) {
      setCategories({ status: 'error', items: [], error: error.message || 'Không tải được danh sách chủ đề.' });
    }
  }, []);

  useEffect(() => {
    let active = true;
    setPostState({ status: 'loading', post: null, error: '' });
    setCategories({ status: 'loading', items: [], error: '' });
    setDirty(false);

    postService.getMyPost(postId)
      .then((result) => {
        if (active) setPostState({ status: 'ready', post: result?.post ?? null, error: '' });
      })
      .catch((error) => {
        if (active) setPostState({ status: 'error', post: null, error: postLoadMessage(error) });
      });
    postService.getCategories()
      .then((result) => {
        if (active) setCategories({ status: 'ready', items: result.items ?? [], error: '' });
      })
      .catch((error) => {
        if (active) setCategories({ status: 'error', items: [], error: error.message || 'Không tải được danh sách chủ đề.' });
      });

    return () => { active = false; };
  }, [postId, setDirty]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const warnBeforeUnload = (event) => {
      if (!dirtyRef.current || allowNavigationRef.current || savingRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);

  const requestNavigation = useCallback((destination) => {
    if (!dirtyRef.current) {
      allowNavigationRef.current = true;
      if (destination === 'back') window.history.back();
      else window.location.assign(destination);
      return;
    }
    pendingNavigationRef.current = destination;
    setPendingNavigation(destination);
  }, []);

  useEffect(() => {
    const onDocumentClick = (event) => {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0
        || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin
        || `${target.pathname}${target.search}${target.hash}` === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
      event.preventDefault();
      pendingNavigationRef.current = anchor.href;
      setPendingNavigation(anchor.href);
    };
    const onPopState = () => {
      if (!dirtyRef.current || allowNavigationRef.current) return;
      window.history.pushState(window.history.state, '', editUrlRef.current);
      pendingNavigationRef.current = 'back';
      setPendingNavigation('back');
    };
    document.addEventListener('click', onDocumentClick, true);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('click', onDocumentClick, true);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  const leavePage = () => {
    const destination = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    setPendingNavigation(null);
    setDirty(false);
    allowNavigationRef.current = true;
    if (destination === 'back') window.history.back();
    else if (destination) window.location.assign(destination);
  };

  const save = async (data) => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      await postService.updateMyPost(postId, data);
    } catch (error) {
      savingRef.current = false;
      allowNavigationRef.current = false;
      setDirty(true);
      if (error?.status === 409 && error?.details?.code === 'PENDING_EDIT_EXISTS') {
        throw new Error('Bài viết đã có một bản sửa đang chờ duyệt. Nội dung bạn nhập vẫn được giữ lại; hãy tải lại trạng thái trước khi gửi tiếp.', { cause: error });
      }
      throw error;
    }
    setDirty(false);
    allowNavigationRef.current = true;
    window.location.assign(`${MY_POSTS_PATH}?editResult=success`);
  };

  const close = () => requestNavigation(MY_POSTS_PATH);
  const post = postState.post;
  const editState = post?.editState;
  const editStateAvailable = Boolean(editState && typeof editState.editable === 'boolean'
    && Object.prototype.hasOwnProperty.call(editState, 'pendingEdit')
    && (editState.pendingEdit === null || (typeof editState.pendingEdit === 'object' && editState.pendingEdit.id)));
  const hasPendingEdit = editStateAvailable && Boolean(editState.pendingEdit);

  return (
    <MemberLayout user={user} accountMenu={accountMenu} shopAction={shopAction}>
      <main className="container py-4" onInputCapture={() => setDirty(true)} onChangeCapture={() => setDirty(true)}>
        <PageHeader title="Sửa bài viết" description="Chỉ bài công khai mới có thể chỉnh sửa."
          breadcrumb={[{ label: 'Bảng tin', href: '/' }, { label: 'Bài của tôi', href: MY_POSTS_PATH }, { label: 'Sửa bài' }]}
          actions={<Button variant="subtle" onClick={close}>Quay lại bài của tôi</Button>} />

        {postState.status === 'loading' && <Spinner label="Đang tải bài viết…" showLabel />}
        {postState.status === 'error' && <Notice tone="alert" title="Không thể mở bài viết" action={{ label: 'Quay lại bài của tôi', onClick: close }}>{postState.error}</Notice>}

        {postState.status === 'ready' && !post && <Notice tone="alert" title="Không tìm thấy bài viết" action={{ label: 'Quay lại bài của tôi', onClick: close }}>
          Máy chủ không trả về bài viết để chỉnh sửa.
        </Notice>}

        {postState.status === 'ready' && post && !editStateAvailable && <Notice tone="info" title="Chưa thể sửa bài viết">
          Backend chưa trả `editState`; chức năng gửi bản sửa đang khóa cho tới khi contract được tích hợp.
        </Notice>}

        {postState.status === 'ready' && post && editStateAvailable && hasPendingEdit && <Notice tone="info" title="Đang có bản sửa chờ duyệt" action={{ label: 'Quay lại bài của tôi', onClick: close }}>
          Máy chủ xác nhận bài viết đang có bản sửa chờ. Bạn chưa thể gửi thêm bản sửa.
        </Notice>}

        {postState.status === 'ready' && post && editStateAvailable && !editState.editable && !hasPendingEdit && <Notice tone="info" title="Bài viết này hiện không thể sửa" action={{ label: 'Quay lại bài của tôi', onClick: close }}>
          {editState.reason === 'reported'
            ? 'Bài viết đang được Admin xử lý báo cáo; yêu cầu sửa chưa thể gửi.'
            : 'Máy chủ xác nhận bài viết hiện không cho phép chỉnh sửa.'}
        </Notice>}

        {categories.status === 'error' && <Notice tone="alert" title="Không tải được danh sách chủ đề" action={{ label: 'Thử lại', onClick: loadCategories }}>{categories.error}</Notice>}

        {postState.status === 'ready' && post && editStateAvailable && editState.editable && !hasPendingEdit && categories.status === 'ready'
          && <PostEditForm post={post} categories={categories}
            onDirty={() => setDirty(true)} onSubmit={save} onUpload={postService.uploadImage} />}

        {postState.status === 'ready' && post && editStateAvailable && editState.editable && !hasPendingEdit && categories.status === 'loading'
          && <Spinner size="sm" label="Đang tải danh sách chủ đề…" showLabel />}
      </main>

      {pendingNavigation && (
        <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(0,0,0,.55)' }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title" aria-describedby="unsaved-description"
            style={{ width: 'min(100%, 440px)', padding: 24, borderRadius: 12, background: 'var(--ac-card, #fff)', color: 'var(--ac-ink, #222)', boxShadow: '0 16px 48px rgba(0,0,0,.25)' }}>
            <h2 id="unsaved-title" style={{ fontSize: '1.2rem' }}>Bạn có thay đổi chưa lưu</h2>
            <p id="unsaved-description">Nếu rời trang, nội dung chỉnh sửa hiện tại sẽ không được lưu.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
              <Button variant="subtle" onClick={() => { pendingNavigationRef.current = null; setPendingNavigation(null); }}>Tiếp tục sửa</Button>
              <Button variant="alert" onClick={leavePage}>Rời đi</Button>
            </div>
          </section>
        </div>
      )}
    </MemberLayout>
  );
}
