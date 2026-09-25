import { useState } from 'react';
import styles from './kit.module.css';

/**
 * Khung cho mỗi mục trong Review Kit:
 * mã mục + tên + file + khi nào dùng + demo + bảng props + đoạn code cách dùng.
 *
 * @param {[name: string, type: string, def: string, desc: string][]} props  bảng thuộc tính
 */
export default function Section({ code, title, file, when, note, props, usage, children }) {
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
    <section id={code} className={styles.section} aria-labelledby={`${code}-title`}>
      <header className={styles.sectionHead}>
        <span className={styles.code}>{code}</span>
        <h3 id={`${code}-title`} className={styles.sectionTitle}>{title}</h3>
        {file && <code className={styles.file}>{file}</code>}
      </header>
      {when && <p className={styles.when}><b>Dùng khi:</b> {when}</p>}
      {note && <p className={styles.note}>{note}</p>}

      <div className={styles.demo}>{children}</div>

      {props?.length > 0 && (
        <details className={styles.props}>
          <summary><span><i className="bi bi-list-ul me-2" aria-hidden="true" />Thuộc tính (props)</span><i className="bi bi-chevron-down" aria-hidden="true" /></summary>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr><th scope="col">Prop</th><th scope="col">Kiểu</th><th scope="col">Mặc định</th><th scope="col">Ý nghĩa</th></tr>
              </thead>
              <tbody>
                {props.map(([name, type, def, desc]) => (
                  <tr key={name}>
                    <td><code>{name}</code></td>
                    <td><code className={styles.type}>{type}</code></td>
                    <td>{def ? <code>{def}</code> : <span className={styles.dash}>-</span>}</td>
                    <td>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

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

/** Nhãn nhỏ phía trên một nhóm demo. */
export function DemoLabel({ children }) {
  return <span className={styles.label}>{children}</span>;
}
