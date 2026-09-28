import { Link } from 'react-router-dom';
import cx from '../../components/cx';
import { APP_NAME } from '../config';
import styles from './shell.module.css';

/** Logo: ô bo góc lệch (nét riêng của app) + chiếc lá. showName = hiện chữ bên cạnh. */
export default function Logo({ to = '/', showName = false, size = 44, className }) {
  return (
    <Link to={to} className={cx(styles.logo, className)} aria-label={`${APP_NAME}, về trang chủ`}>
      <span className={styles.logoMark} style={{ width: size, height: size }}>
        <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} aria-hidden="true">
          <path d="M5 19c0-8 5-13.5 14-14-.3 8.6-5.6 14-14 14Z" fill="currentColor" />
          <path d="M5 19c3-4.2 6-7 9.5-9" stroke="var(--logo-vein)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </svg>
      </span>
      {showName && <span className={styles.logoName}>{APP_NAME}</span>}
    </Link>
  );
}
