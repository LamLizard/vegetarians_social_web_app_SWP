import cx from '../cx';
import { getLink } from '../link';
import { APP_NAME } from '../../constants/domain';
import styles from './AppShell.module.css';

/** Logo app: ô bo góc lệch + chiếc lá. showName = hiện chữ "Ăn Chay" bên cạnh. */
export default function Logo({ href = '/', linkAs, showName = false, size = 44, className }) {
  const [Link, linkProps] = getLink(linkAs, href);
  return (
    <Link {...linkProps} className={cx(styles.logo, className)} aria-label={`${APP_NAME}, về trang chủ`}>
      <span className={styles.logoMark} style={{ width: size, height: size }}>
        <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} aria-hidden="true">
          <path d="M5 19c0-8 5-13.5 14-14-.3 8.6-5.6 14-14 14Z" fill="currentColor" />
          <path d="M5 19c3-4.2 6-7 9.5-9" stroke="var(--ac-logo-vein)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </svg>
      </span>
      {showName && <span className={styles.logoName}>{APP_NAME}</span>}
    </Link>
  );
}
