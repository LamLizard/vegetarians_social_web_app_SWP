// Khoi's code (01/11/2026): chọn Chủ đề trong hộp Đăng bài Bảng tin — giao diện theo prototype v4:
//   "Chủ đề * đã chọn N" · nhóm HAY DÙNG · nhóm TẤT CẢ (A–Z) + ô "Tìm chủ đề" bên phải · gập "+N chủ đề".
// Chức năng giữ như CategoryPicker (dùng chung, không sửa): chọn nhiều, tìm không phân biệt dấu, lỗi "ít nhất 1 chủ đề".
import { useState } from 'react';
import cx from '../cx';
import s from './FeedComposeDialog.module.css';

const plain = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/**
 * @param {{id, name}[]} options · @param {(string|number)[]} popularIds   thứ tự nhóm "Hay dùng"
 * @param {(string|number)[]} value · @param {(id) => void} onToggle   bật/tắt 1 chủ đề (trang cập nhật bằng setState dạng hàm → bấm nhanh không mất lựa chọn)
 * @param {number} [collapseAfter=8] · @param {string} [error] · @param {boolean} [disabled]
 */
export default function TopicPicker({ options = [], popularIds = [], value = [], onToggle, collapseAfter = 8, error, disabled }) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const byId = new Map(options.map((o) => [String(o.id), o]));
  const popular = popularIds.map((id) => byId.get(String(id))).filter(Boolean);
  const popularSet = new Set(popular.map((o) => String(o.id)));
  const key = plain(query.trim());
  // Đang tìm → tìm trong MỌI chủ đề (kể cả nhóm Hay dùng); không tìm → "Tất cả" chỉ gồm chủ đề ngoài Hay dùng
  const rest = options
    .filter((o) => key || !popularSet.has(String(o.id)))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    .filter((o) => !key || plain(o.name).includes(key));
  const restShown = showAll || key ? rest : rest.slice(0, collapseAfter);
  const picked = new Set(value.map(String));

  const chip = (o) => {
    const on = picked.has(String(o.id));
    return (
      <button key={o.id} type="button" className={cx(s.chip, on && s.chipOn)} aria-pressed={on} onClick={() => onToggle(o.id)} disabled={disabled}>
        {on && <i className="bi bi-check-lg" aria-hidden="true" />}{o.name}
      </button>
    );
  };

  return (
    <fieldset className={s.block} aria-invalid={error ? true : undefined}>
      <legend className={s.label}>Chủ đề<span className={s.req} aria-hidden="true">*</span> <small>đã chọn {value.length}</small></legend>
      {popular.length > 0 && (
        <>
          <p className={s.groupLabel}>Hay dùng</p>
          <div className={s.chips}>{popular.map(chip)}</div>
        </>
      )}
      <div className={s.groupRow}>
        <p className={s.groupLabel}>Tất cả</p>
        <label className={s.topicSearch}>
          <i className="bi bi-search" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm chủ đề" aria-label="Tìm chủ đề" disabled={disabled} />
        </label>
      </div>
      <div className={s.chips}>
        {restShown.map(chip)}
        {!showAll && !key && rest.length > collapseAfter && (
          <button type="button" className={s.moreChip} onClick={() => setShowAll(true)}>+{rest.length - collapseAfter} chủ đề</button>
        )}
        {key && rest.length === 0 && <span className={s.hint}>Không có chủ đề “{query}”.</span>}
      </div>
      {error ? <p className={s.err} role="alert">{error}</p> : <p className={s.hint}>Chủ đề do Admin tạo, giúp mọi người tìm bài dễ hơn.</p>}
    </fieldset>
  );
}
