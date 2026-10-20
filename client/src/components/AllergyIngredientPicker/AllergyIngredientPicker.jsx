import { useEffect, useRef, useState } from 'react';
import Button from '../Button/Button';
import Chip from '../Chip/Chip';
import Notice from '../Notice/Notice';
import recipeService from '../../services/recipe.service';
import { getMyIngredientProposals, submitIngredientProposal } from '../../services/ingredientProposal.service';
import styles from './AllergyIngredientPicker.module.css';

const sameName = (left, right) => left.trim().toLocaleLowerCase('vi') === right.trim().toLocaleLowerCase('vi');
const STATUS_SEEN_KEY = 'health-profile-allergy-status-seen-v1';
const statusKey = (item) => `${item.status}:${item.name.trim().toLocaleLowerCase('vi')}`;

function readSeenStatuses() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STATUS_SEEN_KEY) || '[]');
    return new Set(Array.isArray(stored) ? stored : []);
  } catch { return new Set(); }
}

// Duy's Code : Tìm nguyên liệu đã duyệt; tên chưa có được gửi duyệt qua bảng allergy có sẵn.
export default function AllergyIngredientPicker({ value = [], onChange, max = 50 }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [proposals, setProposals] = useState([]);
  const latestSelection = useRef({ value, onChange });
  const previousStatuses = useRef(null);
  const seenStatuses = useRef(null);
  const shownStatusesThisPage = useRef(new Set());
  latestSelection.current = { value, onChange };

  useEffect(() => {
    let active = true;
    const refresh = () => getMyIngredientProposals().then((items) => {
      if (!active) return;
      if (!seenStatuses.current) seenStatuses.current = readSeenStatuses();
      const seen = seenStatuses.current;
      items.filter((item) => item.status !== 'pending').forEach((item) => {
        const key = statusKey(item);
        if (!seen.has(key)) {
          seen.add(key);
          shownStatusesThisPage.current.add(key);
        }
      });
      try { sessionStorage.setItem(STATUS_SEEN_KEY, JSON.stringify([...seen])); } catch { /* keep status rendering available if storage is blocked */ }
      setProposals(items.filter((item) => item.status === 'pending' || shownStatusesThisPage.current.has(statusKey(item))));
      const oldStatuses = previousStatuses.current;
      const newlyApproved = oldStatuses
        ? items.filter((item) => item.status === 'approved' && oldStatuses.get(item.id) === 'pending')
        : [];
      previousStatuses.current = new Map(items.map((item) => [item.id, item.status]));
      const rejectedNames = items.filter((item) => item.status === 'rejected').map((item) => item.name);
      if (rejectedNames.length) {
        const { value: current, onChange: change } = latestSelection.current;
        const next = current.filter((name) => !rejectedNames.some((rejected) => sameName(name, rejected)));
        if (next.length !== current.length) change?.(next);
      }
      if (newlyApproved.length) {
        const { value: current, onChange: change } = latestSelection.current;
        const next = [...current];
        newlyApproved.forEach(({ name }) => {
          if (!next.some((selected) => sameName(selected, name))) next.push(name);
        });
        if (next.length !== current.length) change?.(next);
      }
    }).catch(() => {});
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (!term) { setMatches([]); setLoadError(''); setLoading(false); return undefined; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setLoadError('');
      recipeService.searchIngredientNames(term, { signal: controller.signal })
        .then(({ items }) => setMatches(items))
        .catch((error) => { if (error.name !== 'AbortError') setLoadError(error.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  const exactMatch = matches.find((name) => sameName(name, query));
  const visibleMatches = matches.filter((name) => !value.some((selected) => sameName(selected, name)));

  const selectIngredient = (name) => {
    if (value.length >= max || value.some((selected) => sameName(selected, name))) return;
    onChange?.([...value, name]);
    setQuery('');
    setFeedback(null);
  };

  const proposeIngredient = async () => {
    const name = query.trim().replace(/\s+/gu, ' ');
    if (!name || submitBusy || value.length >= max) return;
    setSubmitBusy(true);
    setFeedback(null);
    try {
      const result = await submitIngredientProposal(name);
      // The proposal endpoint also saves this name to the profile immediately.
      // Keep the form state in sync so its next full-profile save does not delete it.
      const { value: current, onChange: change } = latestSelection.current;
      if (!current.some((selected) => sameName(selected, name)) && current.length < max) {
        change?.([...current, name]);
      }
      setProposals((current) => current.some((item) => sameName(item.name, name))
        ? current
        : [...current, { id: `pending-${name}`, name, status: 'pending' }]);
      setFeedback({ tone: 'success', text: result.message || 'Tên dị ứng đã được lưu vào hồ sơ sức khỏe và gửi Admin phân loại.' });
      setQuery('');
    } catch (error) {
      setFeedback({ tone: 'alert', text: error.message });
      if (error.status === 409) {
        recipeService.searchIngredientNames(name).then(({ items }) => setMatches(items)).catch(() => {});
      }
    } finally {
      setSubmitBusy(false);
    }
  };

  return (
    <div>
      <div className={styles.box}>
        {value.map((name) => (
          <Chip key={name} onRemove={() => onChange?.(value.filter((selected) => selected !== name))}>{name}</Chip>
        ))}
        <input
          className={styles.input}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setMatches([]); setFeedback(null); }}
          placeholder={value.length >= max ? `Đã đủ ${max} mục` : 'Tìm nguyên liệu trong kho'}
          aria-label="Tìm nguyên liệu dị ứng trong cơ sở dữ liệu"
          autoComplete="off"
          maxLength={120}
          disabled={value.length >= max || submitBusy}
        />
      </div>
      {loading && <p className={styles.hint}>Đang tải nguyên liệu…</p>}
      {loadError && <div className={styles.feedback}><Notice tone="alert">{loadError}</Notice></div>}
      {visibleMatches.length > 0 && (
        <div className={styles.results} role="listbox" aria-label="Nguyên liệu tìm thấy">
          {visibleMatches.map((name) => (
            <button key={name} type="button" role="option" aria-selected="false" disabled={submitBusy} onClick={() => selectIngredient(name)}>
              <i className="bi bi-plus-circle" aria-hidden="true" />{name}
            </button>
          ))}
        </div>
      )}
      {query.trim() && !loading && !loadError && visibleMatches.length === 0 && !exactMatch && (
        <div className={styles.proposal}>
          <span>Chưa tìm thấy “{query.trim()}” trong kho nguyên liệu.</span>
          <Button type="button" size="sm" icon="send" loading={submitBusy} onClick={proposeIngredient}>Gửi Admin duyệt</Button>
        </div>
      )}
      {exactMatch && !value.some((name) => sameName(name, exactMatch)) && (
        <div className={styles.proposal}>
          <span>Đã có “{exactMatch}” trong kho.</span>
          <Button type="button" size="sm" variant="outline" disabled={submitBusy} onClick={() => selectIngredient(exactMatch)}>Chọn nguyên liệu</Button>
        </div>
      )}
      {feedback && <p className={feedback.tone === 'alert' ? styles.error : styles.success} role={feedback.tone === 'alert' ? 'alert' : 'status'}>{feedback.text}</p>}
      <p className={styles.hint}>Tên dị ứng được lưu trong hồ sơ sức khỏe ngay khi gửi. Admin sẽ phân loại và thêm tên vào danh mục nguyên liệu để hệ thống nhận biết chính xác.</p>
      {proposals.some((item) => item.status === 'pending') && (
        <div className={styles.hint} aria-live="polite">
          Đang chờ duyệt: {proposals.filter((item) => item.status === 'pending').map((item) => item.name).join(', ')}
        </div>
      )}
      {proposals.some((item) => item.status !== 'pending') && (
        <ul className={styles.proposalStatus} aria-label="Kết quả đề nghị nguyên liệu">
          {proposals.filter((item) => item.status !== 'pending')
            .sort((left, right) => Number(right.status === 'rejected') - Number(left.status === 'rejected'))
            .slice(0, 3).map((item) => (
            <li key={item.id} className={`${styles.statusItem} ${item.status === 'approved' ? styles.statusApproved : item.status === 'rejected' ? styles.statusRejected : styles.statusRemoved}`}>
              <i className={`bi bi-${item.status === 'approved' ? 'check-circle-fill' : item.status === 'rejected' ? 'x-circle-fill' : 'info-circle-fill'}`} aria-hidden="true" />
              <div>
                <strong>{item.name}</strong>
                <span>{item.status === 'approved'
                  ? 'Đã được phân loại và thêm vào hồ sơ sức khỏe.'
                  : item.status === 'removed'
                    ? 'Đã được gỡ khỏi hàng đợi duyệt.'
                    : `Đã bị từ chối${item.reviewNote ? `: ${item.reviewNote}` : ''}. Tên này đã được gỡ khỏi hồ sơ.`}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
