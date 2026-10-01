import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Avatar, Button, useToast } from '../../components';
import cx from '../../components/cx';
import { useApp, useCurrentUser } from '../store/AppStore';
import { DIETS } from '../store/mockData';
import { useChat } from '../features/assistant/ChatContext';
import { MamPanel } from '../features/assistant/MamPanel';
import NutritionRings from '../features/today/NutritionRings';
import SwipeDeck from '../features/discover/SwipeDeck';
import useMediaQuery from '../utils/useMediaQuery';
import { useShell } from './ShellContext';
import styles from './rail.module.css';

/** Khối "Hôm nay": vòng dinh dưỡng + thẻ quẹt món + gợi ý theo dõi */
export function TodayBlocks({ compact = false }) {
  const { state, actions } = useApp();
  const me = useCurrentUser();
  const { askMam } = useChat();
  const toast = useToast();
  const [skipped, setSkipped] = useState([]);

  const people = state.users
    .filter((u) => u.id !== me.id && u.role === 'member' && u.status === 'active' && !me.following.includes(u.id) && !skipped.includes(u.id))
    .slice(0, 3);

  return (
    <>
      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2>Dinh dưỡng hôm nay</h2>
          <button type="button" className={styles.link} onClick={() => askMam('Tối nay nên ăn gì cho đủ đạm?')}>Nhờ Mầm bù đạm</button>
        </div>
        <NutritionRings size={compact ? 116 : 128} />
      </section>

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2>Hôm nay nấu gì?</h2>
          <Link to="/discover" className={styles.link}>Mở rộng</Link>
        </div>
        <SwipeDeck />
      </section>

      {!compact && people.length > 0 && (
        <section className={styles.block}>
          <div className={styles.blockHead}><h2>Người cùng khẩu vị</h2></div>
          <ul className={styles.people}>
            {people.map((u) => (
              <li key={u.id}>
                <Link to={`/profile/${u.id}`}><Avatar name={u.fullName} src={u.avatar} size={40} /></Link>
                <span className={styles.personText}>
                  <Link to={`/profile/${u.id}`}>{u.fullName}</Link>
                  <small>{DIETS[u.diet]?.label} · chuỗi {u.streak} ngày</small>
                </span>
                <Button size="sm" variant="outline" onClick={() => { actions.toggleFollow(u.id); setSkipped((s) => [...s, u.id]); toast(`Đã theo dõi ${u.fullName}`); }}>
                  Theo dõi
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/**
 * Cột phải (≥ 1280px): 2 chế độ "Hôm nay" và "Mầm".
 * Bấm "Hỏi Mầm" ở bất kỳ đâu trên trang → cột tự chuyển sang Mầm thay vì mở cửa sổ chat mới.
 */
export default function RightRail() {
  const { mamOpen, setMamOpen } = useChat();
  const { setRailMam } = useShell();
  const wide = useMediaQuery('(min-width: 1280px)');

  useEffect(() => {
    setRailMam(wide);
    return () => setRailMam(false);
  }, [wide, setRailMam]);

  if (!wide) return null;
  const tab = mamOpen ? 'mam' : 'today';

  return (
    <aside className={styles.rail} aria-label="Hôm nay và trợ lý Mầm">
      <div className={styles.segment} role="tablist" aria-label="Cột phải">
        {[['today', 'Hôm nay', 'sun'], ['mam', 'Hỏi Mầm', 'flower1']].map(([key, label, icon]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={cx(styles.segBtn, tab === key && styles.segOn)} onClick={() => setMamOpen(key === 'mam')}>
            {tab === key && <motion.span layoutId="rail-seg" className={styles.segPill} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className={styles.segLabel}><i className={`bi bi-${icon}`} aria-hidden="true" /> {label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {tab === 'today' ? (
          <motion.div key="today" className={styles.railBody} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
            <TodayBlocks />
            <p className={styles.foot}>Quyền riêng tư · Điều khoản · <Link to="/kit">Review Kit</Link></p>
          </motion.div>
        ) : (
          <motion.div key="mam" className={styles.railMam} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
            <MamPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
