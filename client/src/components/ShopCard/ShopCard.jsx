import Photo from '../Photo/Photo';
import StatusBadge from '../StatusBadge/StatusBadge';
import cx from '../cx';
import { getLink } from '../link';
import { formatNumber, formatPrice } from '../../utils/format';
import { formatHours, getOpenState } from '../../utils/time';
import styles from './ShopCard.module.css';

/** Link tìm địa chỉ trên Google Maps (không cần toạ độ; v4.0 không lưu lat/lng). */
export const mapsSearchUrl = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/**
 * Thẻ quán chay (Shop). Danh sách công khai chỉ có quán verified (BR-07), KHÔNG hiện khoảng cách/km.
 *  - layout="card": Danh sách Shop (M-08)
 *  - layout="row" : "Quán có món này" trong Dish Detail (UC-08), hàng chờ xác minh của admin
 *
 * @param {'card'|'row'} [layout='card']
 * @param {string} name · [imageUrl] · [address] · [phone]
 * @param {string} [openTime] · [closeTime]   "HH:mm" → tự tính Đang mở / Sắp đóng / Đã đóng
 * @param {Date} [now]                        giờ để tính (mặc định bây giờ; truyền vào khi test)
 * @param {string} href · [linkAs]            link tới Chi tiết Shop (M-09)
 * @param {number} [dishCount]                số món trong menu
 * @param {{name: string, price?: number}} [matchedDish]  UC-08: món người dùng đang tìm mà quán có bán
 * @param {string} [status] · [showStatus] · [moderationNote]  shop.verification_status, cho chủ quán / admin
 * @param {boolean} [showDirections=true]     link "Chỉ đường" mở Google Maps theo địa chỉ
 */
export default function ShopCard({
  layout = 'card', name, imageUrl, address, phone, openTime, closeTime, now, href = '#', linkAs,
  dishCount, matchedDish, status, showStatus = false, moderationNote, showDirections = true, className,
}) {
  const [Link, linkProps] = getLink(linkAs, href);
  const openState = getOpenState(openTime, closeTime, now);

  const hours = (
    <div className={styles.line}>
      <i className="bi bi-clock" aria-hidden="true" />
      <span className="visually-hidden">Giờ mở cửa: </span>
      <span className={openTime && closeTime ? styles.hours : undefined}>{formatHours(openTime, closeTime)}</span>
      {openState && <StatusBadge entity="shopOpen" status={openState} size="sm" />}
    </div>
  );
  const addr = address && (
    <div className={styles.line}>
      <i className="bi bi-geo-alt" aria-hidden="true" />
      <span className="visually-hidden">Địa chỉ: </span>
      <span className={styles.addr}>{address}</span>
    </div>
  );
  const matched = matchedDish && (
    <div className={styles.matched}>
      <i className="bi bi-check2-circle" aria-hidden="true" />
      <span>Có bán <b>{matchedDish.name}</b></span>
      <span className={styles.price}>{formatPrice(matchedDish.price)}</span>
    </div>
  );
  const extras = (dishCount != null || phone || (showDirections && address)) && (
    <div className={styles.foot}>
      {dishCount != null && <span><i className="bi bi-list-ul" aria-hidden="true" /> {formatNumber(dishCount)} món</span>}
      {phone && <a href={`tel:${phone.replace(/\s/g, '')}`}><i className="bi bi-telephone" aria-hidden="true" /> {phone}</a>}
      {showDirections && address && (
        <a href={mapsSearchUrl(address)} target="_blank" rel="noreferrer" className={styles.dir}>
          <i className="bi bi-sign-turn-right" aria-hidden="true" /> Chỉ đường<span className="visually-hidden"> (mở Google Maps)</span>
        </a>
      )}
    </div>
  );
  const badge = showStatus && status && <StatusBadge entity="shop" status={status} size="sm" />;
  const note = showStatus && moderationNote && status === 'rejected' && <p className={styles.note}><b>Lý do:</b> {moderationNote}</p>;

  return (
    <article className={cx(layout === 'row' ? styles.row : styles.card, openState === 'closed' && styles.isClosed, className)}>
      <Link {...linkProps} className={styles.media} tabIndex={-1} aria-hidden="true">
        <Photo src={imageUrl} ratio={layout === 'row' ? '1/1' : '16/9'} shape="rounded" className={styles.img} />
      </Link>
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h3 className={styles.name}><Link {...linkProps}>{name}</Link></h3>
          {badge}
        </div>
        {addr}
        {hours}
        {matched}
        {note}
        {extras}
      </div>
    </article>
  );
}
