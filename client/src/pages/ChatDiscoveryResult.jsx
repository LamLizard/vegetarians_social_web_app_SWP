import Avatar from '../components/Avatar/Avatar';
import Photo from '../components/Photo/Photo';
import styles from './ChatDiscoveryResult.module.css';

// Search results are display-only until a post detail page is available.
export default function ChatDiscoveryResult({ result }) {
  const item = result?.kind === 'post' ? result.item : null;
  if (!item || typeof item.title !== 'string' || !item.title.trim()) return null;
  return (
    <article className={styles.result}>
      {item.thumbnailUrl && <Photo src={item.thumbnailUrl} ratio="4/3" className={styles.image} />}
      <div className={styles.content}>
        <h3>{item.title}</h3>
        {item.excerpt && <p>{item.excerpt}</p>}
        <div className={styles.meta}>
          <Avatar src={item.author?.avatarUrl} name={item.author?.fullName || ''} size={24} />
          <span>{item.author?.fullName}</span>
          <span>{Number(item.voteCount) || 0} lượt thích</span>
        </div>
      </div>
    </article>
  );
}
