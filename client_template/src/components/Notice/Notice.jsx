import Button from '../Button/Button';
import cx from '../cx';
import styles from './Notice.module.css';

const TONES = {
  alert:   { icon: 'exclamation-triangle-fill', role: 'alert' },  // đất nung – cần người dùng xử lý
  success: { icon: 'check-circle-fill',        role: 'status' },
  info:    { icon: 'info-circle-fill',         role: 'status' },
};

/**
 * Thông báo trong trang (thiếu vi chất, đăng bài thành công, hướng dẫn...).
 * @param {'alert'|'success'|'info'} tone  "alert" chỉ dùng khi thật sự cần người dùng hành động
 * @param {string} title
 * @param {{label:string, onClick:()=>void}} action  (tuỳ chọn) nút hành động
 */
export default function Notice({ tone = 'info', title, action, className, children }) {
  const t = TONES[tone];
  return (
    <div className={cx(styles.notice, styles[tone], className)} role={t.role}>
      <i className={cx(`bi bi-${t.icon}`, styles.icon)} aria-hidden="true" />
      <div className={styles.body}>
        {title && <div className={styles.title}>{title}</div>}
        {children && <div className={styles.text}>{children}</div>}
        {action && (
          <Button
            size="sm"
            variant={tone === 'alert' ? 'alert' : 'outline'}
            className="mt-2"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}
