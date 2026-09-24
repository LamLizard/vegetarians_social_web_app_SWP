import { useState } from 'react';
import Button from '../Button/Button';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import EmptyState from '../EmptyState/EmptyState';
import Skeleton from '../Skeleton/Skeleton';
import CommentComposer from './CommentComposer';
import CommentItem from './CommentItem';
import cx from '../cx';
import { formatNumber } from '../../utils/format';
import styles from './Comment.module.css';

/**
 * Khu bình luận hoàn chỉnh dưới bài (M-03, M-04): tiêu đề + ô viết + danh sách + xem thêm + xác nhận xoá.
 * Bình luận phẳng, mới nhất ở trên. Có sẵn id="binh-luan" để PostCard nhảy tới.
 *
 * @param {{id, author: {name, avatarUrl?}, content, createdAt, edited?, status?, isOwner?}[]} comments
 * @param {number} [total]                 tổng số bình luận (post.comment_count)
 * @param {{name, avatarUrl?}} [currentUser]  không có → khách
 * @param {(content) => Promise} onCreate
 * @param {(id, content) => Promise} [onUpdate]
 * @param {(id) => Promise} [onDelete]      đã có hộp xác nhận bên trong
 * @param {(id) => void} [onReport]         thường mở ReportDialog
 * @param {() => void} [onRequireLogin]
 * @param {boolean} [loading]               lần tải đầu
 * @param {boolean} [hasMore] · [loadingMore] · [onLoadMore]
 * @param {string} [id='binh-luan']       đổi khi 1 trang có 2 khu bình luận (hiếm)
 */
export default function CommentSection({
  comments = [], total, currentUser, onCreate, onUpdate, onDelete, onReport, onRequireLogin,
  loading = false, hasMore = false, loadingMore = false, onLoadMore, id = 'binh-luan', className,
}) {
  const [deleting, setDeleting] = useState(null); // id
  const [busy, setBusy] = useState(false);

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await onDelete?.(deleting);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const count = total ?? comments.length;

  return (
    <section id={id} className={cx(styles.section, className)} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.sectionTitle}>
        Bình luận <span>{formatNumber(count)}</span>
      </h2>

      <CommentComposer currentUser={currentUser} onSubmit={onCreate} onRequireLogin={onRequireLogin} />

      {loading ? (
        <div className={styles.list} aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className={styles.item}>
              <Skeleton shape="circle" width={34} />
              <div className={styles.main}><Skeleton width="30%" /><Skeleton lines={2} /></div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <EmptyState icon="chat-heart" title="Chưa có bình luận nào">Hãy là người đầu tiên chia sẻ cảm nhận về bài viết này.</EmptyState>
      ) : (
        <ul className={styles.list}>
          {comments.map((c) => (
            <li key={c.id}>
              <CommentItem
                {...c}
                onSave={onUpdate ? (text) => onUpdate(c.id, text) : undefined}
                onDelete={onDelete ? () => setDeleting(c.id) : undefined}
                onReport={onReport ? () => onReport(c.id) : undefined}
              />
            </li>
          ))}
        </ul>
      )}

      {hasMore && !loading && (
        <Button variant="subtle" size="sm" block onClick={onLoadMore} loading={loadingMore}>Xem thêm bình luận</Button>
      )}

      <ConfirmDialog
        open={deleting != null}
        title="Xoá bình luận này?"
        message="Bình luận sẽ bị gỡ khỏi bài viết."
        confirmLabel="Xoá bình luận"
        loading={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}
