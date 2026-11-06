import Photo from '../components/Photo/Photo';
import styles from './ChatSourceCard.module.css';

// Khoi's code (06/11/2026): thẻ nguồn công thức — NHÃN DO SERVER QUYẾT ĐỊNH, client chỉ hiển thị.
// recipe-source: Green Bowl có công thức → câu trả lời dựa trên dữ liệu đã duyệt.
// ai-generated: chưa có công thức → nội dung do AI viết, định lượng chỉ là ước tính.
export default function ChatSourceCard({ source }) {
  if (!source || typeof source !== 'object') return null;

  if (source.kind === 'ai-generated') {
    return (
      <div className={`${styles.card} ${styles.ai}`} role="note">
        <i className={`bi bi-stars ${styles.aiIcon}`} aria-hidden="true" />
        <p className={styles.aiText}>Nội dung do AI tạo vì Green Bowl chưa có công thức này. Bạn chỉ nên tham khảo; định lượng là ước tính.</p>
      </div>
    );
  }

  const item = source.kind === 'recipe-source' ? source.item : null;
  if (!item) return null;
  const meta = [
    Number.isFinite(item.minutes) ? `${item.minutes} phút` : null,
    Number.isFinite(item.caloriesKcal) ? `${item.caloriesKcal} kcal` : null,
    Number.isInteger(item.servings) ? `${item.servings} người` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className={styles.card}>
      {item.thumbnailUrl
        ? <Photo src={item.thumbnailUrl} ratio="1/1" shape="rounded" className={styles.thumb} />
        : <div className={styles.thumbFallback} aria-hidden="true"><i className="bi bi-flower3" /></div>}
      <div className={styles.body}>
        <span className={styles.badge}>
          <i className="bi bi-patch-check-fill" aria-hidden="true" /> Green Bowl đã kiểm duyệt
        </span>
        <p className={styles.title}>{item.title}</p>
        {meta && <p className={styles.meta}>{meta}</p>}
        {/* Khoi's code (06/11/2026): câu trả lời không nêu đủ định lượng (vd hỏi mẹo) thì không nói "dựa trên". */}
        <p className={styles.desc}>{source.quantityNote
          ? 'Công thức gốc của món này — xem để có đủ định lượng chính xác.'
          : 'Câu trả lời dựa trên công thức này.'}</p>
        <a className={styles.link} href={`/recipes/${encodeURIComponent(item.id)}`}>Xem công thức gốc</a>
      </div>
    </div>
  );
}
