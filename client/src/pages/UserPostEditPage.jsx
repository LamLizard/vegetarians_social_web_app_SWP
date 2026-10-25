// Duy's Code: Trang sửa dùng lại modal nhập bài Sprint 2 để giữ validation và style nhất quán.
import { useEffect, useState } from 'react';
import Button from '../components/Button/Button';
import MemberLayout from '../components/MemberLayout/MemberLayout';
import Notice from '../components/Notice/Notice';
import PageHeader from '../components/PageHeader/PageHeader';
import Spinner from '../components/Spinner/Spinner';
import CreatePostModal from '../components/CreatePostModal/CreatePostModal';
import postService from '../services/post.service';

// Duy's Code: Mã bài được đọc từ route và mọi quyền sở hữu vẫn được kiểm tra lại phía server.
export default function UserPostEditPage({ postId, user, accountMenu = [], shopAction }) {
  const [state, setState] = useState({ status: 'loading', post: null, categories: { status: 'loading', items: [] }, error: '' });

  // Duy's Code: Nạp nội dung bài và danh mục đang hoạt động cho form dùng chung.
  useEffect(() => {
    let active = true;
    Promise.all([postService.getMyPost(postId), postService.getCategories()])
      .then(([postResult, categoryResult]) => {
        if (active) setState({ status: 'ready', post: postResult.post, categories: { status: 'ready', items: categoryResult.items }, error: '' });
      })
      .catch((error) => { if (active) setState({ status: 'error', post: null, categories: { status: 'error', items: [] }, error: error.message || 'Không tải được bài viết.' }); });
    return () => { active = false; };
  }, [postId]);

  // Duy's Code: Lưu xong quay về danh sách; lỗi được CreatePostModal hiển thị ngay trên form.
  const save = async (data) => {
    await postService.updateMyPost(postId, data);
    window.location.assign('/me/posts');
  };

  const close = () => window.location.assign('/me/posts');

  return (
    <MemberLayout user={user} accountMenu={accountMenu} shopAction={shopAction}>
      <main className="container py-4">
        <PageHeader title="Sửa bài viết" description="Chỉ bài đang chờ duyệt mới có thể chỉnh sửa."
          breadcrumb={[{ label: 'Bảng tin', href: '/' }, { label: 'Bài của tôi', href: '/me/posts' }, { label: 'Sửa bài' }]}
          actions={<Button variant="subtle" onClick={close}>Quay lại bài của tôi</Button>} />
        {state.status === 'loading' && <Spinner label="Đang tải bài viết…" showLabel />}
        {state.status === 'error' && <Notice tone="alert" title="Không thể mở bài viết" action={{ label: 'Quay lại bài của tôi', onClick: close }}>{state.error}</Notice>}
        {state.status === 'ready' && <CreatePostModal open onClose={close} initialPost={state.post}
          categories={state.categories} onRetryCategories={() => {}}
          onSubmit={save} onUpload={postService.uploadImage} />}
      </main>
    </MemberLayout>
  );
}
