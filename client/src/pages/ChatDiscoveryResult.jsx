import Avatar from '../components/Avatar/Avatar';
import Photo from '../components/Photo/Photo';
import styles from './ChatDiscoveryResult.module.css';
import { openPostDetail } from '../utils/postDetailNavigation';

// Tùng: chỉ điều hướng khi người dùng chủ động mở kết quả member.
export default function ChatDiscoveryResult({ result }) {
  const item = result?.kind === 'post' ? result.item : null;
  if (!item || !/^[1-9]\d{0,17}$/.test(String(item.id)) || typeof item.title !== 'string' || !item.title.trim()) return null;
  return (
    <article className={styles.result}>
      {item.thumbnailUrl && <Photo src={item.thumbnailUrl} ratio="4/3" className={styles.image} />}
      <div className={styles.content}>
        <h3><a href={`/posts/${item.id}`} onClick={(event) => openPostDetail(event, item.id)}>{item.title}</a></h3>
        {item.excerpt && <p>{item.excerpt}</p>}
        <div className={styles.meta}>
          <Avatar src={item.author?.avatarUrl} name={item.author?.fullName || ''} size={24} />
          <span>{item.author?.fullName}</span>
          {Number.isInteger(item.voteCount) && item.voteCount >= 0 && <span>{item.voteCount} lượt thích</span>}
        </div>
      </div>
    </article>
  );
}
