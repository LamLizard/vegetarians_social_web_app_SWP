import Photo from '../components/Photo/Photo';
import styles from './ChatResultCards.module.css';

// Khoi's code (05/11/2026): thẻ công thức/quán thật của Green Bowl hiện dưới câu trả lời của Mầm.
const MAX_CARDS = 3;
const detailHref = (path, isGuest) => (isGuest ? `/login?next=${encodeURIComponent(path)}` : path);

// Khoi's code (13/11/2026): giá dạng 60.000đ; dòng món của thẻ quán (tìm theo món / hỏi menu một quán).
const formatPrice = (value) => (Number.isFinite(Number(value)) && Number(value) > 0
  ? `${Number(value).toLocaleString('vi-VN')}đ` : null);

function MenuHighlight({ value }) {
  if (value?.kind === 'dish' && value.name) {
    const price = formatPrice(value.price);
    return (
      <span className={styles.dish}>
        Có món: <b>{value.name}</b>{price && <> · <span className={styles.price}>{price}</span></>}
        {value.more > 0 && <span className={styles.more}> +{value.more} món khác</span>}
      </span>
    );
  }
  if (value?.kind === 'menu') {
    const price = formatPrice(value.minPrice);
    return (
      <span className={styles.dish}>
        {value.count > 0
          ? <>Menu: <b>{value.count} món</b>{price && <> · từ <span className={styles.price}>{price}</span></>}</>
          : 'Quán chưa cập nhật menu'}
      </span>
    );
  }
  return null;
}

// Khoi's code (14/11/2026): cảnh báo dị ứng (mockup B) — nhãn "Dị ứng" ở góc ảnh, viền đỏ, 1 dòng tên nguyên liệu.
const allergyNames = (value) => (Array.isArray(value)
  ? value.filter((name) => typeof name === 'string' && name.trim()).map((name) => name.trim()) : []);

function allergyText(item, isRecipe) {
  const names = allergyNames(isRecipe ? item.allergens : item.menuHighlight?.allergens);
  if (!names.length) return null;
  if (isRecipe) return `Có ${names.join(', ')}`;
  return item.menuHighlight?.kind === 'menu'
    ? `Có món chứa ${names.join(', ')}`
    : `Món có ${names.join(', ')} – hỏi lại quán`;
}

// Khoi's code (06/11/2026): lượt có thẻ nguồn/AI tạo thì đổi tiêu đề để nói rõ đây là món KHÁC.
// Khoi's code (13/11/2026): khách bấm thẻ → đăng nhập rồi vào thẳng quán/công thức (trang chi tiết cần đăng nhập).
export default function ChatResultCards({ cards, title, isGuest = false }) {
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
        {items.map((item) => {
          const allergy = allergyText(item, isRecipe);
          return (
          <li key={item.id} className={styles.card}>
            <a className={`${styles.link} ${allergy ? styles.allergic : ''}`}
              href={detailHref(`${isRecipe ? '/recipes' : '/shops'}/${encodeURIComponent(item.id)}`, isGuest)}>
              <span className={styles.thumbWrap}>
                <Photo src={isRecipe ? item.thumbnailUrl : item.avatarUrl} ratio="4/3" className={styles.thumb} />
                {allergy && (
                  <span className={styles.allergyChip}>
                    <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" /> Dị ứng
                  </span>
                )}
              </span>
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
                  <MenuHighlight value={item.menuHighlight} />
                </>
              )}
              {allergy && <span className={styles.allergyText}>{allergy}</span>}
            </a>
          </li>
          );
        })}
      </ul>
    </section>
  );
}
