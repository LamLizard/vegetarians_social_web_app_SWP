import { useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { Button, Photo, useToast } from '../../../components';
import cx from '../../../components/cx';
import { useApp, useCurrentUser } from '../../store/AppStore';
import { DIETS, DISCOVER_DISHES } from '../../store/mockData';
import { MacroBar } from '../posts/PostCard';
import styles from './discover.module.css';

const THRESHOLD = 110;

function DeckCard({ dish, depth, onDecide, big }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-14, 14]);
  const likeOpacity = useTransform(x, [30, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-120, -30], [1, 0]);
  const isTop = depth === 0;

  return (
    <motion.div
      className={styles.card}
      style={{ x, rotate, zIndex: 10 - depth }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.85}
      onDragEnd={(_, info) => {
        if (info.offset.x > THRESHOLD || info.velocity.x > 650) onDecide('right');
        else if (info.offset.x < -THRESHOLD || info.velocity.x < -650) onDecide('left');
      }}
      initial={{ scale: 0.9, y: 30, opacity: 0 }}
      animate={{ scale: 1 - depth * 0.05, y: depth * 14, opacity: depth > 2 ? 0 : 1 }}
      exit="exit"
      variants={{
        exit: (dir) => ({ x: dir === 'right' ? 520 : -520, rotate: dir === 'right' ? 18 : -18, opacity: 0, transition: { duration: 0.35 } }),
      }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      aria-hidden={!isTop}
    >
      <Photo src={dish.image} alt={dish.title} className={cx(styles.cardImg, big && styles.cardImgBig)} draggable={false} />
      <motion.span className={cx(styles.stamp, styles.stampLike)} style={{ opacity: likeOpacity }} aria-hidden="true">Muốn nấu</motion.span>
      <motion.span className={cx(styles.stamp, styles.stampNope)} style={{ opacity: nopeOpacity }} aria-hidden="true">Bỏ qua</motion.span>
      <div className={styles.cardBody}>
        <div className={styles.cardMeta}>
          <span className={cx(styles.diet, dish.diet !== 'vegan' && styles.dietEgg)}>
            <i className={`bi bi-${DIETS[dish.diet].icon}`} aria-hidden="true" /> {DIETS[dish.diet].label}
          </span>
          <span>{dish.time} · {dish.kcal} kcal</span>
        </div>
        <h3 className={styles.cardTitle}>{dish.title}</h3>
        {big && <p className={styles.cardNote}>{dish.note}</p>}
        {big && <MacroBar macros={dish.macros} />}
      </div>
    </motion.div>
  );
}

/**
 * Bộ thẻ "Hôm nay nấu gì?": kéo phải = muốn nấu (lưu), kéo trái = bỏ qua.
 * Có nút bấm + phím ← → để dùng không cần kéo (trợ năng).
 * @param {boolean} big  true = bản lớn ở trang Khám phá (hiện mô tả + macro)
 */
export default function SwipeDeck({ big = false }) {
  const { actions } = useApp();
  const me = useCurrentUser();
  const toast = useToast();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [dir, setDir] = useState('right');

  const current = DISCOVER_DISHES[index];
  const visible = DISCOVER_DISHES.slice(index, index + 3);

  const decide = (d) => {
    if (!current) return;
    setDir(d);
    if (d === 'right' && !me.savedDishes?.includes(current.id)) {
      actions.toggleDish(current.id);
      toast(`Đã thêm "${current.title}" vào Muốn nấu`);
    }
    setHistory((h) => [...h, { id: current.id, dir: d, wasSaved: me.savedDishes?.includes(current.id) }]);
    setIndex((i) => i + 1);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    if (last.dir === 'right' && !last.wasSaved) actions.toggleDish(last.id);
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => i - 1);
  };

  return (
    <div
      className={cx(styles.deck, big && styles.deckBig)}
      tabIndex={0}
      aria-label="Hôm nay nấu gì? Dùng phím mũi tên trái để bỏ qua, phải để lưu món"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); decide('right'); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); decide('left'); }
      }}
    >
      <div className={styles.stack}>
        <AnimatePresence custom={dir} initial={false}>
          {visible.map((d, i) => (
            <DeckCard key={d.id} dish={d} depth={i} onDecide={decide} big={big} />
          )).reverse()}
        </AnimatePresence>

        {!current && (
          <motion.div className={styles.done} initial={reduce ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
            <i className="bi bi-basket2" aria-hidden="true" />
            <b>Bạn đã xem hết món hôm nay</b>
            <span>{me.savedDishes?.length ?? 0} món trong danh sách Muốn nấu</span>
            <Button size="sm" variant="outline" icon="arrow-counterclockwise" onClick={() => { setIndex(0); setHistory([]); }}>Xem lại từ đầu</Button>
          </motion.div>
        )}
      </div>

      <div className={styles.controls}>
        <motion.button type="button" whileTap={{ scale: 0.88 }} className={cx(styles.ctl, styles.ctlNope)} onClick={() => decide('left')} disabled={!current} aria-label="Bỏ qua món này">
          <i className="bi bi-x-lg" aria-hidden="true" />
        </motion.button>
        <motion.button type="button" whileTap={{ scale: 0.88 }} className={cx(styles.ctl, styles.ctlUndo)} onClick={undo} disabled={!history.length} aria-label="Hoàn tác">
          <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />
        </motion.button>
        <motion.button type="button" whileTap={{ scale: 0.88 }} className={cx(styles.ctl, styles.ctlLike)} onClick={() => decide('right')} disabled={!current} aria-label="Muốn nấu món này">
          <i className="bi bi-bookmark-heart-fill" aria-hidden="true" />
        </motion.button>
      </div>
    </div>
  );
}
