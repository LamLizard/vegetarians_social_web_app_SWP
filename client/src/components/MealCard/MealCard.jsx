import Button from '../Button/Button';
import Chip from '../Chip/Chip';
import Photo from '../Photo/Photo';
import cx from '../cx';
import { getLink } from '../link';
import { MEAL_SLOT, NUTRITION_GROUP } from '../../constants/domain';
import { formatNumber } from '../../utils/format';
import styles from './MealCard.module.css';

/**
 * 1 bữa trong thực đơn (meal_plan_item) ở trang Kết quả Meal Plan (M-11).
 * Mỗi item phải map tới 1 Dish hợp lệ (FR-13) → bấm tên / "Xem món" mở Dish Detail để xem công thức.
 *
 * @param {'breakfast'|'lunch'|'dinner'|'snack'} slot  meal_plan_item.meal_slot
 * @param {string} dishName              meal_plan_item.dish_name (hoặc dish.name)
 * @param {string} [description]         lý do Mầm chọn món, tối đa 2 dòng
 * @param {number} [calories]            meal_plan_item.calories_kcal
 * @param {string} [nutritionGroup]      meal_plan_item.nutrition_group
 * @param {string} [imageUrl]            dish.image_url
 * @param {string} [dishHref] · [linkAs]
 * @param {boolean} [isSwapped] · [originalDishName]   đã đổi món → hiện "Đổi từ …"
 * @param {string} [warning]             món vi phạm dị ứng / kiêng (UC-09 thay thế) → viền đỏ + câu cảnh báo, nhắc đổi
 * @param {() => void} [onSwap]          mở hộp chọn món khác. Không truyền → thực đơn đã lưu chỉ xem
 * @param {boolean} [swapping]           đang đổi (chờ API) → nút xoay
 */
export default function MealCard({
  slot = 'breakfast', dishName, description, calories, nutritionGroup, imageUrl, dishHref, linkAs,
  isSwapped = false, originalDishName, warning, onSwap, swapping = false, className,
}) {
  const s = MEAL_SLOT[slot] ?? MEAL_SLOT.breakfast;
  const group = NUTRITION_GROUP[nutritionGroup];
  const [Link, linkProps] = getLink(linkAs, dishHref);

  return (
    <article className={cx(styles.card, warning && styles.hasWarning, className)}>
      <div className={styles.media}>
        <Photo src={imageUrl} ratio="16/10" />
        <span className={styles.slot}><i className={`bi bi-${s.icon}`} aria-hidden="true" />{s.label}</span>
        {calories != null && <span className={styles.kcal}>{formatNumber(calories)} kcal</span>}
      </div>
      <div className={styles.body}>
        {(group || isSwapped) && (
          <div className={styles.tags}>
            {group && <Chip icon={group.icon}>{group.label}</Chip>}
            {isSwapped && (
              <span className={styles.swapped} title={originalDishName ? `Món gốc: ${originalDishName}` : undefined}>
                <i className="bi bi-arrow-left-right" aria-hidden="true" /> Đã đổi{originalDishName ? ` từ ${originalDishName}` : ''}
              </span>
            )}
          </div>
        )}
        <h3 className={styles.title}>{dishHref ? <Link {...linkProps}>{dishName}</Link> : dishName}</h3>
        {description && <p className={styles.desc}>{description}</p>}
        {warning && (
          <p className={styles.warning} role="alert"><i className="bi bi-exclamation-triangle-fill" aria-hidden="true" /> {warning}</p>
        )}
        {(onSwap || dishHref) && (
          <div className={styles.actions}>
            {dishHref && <Button size="sm" variant="subtle" icon="journal-text" as={Link} {...linkProps}>Xem món</Button>}
            {onSwap && (
              <Button size="sm" variant={warning ? 'primary' : 'outline'} icon="arrow-left-right" onClick={onSwap} loading={swapping}>
                Đổi món
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
