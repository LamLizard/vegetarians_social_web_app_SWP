import Checkbox from '../Checkbox/Checkbox';
import IconButton from '../IconButton/IconButton';
import Menu from '../Menu/Menu';
import Photo from '../Photo/Photo';
import StatusBadge from '../StatusBadge/StatusBadge';
import cx from '../cx';
import { getLink } from '../link';
import { formatPrice } from '../../utils/format';
import styles from './ShopMenuItem.module.css';

/**
 * 1 món trong menu quán (shop_dish): gắn với 1 Dish, có giá, ghi chú thành phần, còn bán hay tạm hết.
 * Đặt trong <ul> (mỗi item là 1 <li>).
 *  - Khách xem (M-09): món tạm hết bị mờ + nhãn "Tạm hết".
 *  - Chủ quán (M-18, editable): công tắc "Đang bán" bật/tắt ngay + menu Sửa / Xoá.
 *
 * @param {string} name                dish.name (tên món chung)
 * @param {number} [price]             shop_dish.price, trống → "Liên hệ"
 * @param {string} [ingredientNote]    shop_dish.ingredient_note, vd "Không hành tỏi, có nấm đông cô"
 * @param {boolean} [showPhoto]       hiện ảnh món (dish.image_url) bên trái
 * @param {string} [imageUrl]
 * @param {boolean} [isAvailable=true] shop_dish.is_available
 * @param {string} [dishHref] · [linkAs]  bấm tên món → Dish Detail (M-13) xem công thức, quán khác
 * @param {boolean} [editable]         chế độ chủ quán
 * @param {(next: boolean) => void} [onToggleAvailable]
 * @param {boolean} [toggling]         đang gọi API bật/tắt → khoá công tắc
 * @param {() => void} [onEdit] · [onDelete]
 */
export default function ShopMenuItem({
  name, price, ingredientNote, showPhoto = false, imageUrl, isAvailable = true, dishHref, linkAs,
  editable = false, onToggleAvailable, toggling = false, onEdit, onDelete, className,
}) {
  const [Link, linkProps] = getLink(linkAs, dishHref);
  const items = [
    onEdit && { icon: 'pencil', label: 'Sửa món', onClick: onEdit },
    onDelete && { icon: 'trash3', label: 'Xoá khỏi menu', tone: 'alert', onClick: onDelete },
  ].filter(Boolean);

  return (
    <li className={cx(styles.item, !isAvailable && styles.off, className)}>
      {showPhoto && <Photo src={imageUrl} ratio="1/1" shape="leaf" className={styles.photo} />}
      <div className={styles.body}>
        <div className={styles.nameRow}>
          <span className={styles.name}>{dishHref ? <Link {...linkProps}>{name}</Link> : name}</span>
          {!isAvailable && !editable && <StatusBadge entity="shopDish" status="unavailable" size="sm" />}
        </div>
        {ingredientNote && <p className={styles.note}>{ingredientNote}</p>}
      </div>
      <span className={styles.price}>{formatPrice(price)}</span>
      {editable && (
        <div className={styles.owner}>
          <Checkbox switch checked={isAvailable} onChange={(v) => onToggleAvailable?.(v)} disabled={toggling}>
            <span className={styles.switchLabel}>{isAvailable ? 'Đang bán' : 'Tạm hết'}</span>
          </Checkbox>
          {items.length > 0 && (
            <Menu
              renderTrigger={(p) => <IconButton icon="three-dots" label={`Tuỳ chọn món ${name}`} variant="ghost" size="sm" {...p} />}
              items={items}
              width={200}
            />
          )}
        </div>
      )}
    </li>
  );
}
