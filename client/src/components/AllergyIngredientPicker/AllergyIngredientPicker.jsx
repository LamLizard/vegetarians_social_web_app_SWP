import { useEffect, useState } from 'react';
import Button from '../Button/Button';
import Chip from '../Chip/Chip';
import Notice from '../Notice/Notice';
import recipeService from '../../services/recipe.service';
import { submitIngredientProposal } from '../../services/ingredientProposal.service';
import styles from './AllergyIngredientPicker.module.css';

const sameName = (left, right) => left.trim().toLocaleLowerCase('vi') === right.trim().toLocaleLowerCase('vi');

// Duy's Code : Tìm nguyên liệu đã duyệt; tên chưa có được gửi duyệt qua bảng allergy có sẵn.
export default function AllergyIngredientPicker({ value = [], onChange, max = 50 }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

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
      onChange?.(value.some((item) => sameName(item, result.proposal.name)) ? value : [...value, result.proposal.name]);
      setFeedback({ tone: 'success', text: result.message || 'Đã gửi nguyên liệu cho Admin duyệt.' });
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
          disabled={value.length >= max}
        />
      </div>
      {loading && <p className={styles.hint}>Đang tải nguyên liệu…</p>}
      {loadError && <div className={styles.feedback}><Notice tone="alert">{loadError}</Notice></div>}
      {visibleMatches.length > 0 && (
        <div className={styles.results} role="listbox" aria-label="Nguyên liệu tìm thấy">
          {visibleMatches.map((name) => (
            <button key={name} type="button" role="option" aria-selected="false" onClick={() => selectIngredient(name)}>
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
          <Button type="button" size="sm" variant="outline" onClick={() => selectIngredient(exactMatch)}>Chọn nguyên liệu</Button>
        </div>
      )}
      {feedback && <p className={feedback.tone === 'alert' ? styles.error : styles.success} role={feedback.tone === 'alert' ? 'alert' : 'status'}>{feedback.text}</p>}
      <p className={styles.hint}>Nguyên liệu mới sẽ được gửi Admin duyệt và lưu trong hồ sơ dị ứng của bạn.</p>
    </div>
  );
}
