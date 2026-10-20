import Notice from '../Notice/Notice';

/**
 * Khoi's code: Hộp cảnh báo đồ động vật cho trang Admin (12/10/2026).
 * Dữ liệu `animalWarnings` do server tính (banned_keyword category 'animal' + ingredient.is_animal_derived).
 * Chỉ để Admin xem lại, KHÔNG chặn duyệt: "chả cá chay" khớp "cá" nhưng vẫn là đồ chay.
 *
 * @param {{field: string, label: string, text: string, keyword: string}[]} [warnings]
 */
export default function AnimalWarnings({ warnings, className }) {
  if (!warnings?.length) return null;
  return (
    <Notice tone="alert" title="Có thể không phải đồ chay — hãy kiểm tra lại" className={className}>
      <ul className="mb-0 ps-3">
        {warnings.map((w, i) => (
          <li key={`${w.field}-${i}`}>
            {w.label}: “{w.text.length > 80 ? `${w.text.slice(0, 80)}…` : w.text}” {w.field === 'ingredient' ? ' — kho ghi là nguyên liệu có nguồn gốc động vật' : <> — có từ <b>{w.keyword}</b></>}
          </li>
        ))}
      </ul>
    </Notice>
  );
}
