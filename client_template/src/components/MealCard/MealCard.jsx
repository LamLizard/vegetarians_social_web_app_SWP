import Button from '../Button/Button';
import Tag from '../Tag/Tag';
import HighlightChip from '../HighlightChip/HighlightChip';
import cx from '../cx';
import styles from './MealCard.module.css';

const SLOT_ICONS = { breakfast: 'sunrise', lunch: 'sun', snack: 'cup-hot', dinner: 'moon-stars' };
const SLOT_LABELS = { breakfast: 'Bữa sáng', lunch: 'Bữa trưa', snack: 'Bữa phụ', dinner: 'Bữa tối' };

/**
 * Thẻ món ăn trong thực đơn tuần.
 * @param {'breakfast'|'lunch'|'snack'|'dinner'} slot  loại bữa (khớp 4 meal_slot trong database)
 * @param {string} time          giờ ăn, vd "07:00"
 * @param {string} image         URL ảnh; bỏ trống → nền màu thay thế
 * @param {number} kcal
 * @param {string} tag           nhãn nổi bật, vd "Giàu đạm thực vật"
 * @param {string} cookTime      vd "15 phút"
 * @param {{protein:number,carb:number,fat:number}} macros  đơn vị gram
 * @param {boolean} isNew        món mới → hiện chip "MỚI" (điểm nhấn duy nhất của thẻ)
 * @param {boolean} saved        đã lưu vào "Đã lưu"
 * Đổi món: không đổi từng thẻ – trang Thực đơn tuần có 1 nút "Đổi thực đơn ngày" đổi cả 4 bữa cùng lúc.
 */
export default function MealCard({
  slot = 'breakfast',
  time,
  image,
  kcal,
  tag,
  cookTime,
  title,
  description,
  macros,
  isNew = false,
  saved = false,
  onView,
  onToggleSave,
  className,
}) {
  return (
    <article className={cx(styles.card, className)}>
      <div className={styles.media}>
        {image ? <img src={image} alt="" className={styles.img} /> : <div className={styles.placeholder} />}
        <span className={styles.slot}>
          <i className={`bi bi-${SLOT_ICONS[slot]}`} aria-hidden="true" />
          {SLOT_LABELS[slot]}{time && ` · ${time}`}
        </span>
        {isNew && <HighlightChip variant="new" className={styles.newChip}>Mới</HighlightChip>}
        {kcal != null && <span className={styles.kcal}>{kcal} kcal</span>}
      </div>

      <div className={styles.body}>
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          {tag && <Tag>{tag}</Tag>}
          {cookTime && (
            <span className="small text-body-secondary">
              <i className="bi bi-clock me-1" aria-hidden="true" />{cookTime}
            </span>
          )}
        </div>
        <h3 className={styles.title}>{title}</h3>
        {description && <p className={styles.desc}>{description}</p>}

        {macros && (
          <dl className={styles.macros}>
            <div><dt><span className={styles.dot} style={{ background: 'var(--ac-protein)' }} />Đạm</dt><dd>{macros.protein}g</dd></div>
            <div><dt><span className={styles.dot} style={{ background: 'var(--ac-carb)' }} />Carbs</dt><dd>{macros.carb}g</dd></div>
            <div><dt><span className={styles.dot} style={{ background: 'var(--ac-fat)' }} />Béo</dt><dd>{macros.fat}g</dd></div>
          </dl>
        )}

        <div className={styles.actions}>
          <Button size="sm" icon="journal-text" className="flex-grow-1" onClick={onView}>Xem công thức</Button>
          <Button
            size="sm"
            variant="subtle"
            icon={saved ? 'bookmark-fill' : 'bookmark'}
            iconOnly
            aria-label={saved ? 'Bỏ lưu món' : 'Lưu món'}
            aria-pressed={saved}
            title={saved ? 'Bỏ lưu' : 'Lưu món'}
            onClick={onToggleSave}
          />
        </div>
      </div>
    </article>
  );
}
