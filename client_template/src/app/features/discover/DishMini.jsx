import { motion } from 'motion/react';
import { Photo } from '../../../components';
import cx from '../../../components/cx';
import { useApp, useCurrentUser } from '../../store/AppStore';
import { DIETS } from '../../store/mockData';
import styles from './discover.module.css';

/** Dòng món ăn nhỏ (ảnh + tên + thời gian/calo) có nút "Muốn nấu". */
export default function DishMini({ dish, className }) {
  const { actions } = useApp();
  const me = useCurrentUser();
  const saved = me.savedDishes?.includes(dish.id);

  return (
    <div className={cx(styles.mini, className)}>
      <Photo src={dish.image.replace('w=900', 'w=200')} alt="" className={styles.miniImg} />
      <div className={styles.miniText}>
        <b>{dish.title}</b>
        <small>{dish.time} · {dish.kcal} kcal</small>
        <small className={cx(styles.miniDiet, dish.diet !== 'vegan' && styles.miniDietEgg)}>
          <i className={`bi bi-${DIETS[dish.diet].icon}`} aria-hidden="true" /> {DIETS[dish.diet].label}
        </small>
      </div>
      <motion.button
        type="button"
        whileTap={{ scale: 0.85 }}
        className={cx(styles.miniSave, saved && styles.miniSaveOn)}
        aria-pressed={saved}
        aria-label={saved ? `Bỏ khỏi danh sách muốn nấu: ${dish.title}` : `Muốn nấu: ${dish.title}`}
        title={saved ? 'Bỏ khỏi "Muốn nấu"' : 'Muốn nấu'}
        onClick={() => actions.toggleDish(dish.id)}
      >
        <i className={`bi bi-${saved ? 'bookmark-heart-fill' : 'bookmark-heart'}`} aria-hidden="true" />
      </motion.button>
    </div>
  );
}
