// Tùng — Sprint 2: thông báo thao tác Shop tự ẩn; lý do/trạng thái vẫn dùng Notice cố định.
import { useEffect, useRef, useState } from 'react';
import Notice from '../components/Notice/Notice';
import styles from './ShopOperationNotice.module.css';

export default function ShopOperationNotice({ message, onDismiss }) {
  const [fading, setFading] = useState(false);
  const dismiss = useRef(onDismiss);
  useEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    setFading(false);
    if (!message) return;
    const duration = message.tone === 'alert' ? 6000 : 3000;
    const remaining = duration - Math.max(0, Date.now() - (message.createdAt || Date.now()));
    const fadeTimer = window.setTimeout(() => setFading(true), Math.max(0, remaining));
    const closeTimer = window.setTimeout(() => dismiss.current?.(), Math.max(0, remaining + 350));
    return () => { window.clearTimeout(fadeTimer); window.clearTimeout(closeTimer); };
  }, [message]);
  if (!message) return null;
  return <div className={`${styles.notice} ${fading ? styles.fading : ''}`}>
    <Notice tone={message.tone || 'success'} onDismiss={onDismiss}>{message.text}</Notice>
  </div>;
}
