import { Link } from 'react-router-dom';
import { MacroProgress, MealCard, MicronutrientList, Photo } from '../../../components';
import { useApp, useCurrentUser } from '../../store/AppStore';
import { DIETS, DISCOVER_DISHES, MY_MICROS, PLAN_MEALS, TODAY_NUTRITION } from '../../store/mockData';
import DishMini from '../discover/DishMini';
import { useChat } from './ChatContext';
import styles from './mam.module.css';

// Bữa trong thực đơn ↔ món ở mục Khám phá (để nút lưu dùng chung trạng thái "Muốn nấu")
const MEAL_DISH = { breakfast: 'd5', lunch: 'd2', snack: 'd8', dinner: 'd1' };

/**
 * "Giao diện do AI tạo": mỗi câu trả lời của Mầm có thể kèm thẻ,
 * vẽ bằng chính component của kit thay vì chỉ là chữ.
 */
export default function MamCards({ cards }) {
  return (
    <div className={styles.cards}>
      {cards.map((card, i) => <Card key={i} card={card} />)}
    </div>
  );
}

function Card({ card }) {
  const { state, actions } = useApp();
  const me = useCurrentUser();
  const { ask } = useChat();

  switch (card.type) {
    case 'meals':
      return (
        <div className={styles.mealRow} role="list" aria-label="Thực đơn gợi ý">
          {PLAN_MEALS.map((m) => {
            const dishId = MEAL_DISH[m.slot];
            return (
              <div key={m.slot} className={styles.mealItem} role="listitem">
                <MealCard
                  {...m}
                  saved={me.savedDishes?.includes(dishId)}
                  onToggleSave={() => actions.toggleDish(dishId)}
                  onView={() => ask(`Cách làm ${m.title}?`)}
                />
              </div>
            );
          })}
        </div>
      );
    case 'micros':
      return (
        <section className={styles.cardBox}>
          <h4 className={styles.cardTitle}>Vi chất tuần này của bạn</h4>
          <MicronutrientList items={MY_MICROS} />
        </section>
      );
    case 'macros':
      return (
        <section className={styles.cardBox}>
          <h4 className={styles.cardTitle}>Hôm nay bạn đã nạp</h4>
          <MacroProgress items={TODAY_NUTRITION.items} />
        </section>
      );
    case 'places':
      return (
        <section className={styles.cardBox}>
          <h4 className={styles.cardTitle}>Quán đã xác minh</h4>
          <ul className={styles.places}>
            {state.restaurants.filter((r) => r.status === 'verified').map((r) => (
              <li key={r.id}>
                <Photo src={r.image?.replace('w=900', 'w=200')} alt="" className={styles.placeImg} />
                <span>
                  <b>{r.name} <i className="bi bi-patch-check-fill" title="Đã xác minh" aria-label="Đã xác minh" /></b>
                  <small>{r.address}</small>
                  <small><i className="bi bi-star-fill" aria-hidden="true" /> {String(r.rating).replace('.', ',')} · {DIETS[r.kind]?.label}</small>
                </span>
              </li>
            ))}
          </ul>
          <Link to="/explore/restaurants" className={styles.cardLink}>Xem bản đồ quán chay</Link>
        </section>
      );
    case 'dishes':
      return (
        <div className={styles.dishList}>
          {card.ids.map((id) => {
            const dish = DISCOVER_DISHES.find((d) => d.id === id);
            return dish ? <DishMini key={id} dish={dish} /> : null;
          })}
        </div>
      );
    default:
      return null;
  }
}
