import { NavLink } from 'react-router-dom';
import cx from '../../components/cx';
import { useCurrentUser } from '../store/AppStore';
import { useShell } from './ShellContext';
import styles from './shell.module.css';

const tab = ({ isActive }) => cx(styles.tab, isActive && styles.tabOn);

/** Thanh tab dưới đáy – chỉ hiện trên điện thoại (< 768px). */
export default function MobileTabs() {
  const me = useCurrentUser();
  const { openCompose } = useShell();
  return (
    <nav className={styles.tabbar} aria-label="Điều hướng nhanh">
      <NavLink to="/" end className={tab}><i className="bi bi-house-door" aria-hidden="true" />Bảng tin</NavLink>
      <NavLink to="/discover" className={tab}><i className="bi bi-compass" aria-hidden="true" />Khám phá</NavLink>
      <button type="button" className={styles.tabCreate} aria-label="Đăng bài mới" onClick={() => openCompose('share')}>
        <i className="bi bi-plus-lg" aria-hidden="true" />
      </button>
      <NavLink to="/assistant" className={tab}><i className="bi bi-flower1" aria-hidden="true" />Mầm AI</NavLink>
      <NavLink to={`/profile/${me.id}`} className={tab}><i className="bi bi-person-circle" aria-hidden="true" />Tôi</NavLink>
    </nav>
  );
}
