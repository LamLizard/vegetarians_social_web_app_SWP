// Tùng: giữ wrapper popup và props cũ, dùng chung nội dung với trang chi tiết.
import Modal from '../Modal/Modal';
import PostDetailContent from '../PostDetailContent/PostDetailContent';
import styles from './PostDetailModal.module.css';

export default function PostDetailModal({ post, loading = false, loadingTitle = 'Đang tải bài viết', onClose, ...props }) {
  return (
    <Modal open={Boolean(post || loading)} onClose={onClose} title={post?.title || loadingTitle}
      size="lg" portal lockScroll className={styles.dialog}>
      <PostDetailContent post={post} loading={loading} {...props} />
    </Modal>
  );
}
