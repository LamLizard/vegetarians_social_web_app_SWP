import { Link } from 'react-router-dom';
import { EmptyState } from '../../components';
import { useApp, useCurrentUser } from '../store/AppStore';
import PostCard from '../features/posts/PostCard';
import RightRail from '../layouts/RightRail';
import styles from './simple.module.css';

/** Bài đã lưu của người dùng. */
export default function SavedPage() {
  const { state } = useApp();
  const me = useCurrentUser();
  const saved = state.posts
    .filter((p) => p.savedBy.includes(me.id) && p.status === 'public')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className={styles.page}>
      <div className={styles.col}>
        <header className={styles.head}>
          <h1 className="display">Đã lưu</h1>
          <p>{saved.length} bài viết · chỉ mình bạn nhìn thấy danh sách này</p>
        </header>
        {saved.map((p) => <PostCard key={p.id} post={p} />)}
        {saved.length === 0 && (
          <div className={styles.box}>
            <EmptyState icon="bookmark" title="Chưa lưu bài nào" action={<Link to="/" className="btn btn-primary">Về bảng tin</Link>}>
              Mở menu "…" trên bài viết và chọn Lưu để xem lại công thức, review quán sau này.
            </EmptyState>
          </div>
        )}
      </div>
      <RightRail />
    </div>
  );
}
