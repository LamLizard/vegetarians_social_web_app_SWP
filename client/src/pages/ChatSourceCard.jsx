import Photo from '../components/Photo/Photo';
import styles from './ChatSourceCard.module.css';

// Khoi's code (06/11/2026): thẻ nguồn công thức — NHÃN DO SERVER QUYẾT ĐỊNH, client chỉ hiển thị.
// recipe-source: Green Bowl có công thức → câu trả lời dựa trên dữ liệu đã duyệt.
// ai-generated: chưa có công thức → nội dung do AI viết, định lượng chỉ là ước tính.
export default function ChatSourceCard({ source }) {
  if (!source || typeof source !== 'object') return null;

  if (source.kind === 'ai-generated') {
    // Khoi's code (14/11/2026): reason 'suggestions' = Mầm tự gợi ý món vì Green Bowl không có thêm công thức phù hợp.
    return (
      <div className={`${styles.card} ${styles.ai}`} role="note">
        <i className={`bi bi-stars ${styles.aiIcon}`} aria-hidden="true" />
        <p className={styles.aiText}>{source.reason === 'suggestions'
          ? <><b>Gợi ý do AI tạo</b> vì Green Bowl không có thêm công thức phù hợp. Bạn chỉ nên tham khảo; các món này chưa được Green Bowl kiểm duyệt.</>
          : 'Nội dung do AI tạo vì Green Bowl chưa có công thức này. Bạn chỉ nên tham khảo; định lượng là ước tính.'}</p>
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
  // Khoi's code (14/11/2026): công thức nguồn có nguyên liệu trùng dị ứng → vẫn hiện, kèm cảnh báo (mockup B).
  const allergens = Array.isArray(item.allergens)
    ? item.allergens.filter((name) => typeof name === 'string' && name.trim()) : [];

  return (
    <div className={`${styles.card} ${allergens.length ? styles.allergic : ''}`}>
      <div className={styles.thumbWrap}>
        {item.thumbnailUrl
          ? <Photo src={item.thumbnailUrl} ratio="1/1" shape="rounded" className={styles.thumb} />
          : <div className={styles.thumbFallback} aria-hidden="true"><i className="bi bi-flower3" /></div>}
        {allergens.length > 0 && (
          <span className={styles.allergyChip}><i className="bi bi-exclamation-triangle-fill" aria-hidden="true" /> Dị ứng</span>
        )}
      </div>
      <div className={styles.body}>
        <span className={styles.badge}>
          <i className="bi bi-patch-check-fill" aria-hidden="true" /> Green Bowl đã kiểm duyệt
        </span>
        <p className={styles.title}>{item.title}</p>
        {meta && <p className={styles.meta}>{meta}</p>}
        {allergens.length > 0 && (
          <p className={styles.allergyText}>Có {allergens.join(', ')} – bạn đã khai dị ứng. Bỏ hoặc thay trước khi nấu.</p>
        )}
        {/* Khoi's code (06/11/2026): câu trả lời không nêu đủ định lượng (vd hỏi mẹo) thì không nói "dựa trên". */}
        <p className={styles.desc}>{source.quantityNote
          ? 'Công thức gốc của món này — xem để có đủ định lượng chính xác.'
          : 'Câu trả lời dựa trên công thức này.'}</p>
        <a className={styles.link} href={`/recipes/${encodeURIComponent(item.id)}`}>Xem công thức gốc</a>
      </div>
    </div>
  );
}
