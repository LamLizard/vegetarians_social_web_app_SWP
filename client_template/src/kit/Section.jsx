import { useState } from 'react';
import styles from './kit.module.css';

// Khung cho mỗi mục trong Review Kit: mã + tên + ghi chú + demo + đoạn code cách dùng.
export default function Section({ code, title, file, note, usage, children }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(usage);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* trình duyệt chặn clipboard – người dùng vẫn bôi đen copy tay được */
    }
  };

  return (
    <section id={code} className={styles.section}>
      <header className={styles.sectionHead}>
        <span className={styles.code}>{code}</span>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {file && <code className={styles.file}>{file}</code>}
      </header>
      {note && <p className={styles.note}>{note}</p>}

      <div className={styles.demo}>{children}</div>

      {usage && (
        <details className={styles.usage}>
          <summary>
            <span><i className="bi bi-code-slash me-2" aria-hidden="true" />Cách dùng</span>
            <button type="button" className={styles.copy} onClick={(e) => { e.preventDefault(); copy(); }}>
              <i className={`bi bi-${copied ? 'check2' : 'clipboard'} me-1`} aria-hidden="true" />
              {copied ? 'Đã copy' : 'Copy'}
            </button>
          </summary>
          <pre><code>{usage}</code></pre>
        </details>
      )}
    </section>
  );
}
