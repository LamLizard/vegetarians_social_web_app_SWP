import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { IconButton } from '../../../components';
import cx from '../../../components/cx';
import { useChat } from './ChatContext';
import MamThread from './MamThread';
import MamComposer from './MamComposer';
import styles from './mam.module.css';

/** Khối Mầm hoàn chỉnh: đầu khung + hội thoại + ô nhập. Dùng trong cột phải và ngăn kéo. */
export function MamPanel({ onClose, className }) {
  const { newConversation, messages, typing, setMamOpen } = useChat();
  const navigate = useNavigate();

  return (
    <section className={cx(styles.panel, className)} aria-label="Trợ lý Mầm">
      <header className={styles.panelHead}>
        <span className={styles.headMark} aria-hidden="true">
          <i className="bi bi-flower1" />
          <span className={styles.online} />
        </span>
        <div className={styles.headText}>
          <b>Mầm</b>
          <small>Trợ lý dinh dưỡng · thường trả lời trong vài giây</small>
        </div>
        <IconButton variant="ghost" size="sm" icon="arrow-counterclockwise" label="Cuộc trò chuyện mới" onClick={newConversation} disabled={!messages.length || typing} />
        <IconButton variant="ghost" size="sm" icon="arrows-angle-expand" label="Mở toàn trang" onClick={() => { setMamOpen(false); navigate('/assistant'); }} />
        {onClose && <IconButton variant="ghost" size="sm" icon="x-lg" label="Đóng Mầm" onClick={onClose} />}
      </header>
      <MamThread variant="rail" />
      <MamComposer autoFocus={!!onClose} />
    </section>
  );
}

/** Ngăn kéo Mầm trượt từ phải – dùng khi trang không có cột phải (màn hình nhỏ, trang hồ sơ…). */
export function MamDrawer({ open }) {
  const { setMamOpen } = useChat();
  const close = () => setMamOpen(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={styles.scrim}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            aria-hidden="true"
          />
          <motion.div
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Trợ lý Mầm"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          >
            <MamPanel onClose={close} className={styles.drawerPanel} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
