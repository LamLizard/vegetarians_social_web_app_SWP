import cx from '../cx';
import { getLink } from '../link';
import { APP_NAME } from '../../constants/domain';
import logo from '../../assets/logo-for-all.png';
import styles from './AppShell.module.css';

/** Logo app. showName = hiện tên ứng dụng bên cạnh. */
export default function Logo({ href = '/', linkAs, showName = false, size = 44, className }) {
  const [Link, linkProps] = getLink(linkAs, href);
  return (
    <Link {...linkProps} className={cx(styles.logo, className)} aria-label={`${APP_NAME}, về trang chủ`}>
      <img className={styles.logoMark} src={logo} width={size} height={size} alt="" />
      {showName && <span className={styles.logoName}>{APP_NAME}</span>}
    </Link>
  );
}
