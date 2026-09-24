import Chip from '../Chip/Chip';
import Photo from '../Photo/Photo';
import StatusBadge from '../StatusBadge/StatusBadge';
import cx from '../cx';
import { getLink } from '../link';
import { formatNumber } from '../../utils/format';
import styles from './DishCard.module.css';

/**
 * Thẻ món ăn dùng chung (Dish). Món là "danh mục món", mỗi món có nhiều công thức của cộng đồng (BR-09).
 *  - layout="card": danh mục món, kết quả tìm món, món liên quan
 *  - layout="row" : danh sách gọn (chọn món khi đổi món trong Meal Plan, hàng chờ duyệt Dish của admin, "Món tôi đề xuất")
 *
 * @param {'card'|'row'} [layout='card']
 * @param {string} name                 dish.name
 * @param {string} [description]        dish.description (card: tối đa 2 dòng)
 * @param {string} [imageUrl]           dish.image_url
 * @param {string} href · [linkAs]      link tới Dish Detail (M-13)
 * @param {{id, name}[]} [categories]   hiện tối đa 2
 * @param {number} [recipeCount] · [shopCount]  số công thức, số quán đang bán
 * @param {string} [status]             dish.status. Chỉ hiện khi showStatus (người đề xuất, admin)
 * @param {boolean} [showStatus]
 * @param {string} [moderationNote]     lý do từ chối / ẩn (hiện khi showStatus)
 * @param {React.ReactNode} [action]    nút bên phải ở dạng row, vd <Button size="sm">Chọn</Button>
 */
export default function DishCard({
  layout = 'card', name, description, imageUrl, href = '#', linkAs, categories = [],
  recipeCount, shopCount, status, showStatus = false, moderationNote, action, className,
}) {
  const [Link, linkProps] = getLink(linkAs, href);

  const stats = (recipeCount != null || shopCount != null) && (
    <span className={styles.stats}>
      {recipeCount != null && <span><i className="bi bi-journal-richtext" aria-hidden="true" />{formatNumber(recipeCount)} công thức</span>}
      {shopCount != null && <span><i className="bi bi-shop" aria-hidden="true" />{formatNumber(shopCount)} quán</span>}
    </span>
  );
  const badge = showStatus && status && <StatusBadge entity="dish" status={status} size="sm" />;
  const note = showStatus && moderationNote && (status === 'rejected' || status === 'hidden') && (
    <p className={styles.note}><b>Lý do:</b> {moderationNote}</p>
  );

  if (layout === 'row') {
    return (
      <article className={cx(styles.row, className)}>
        <Link {...linkProps} className={styles.rowMedia} tabIndex={-1} aria-hidden="true">
          <Photo src={imageUrl} ratio="1/1" shape="leaf" />
        </Link>
        <div className={styles.rowBody}>
          <h3 className={styles.rowName}><Link {...linkProps}>{name}</Link></h3>
          <div className={styles.rowMeta}>
            {categories[0] && <span>{categories.map((c) => c.name).slice(0, 2).join(' · ')}</span>}
            {stats}
          </div>
          {badge}
          {note}
        </div>
        {action && <div className={styles.action}>{action}</div>}
      </article>
    );
  }

  return (
    <article className={cx(styles.card, className)}>
      <Link {...linkProps} className={styles.media} tabIndex={-1} aria-hidden="true">
        <Photo src={imageUrl} ratio="4/3" shape="leaf" className={styles.img} />
        {badge && <span className={styles.badgeOnPhoto}>{badge}</span>}
      </Link>
      <div className={styles.body}>
        <h3 className={styles.name}><Link {...linkProps} className={styles.stretch}>{name}</Link></h3>
        {description && <p className={styles.desc}>{description}</p>}
        {categories.length > 0 && (
          <div className={styles.chips}>
            {categories.slice(0, 2).map((c) => <Chip key={c.id}>{c.name}</Chip>)}
            {categories.length > 2 && <span className={styles.more}>+{categories.length - 2}</span>}
          </div>
        )}
        {note}
        {stats && <div className={styles.foot}>{stats}</div>}
      </div>
    </article>
  );
}
