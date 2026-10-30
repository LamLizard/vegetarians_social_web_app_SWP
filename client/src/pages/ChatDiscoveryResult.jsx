import Button from '../components/Button/Button';
import PostCard from '../components/PostCard/PostCard';
import RecipeCard from '../components/RecipeCard/RecipeCard';
import styles from './ChatDiscoveryResult.module.css';

const VALID_ID = /^[1-9]\d{0,17}$/;

// The parent supplies only results that the server has authorized for this viewer.
export default function ChatDiscoveryResult({ result, onLogin }) {
  if (result?.kind === 'login_required') {
    return (
      <div className={styles.locked}>
        <p>Đăng nhập để xem bài viết này.</p>
        <Button size="sm" onClick={onLogin}>Đăng nhập</Button>
      </div>
    );
  }

  const item = result?.item;
  const id = String(item?.id ?? '');
  if (!VALID_ID.test(id) || typeof item?.title !== 'string' || !item.title.trim()) return null;

  if (result.kind === 'post') {
    return (
      <div className={styles.result}>
        <PostCard layout="row" postType={item.type} title={item.title} excerpt={item.excerpt}
          href={`/feed?openPost=${encodeURIComponent(id)}`} thumbnailUrl={item.thumbnailUrl}
          author={{ name: item.author?.fullName, avatarUrl: item.author?.avatarUrl }}
          createdAt={item.publishedAt ?? item.createdAt} voteCount={item.voteCount}
          commentCount={item.commentCount} />
      </div>
    );
  }

  if (result.kind === 'recipe') {
    return (
      <div className={styles.result}>
        <RecipeCard layout="row" title={item.title} description={item.description}
          href={`/recipes/${encodeURIComponent(id)}`} imageUrl={item.thumbnailUrl}
          author={{ name: item.authorName, avatarUrl: item.authorAvatarUrl }}
          dishName={item.dishName} likeCount={item.likeCount} />
      </div>
    );
  }
  return null;
}
