import cx from '../../../components/cx';
import { moonPhase } from '../../utils/lunar';
import styles from './today.module.css';

/**
 * Mặt trăng đúng pha theo ngày âm (1 = trăng non, 15 = trăng tròn).
 * Vẽ bằng 2 hình tròn: đĩa sáng + đĩa tối trượt ngang theo pha.
 */
export default function MoonPhase({ lunarDay, size = 56, className }) {
  const p = moonPhase(lunarDay);
  const x = p <= 0.5 ? -(p / 0.5) * size : size * (1 - (p - 0.5) / 0.5);
  return (
    <span
      className={cx(styles.moon, className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Trăng ngày ${lunarDay} âm lịch`}
    >
      <span className={styles.moonShadow} style={{ transform: `translateX(${x.toFixed(1)}px)` }} />
    </span>
  );
}
