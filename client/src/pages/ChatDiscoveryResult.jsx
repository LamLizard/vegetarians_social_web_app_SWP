import Avatar from '../components/Avatar/Avatar';
import Photo from '../components/Photo/Photo';
import styles from './ChatDiscoveryResult.module.css';
import { openPostDetail } from '../utils/postDetailNavigation';

// Khoi's code (05/11/2026): hiện tối đa 3 thẻ bài viết (server trả items đã xếp hạng, không random).
const MAX_CARDS = 3;
const validItem = (item) => item && /^[1-9]\d{0,17}$/.test(String(item.id))
  && typeof item.title === 'string' && Boolean(item.title.trim());

// Tùng: chỉ điều hướng khi người dùng chủ động mở kết quả member.
export default function ChatDiscoveryResult({ result }) {
  const raw = result?.kind === 'post'
    ? (Array.isArray(result.items) ? result.items : result.item ? [result.item] : [])
    : [];
  const items = raw.filter(validItem).slice(0, MAX_CARDS);
  if (!items.length) return null;
  return (
    <div className={styles.list}>
      {items.map((item) => (
        <article key={item.id} className={styles.result}>
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
      ))}
    </div>
  );
}
