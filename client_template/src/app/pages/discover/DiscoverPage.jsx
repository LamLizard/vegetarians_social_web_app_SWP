import { useCurrentUser } from '../../store/AppStore';
import { DISCOVER_DISHES } from '../../store/mockData';
import { useChat } from '../../features/assistant/ChatContext';
import SwipeDeck from '../../features/discover/SwipeDeck';
import DishMini from '../../features/discover/DishMini';
import { EmptyState } from '../../../components';
import styles from './discoverPage.module.css';

/** Khám phá – "Hôm nay nấu gì?": quẹt thẻ món cỡ lớn + danh sách Muốn nấu bên cạnh. */
export default function DiscoverPage() {
  const me = useCurrentUser();
  const { askMam } = useChat();
  const wanted = DISCOVER_DISHES.filter((d) => me.savedDishes?.includes(d.id));

  return (
    <div className={styles.page}>
      <section className={styles.main}>
        <h1 className={`display ${styles.title}`}>Hôm nay nấu gì?</h1>
        <p className={styles.sub}>Kéo thẻ sang phải để thêm vào Muốn nấu, sang trái để bỏ qua. Dùng phím ← → cũng được.</p>
        <SwipeDeck big />
      </section>

      <aside className={styles.side} aria-label="Danh sách muốn nấu">
        <div className={styles.sideHead}>
          <h2>Muốn nấu <span>{wanted.length}</span></h2>
          {wanted.length > 0 && (
            <button type="button" className={styles.link} onClick={() => askMam('Lập danh sách đi chợ cho thực đơn này')}>
              Nhờ Mầm lập danh sách đi chợ
            </button>
          )}
        </div>
        {wanted.length ? (
          <div className={styles.list}>{wanted.map((d) => <DishMini key={d.id} dish={d} />)}</div>
        ) : (
          <EmptyState icon="bookmark-heart" title="Chưa có món nào">Quẹt phải một món bạn thích để lưu vào đây.</EmptyState>
        )}
      </aside>
    </div>
  );
}
