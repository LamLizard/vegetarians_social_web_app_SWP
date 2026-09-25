import Avatar from '../Avatar/Avatar';
import IconButton from '../IconButton/IconButton';
import Menu from '../Menu/Menu';
import Photo from '../Photo/Photo';
import { RecipeFacts } from '../RecipeView/RecipeView';
import cx from '../cx';
import { getLink } from '../link';
import { timeAgo } from '../../utils/format';
import styles from './RecipeCard.module.css';

/**
 * Thẻ công thức (Recipe) của 1 thành viên cho 1 món (Dish).
 *  - layout="row" : danh sách công thức trong Dish Detail (M-13), "Công thức của tôi"
 *  - layout="card": lưới công thức nổi bật
 * Recipe không có vote và không có bước duyệt ở v4.0; người khác chỉ có thể Báo cáo (FR-24).
 *
 * @param {'row'|'card'} [layout='row']
 * @param {string} title                  recipe.title
 * @param {string} [description]          recipe.description (tối đa 2 dòng)
 * @param {string} [imageUrl]
 * @param {string} href · [linkAs]
 * @param {{name, avatarUrl?}} author
 * @param {string} [createdAt]
 * @param {number} [cookTimeMinutes] · [servings] · [calories]
 * @param {number} [ingredientCount]
 * @param {string} [dishName]             hiện "Món: …" khi thẻ nằm ngoài trang món (vd Công thức của tôi)
 * @param {boolean} [isOwner] + [onEdit] · [onDelete]   hoặc   [onReport] cho người khác
 */
export default function RecipeCard({
  layout = 'row', title, description, imageUrl, href = '#', linkAs, author = {}, createdAt,
  cookTimeMinutes, servings, calories, ingredientCount, dishName,
  isOwner = false, onEdit, onDelete, onReport, className,
}) {
  const [Link, linkProps] = getLink(linkAs, href);
  const items = isOwner
    ? [
      onEdit && { icon: 'pencil', label: 'Sửa công thức', onClick: onEdit },
      onDelete && { icon: 'trash3', label: 'Xoá công thức', tone: 'alert', onClick: onDelete },
    ].filter(Boolean)
    : [onReport && { icon: 'flag', label: 'Báo cáo công thức', hint: 'Gửi cho Admin xem xét', onClick: onReport }].filter(Boolean);

  const menu = items.length > 0 && (
    <Menu
      renderTrigger={(p) => <IconButton icon="three-dots" label="Tuỳ chọn công thức" variant="ghost" size="sm" {...p} />}
      items={items}
      width={220}
    />
  );

  return (
    <article className={cx(layout === 'card' ? styles.card : styles.row, className)}>
      <Link {...linkProps} className={styles.media} tabIndex={-1} aria-hidden="true">
        <Photo src={imageUrl} ratio={layout === 'card' ? '16/9' : '4/3'} shape="rounded" className={styles.img} />
      </Link>
      <div className={styles.body}>
        <div className={styles.top}>
          <div className={styles.titles}>
            {dishName && <span className={styles.dish}><i className="bi bi-bookmark" aria-hidden="true" /> {dishName}</span>}
            <h3 className={styles.title}><Link {...linkProps}>{title}</Link></h3>
          </div>
          {menu}
        </div>
        {description && <p className={styles.desc}>{description}</p>}
        <RecipeFacts cookTimeMinutes={cookTimeMinutes} servings={servings} calories={calories} size="sm" />
        <div className={styles.by}>
          <Avatar src={author.avatarUrl} name={author.name} size={22} />
          <span className={styles.author}>{isOwner ? 'Bạn' : author.name}</span>
          {createdAt && <time dateTime={createdAt}>· {timeAgo(createdAt)}</time>}
          {ingredientCount != null && <span className={styles.ing}><i className="bi bi-basket" aria-hidden="true" /> {ingredientCount} nguyên liệu</span>}
        </div>
      </div>
    </article>
  );
}
