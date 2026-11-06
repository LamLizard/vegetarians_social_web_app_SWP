import Photo from '../components/Photo/Photo';
import styles from './ChatResultCards.module.css';

// Khoi's code (05/11/2026): thẻ công thức/quán thật của Green Bowl hiện dưới câu trả lời của Mầm.
const MAX_CARDS = 3;

// Khoi's code (06/11/2026): lượt có thẻ nguồn/AI tạo thì đổi tiêu đề để nói rõ đây là món KHÁC.
export default function ChatResultCards({ cards, title }) {
  const kind = cards?.kind;
  const items = Array.isArray(cards?.items) ? cards.items.slice(0, MAX_CARDS) : [];
  if (!items.length || (kind !== 'recipes' && kind !== 'shops')) return null;
  const isRecipe = kind === 'recipes';
  return (
    <section className={styles.wrap} aria-label={isRecipe ? 'Công thức gợi ý' : 'Quán chay gợi ý'}>
      <p className={styles.head}>{isRecipe
        ? (title || 'Công thức trên Green Bowl')
        : 'Quán chay trên Green Bowl'}</p>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.card}>
            <a className={styles.link} href={`${isRecipe ? '/recipes' : '/shops'}/${item.id}`}>
              <Photo src={isRecipe ? item.thumbnailUrl : item.avatarUrl} ratio="4/3" className={styles.thumb} />
              <span className={styles.title}>{isRecipe ? item.title : item.name}</span>
              {isRecipe ? (
                <span className={styles.meta}>
                  {[Number.isFinite(item.minutes) && item.minutes > 0 ? `${item.minutes} phút` : null,
                    Number.isFinite(item.caloriesKcal) ? `${item.caloriesKcal} kcal` : null].filter(Boolean).join(' · ')}
                </span>
              ) : (
                <>
                  {item.address && <span className={styles.meta}>{item.address}</span>}
                  <span className={styles.status}>{item.statusText}</span>
                </>
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
