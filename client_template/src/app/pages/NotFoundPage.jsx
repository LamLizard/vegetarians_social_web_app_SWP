import { Link } from 'react-router-dom';
import { EmptyState } from '../../components';
import styles from './simple.module.css';

/** 404. embedded = nằm trong khung có dock (vd: hồ sơ không tồn tại). */
export default function NotFoundPage({ embedded = false }) {
  return (
    <div className={embedded ? styles.center : styles.full}>
      <div className={styles.box}>
        <EmptyState icon="signpost-split" title="Không tìm thấy trang" action={<Link to="/" className="btn btn-primary">Về trang chủ</Link>}>
          Liên kết có thể đã hỏng hoặc trang đã bị xoá.
        </EmptyState>
      </div>
    </div>
  );
}
