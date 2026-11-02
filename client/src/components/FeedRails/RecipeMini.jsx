import Photo from '../Photo/Photo';
import cx from '../cx';
import s from './FeedRails.module.css';

const shortTitle = (t = '') => t.replace(/^Cách làm\s+/i, '');

/**
 * 1 dòng công thức nhỏ ở cột bên: ảnh · tên · thông tin · nút tim (recipe_like = "yêu thích").
 * @param {{id, title, thumbnailUrl, prepTimeMinutes?, cookTimeMinutes?, caloriesKcal?, likesThisWeek?, likedByMe?}} recipe
 * @param {number} [rank]   số thứ hạng (khối Nổi bật)
 * @param {'meta'|'week'} [info]
 * @param {(recipe) => void} [onLike]
 */
export default function RecipeMini({ recipe, rank, info = 'meta', onLike }) {
  const minutes = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
  const meta = info === 'week'
    ? `${recipe.likesThisWeek ?? 0} lượt thích tuần này`
    : [minutes > 0 && `${minutes} phút`, recipe.caloriesKcal && `${recipe.caloriesKcal} kcal`].filter(Boolean).join(' · ');
  const liked = !!recipe.likedByMe;
  const name = shortTitle(recipe.title);
  return (
    <li className={s.recipe}>
      <a className={s.recipeMain} href={`/recipes/${encodeURIComponent(recipe.id)}`}>
        <span className={s.recipeImg}>
          <Photo src={recipe.thumbnailUrl || undefined} alt="" ratio="1/1" />
          {rank && <b className={s.rank}>{rank}</b>}
        </span>
        <span className={s.recipeText}>
          <b>{name}</b>
          {meta && <small>{meta}</small>}
        </span>
      </a>
      {onLike && (
        <button
          type="button"
          className={cx(s.heart, liked && s.heartOn)}
          aria-pressed={liked}
          aria-label={liked ? `Bỏ yêu thích ${name}` : `Yêu thích ${name}`}
          title={liked ? 'Bỏ yêu thích' : 'Yêu thích'}
          onClick={() => onLike(recipe)}
        >
          <i className={`bi bi-heart${liked ? '-fill' : ''}`} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}
