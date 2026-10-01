import { motion } from 'motion/react';
import { useCurrentUser } from '../../store/AppStore';
import { useChat } from '../assistant/ChatContext';
import { firstName } from '../../utils/format';
import { lunarLabel, nextVegDay, toLunar } from '../../utils/lunar';
import MoonPhase from './MoonPhase';
import styles from './today.module.css';

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

const greeting = (h) => (h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối');

/**
 * Đầu bảng tin: lời chào + ngày dương/âm + thẻ trăng báo ngày chay kế tiếp (mùng 1 / rằm).
 * Bấm thẻ trăng → Mầm gợi ý thực đơn cho ngày chay đó.
 */
export default function TodayHeader() {
  const me = useCurrentUser();
  const { askMam } = useChat();
  const now = new Date();
  const lunar = toLunar(now);
  const next = nextVegDay(now);

  const when = next.inDays === 0 ? 'Hôm nay là' : next.inDays === 1 ? 'Mai là' : `Còn ${next.inDays} ngày nữa là`;

  return (
    <section className={styles.header} aria-label="Hôm nay">
      <motion.div
        className={styles.hello}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className={styles.dateLine}>
          {WEEKDAYS[now.getDay()]}, {now.getDate()} tháng {now.getMonth() + 1}
          <span className={styles.dateLunar}>{lunarLabel(lunar)} âm lịch</span>
        </p>
        <h1 className={`display ${styles.greet}`}>{greeting(now.getHours())}, {firstName(me.fullName)}.</h1>
      </motion.div>

      <motion.button
        type="button"
        className={styles.moonCard}
        onClick={() => askMam(`Gợi ý thực đơn chay cho ${next.name}`)}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
      >
        <MoonPhase lunarDay={lunar.day} size={52} />
        <span className={styles.moonText}>
          <small>{when}</small>
          <b>{next.name}</b>
          <span className={styles.moonCta}>Ngày chay · nhờ Mầm lên thực đơn <i className="bi bi-arrow-right" aria-hidden="true" /></span>
        </span>
      </motion.button>
    </section>
  );
}
