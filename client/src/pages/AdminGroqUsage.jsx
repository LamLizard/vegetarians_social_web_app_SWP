import { useEffect, useId, useState } from 'react';
import Button from '../components/Button/Button';
import Notice from '../components/Notice/Notice';
import StatCard from '../components/StatCard/StatCard';
import { getGroqUsage } from '../services/groqUsage.service';
import styles from './AdminGroqUsage.module.css';

const DAY_MS = 86400000;
const UPDATE_MS = 30000;
const KIND_LABELS = { comment: 'Bình luận', post: 'Bài viết', chatbot: 'Chatbot' };

function vietnamDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function timeLabel(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Chưa có thông tin';
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
}

function amount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? new Intl.NumberFormat('vi-VN').format(value) : 'Chưa có';
}

function money(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 'Chưa có';
  if (value > 0 && value < 0.00000001) return '< $0,00000001';
  return `$${new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(value)}`;
}

function modelLabel(value) {
  if (value === 'openai/gpt-oss-20b') return 'GPT-OSS 20B';
  if (value === 'openai/gpt-oss-120b') return 'GPT-OSS 120B';
  return value;
}

function limitValue(pair) {
  return pair ? `${amount(pair.remaining)} / ${amount(pair.limit)}` : 'Chưa có thông tin';
}

function Limit({ entry, generatedAt }) {
  const now = Date.parse(generatedAt);
  const expired = [entry.requestsPerDay, entry.tokensPerMinute]
    .some((pair) => pair?.resetAt && Date.parse(pair.resetAt) <= now);
  return (
    <section className={styles.limit} aria-label={`Hạn mức ${modelLabel(entry.model)}`}>
      <div className={styles.limitHeading}>
        <h4>{modelLabel(entry.model)}</h4>
        <span className={styles.snapshotLabel}>Số gần nhất</span>
      </div>
      <dl className={styles.limitRows}>
        <div><dt>Request còn lại / ngày</dt><dd>{limitValue(entry.requestsPerDay)}</dd></div>
        <div><dt>Token còn lại / phút</dt><dd>{limitValue(entry.tokensPerMinute)}</dd></div>
      </dl>
      <p className={styles.limitMeta}>Ghi nhận: {timeLabel(entry.observedAt)}</p>
      {entry.requestsPerDay?.resetAt && <p className={styles.limitMeta}>Reset request: {timeLabel(entry.requestsPerDay.resetAt)}</p>}
      {entry.tokensPerMinute?.resetAt && <p className={styles.limitMeta}>Reset token: {timeLabel(entry.tokensPerMinute.resetAt)}</p>}
      {expired && <p className={styles.expired}>Đã qua thời điểm reset; cần phản hồi mới từ Groq.</p>}
    </section>
  );
}

export default function AdminGroqUsage() {
  const id = useId();
  const [today, setToday] = useState(() => vietnamDate());
  const [selectedDate, setSelectedDate] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const date = selectedDate || today;
  const oldest = vietnamDate(new Date(Date.parse(`${today}T00:00:00+07:00`) - 29 * DAY_MS));

  useEffect(() => {
    let active = true;
    let request = null;
    let timer = null;
    let pending = false;

    const schedule = () => {
      if (active && !document.hidden) timer = window.setTimeout(load, UPDATE_MS);
    };
    const load = async () => {
      if (!active || document.hidden || pending) return;
      const currentToday = vietnamDate();
      if (currentToday !== today) {
        setToday(currentToday);
        return;
      }
      pending = true;
      request = new AbortController();
      try {
        const result = await getGroqUsage({ date, signal: request.signal });
        if (active && !request.signal.aborted) {
          setData(result);
          setError('');
        }
      } catch (err) {
        if (active && !request.signal.aborted) setError(err?.message || 'Không thể tải thống kê Groq.');
      } finally {
        if (active) setLoading(false);
        pending = false;
        schedule();
      }
    };
    const onVisibility = () => {
      window.clearTimeout(timer);
      if (document.hidden) request?.abort();
      else if (!pending) load();
    };
    setLoading(true);
    setData(null);
    setError('');
    document.addEventListener('visibilitychange', onVisibility);
    load();
    return () => {
      active = false;
      window.clearTimeout(timer);
      request?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [date, refresh, selectedDate, today]);

  const totals = data?.totals;
  const showValues = data && data.coverage.state !== 'unknown';
  const estimateHint = totals?.costState === 'partial' ? 'Ước tính chưa đầy đủ' : 'Theo giá niêm yết, không phải hóa đơn';

  return (
    <section className={styles.usage} aria-labelledby={`${id}-title`}>
      <div className={styles.heading}>
        <div>
          <h2 id={`${id}-title`}>Mức sử dụng Groq</h2>
          <p>Theo dõi lượt gọi, token và hạn mức gần nhất.</p>
        </div>
        <div className={styles.controls}>
          <div className={styles.dateField}>
            <label htmlFor={`${id}-date`}>Ngày thống kê</label>
            <input id={`${id}-date`} type="date" value={date} min={oldest} max={today}
              onChange={(event) => setSelectedDate(!event.target.value || event.target.value === today ? null : event.target.value)} />
          </div>
          <Button variant="outline" size="sm" type="button" onClick={() => setRefresh((value) => value + 1)}>
            Tải lại
          </Button>
        </div>
      </div>

      {error && <Notice tone="alert" action={{ label: 'Thử lại', onClick: () => setRefresh((value) => value + 1) }}>{error}</Notice>}
      {loading && !data && <p className={styles.loading} role="status">Đang tải thống kê Groq…</p>}
      {data && (
        <>
          <div className={styles.context}>
            <p>Ngày {data.date}, giờ Việt Nam. Cập nhật: {timeLabel(data.generatedAt)}</p>
            <p>Số liệu trong bộ nhớ tiến trình từ {timeLabel(data.source.startedAt)}; có thể thiếu và mất khi server khởi động lại.</p>
          </div>
          {data.coverage.state === 'unknown' && <Notice>Chưa có dữ liệu cho ngày này trong tiến trình hiện tại.</Notice>}
          {data.coverage.state === 'partial' && <Notice>Số liệu trong ngày có thể chưa đầy đủ.</Notice>}
          {(totals.usageUnknown > 0 || totals.inFlight > 0) && (
            <Notice>Có lượt gọi chưa có số token hoặc đang xử lý; tổng hiển thị có thể chưa đầy đủ.</Notice>
          )}
          <div className={styles.stats}>
            <StatCard label="Tổng token" value={showValues ? amount(totals.totalTokens) : 'Chưa có'} hint="Đầu vào và đầu ra" />
            <StatCard label="Lượt gọi" value={showValues ? amount(totals.attempts) : 'Chưa có'} hint="Lần thử gọi Groq" />
            <StatCard label="Lỗi" value={showValues ? amount(totals.errors) : 'Chưa có'} hint="Lỗi trong lượt gọi" />
            <StatCard label="Chi phí ước tính" value={showValues ? money(totals.estimatedUsd) : 'Chưa có'} hint={estimateHint} />
          </div>

          <div className={styles.detailHeader}>
            <div><h3>Hạn mức gần nhất</h3><p>Do Groq trả về trong lần gọi gần nhất; số liệu có thể đã cũ.</p></div>
          </div>
          <div className={styles.limits}>
            {data.limits.map((entry) => <Limit key={entry.model} entry={entry} generatedAt={data.generatedAt} />)}
          </div>
          <p className={styles.note}>Hạn mức khác của Groq có thể không xuất hiện ở đây. Số còn lại có thể thay đổi khi ứng dụng khác dùng chung quota.</p>

          <div className={styles.detailHeader}>
            <div><h3>Phân bổ theo chức năng</h3><p>Chỉ tính các lượt web ghi nhận trong ngày đã chọn.</p></div>
          </div>
          {data.groups.length ? (
            <div className={styles.tableWrap} tabIndex={0} aria-label="Bảng mức sử dụng theo chức năng">
              <table className={styles.table}>
                <thead><tr><th>Chức năng</th><th>Model</th><th>Lượt gọi</th><th>Đầu vào</th><th>Đầu ra</th><th>Lỗi</th></tr></thead>
                <tbody>{data.groups.map((group) => (
                  <tr key={`${group.model}-${group.kind}`}>
                    <td>{KIND_LABELS[group.kind] || group.kind}</td><td>{modelLabel(group.model)}</td>
                    <td>{amount(group.attempts)}</td><td>{amount(group.promptTokens)}</td>
                    <td>{amount(group.completionTokens)}</td><td>{amount(group.errors)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className={styles.empty}>Chưa ghi nhận lượt gọi nào trong khoảng dữ liệu hiện có.</p>}
          <p className={styles.note}>
            Chi phí dùng giá niêm yết tham khảo ngày 28/10/2026, có thể khác chi phí thực tế.{' '}
            <a href="https://console.groq.com/docs/model/openai/gpt-oss-20b" target="_blank" rel="noreferrer">Giá 20B</a>{' và '}
            <a href="https://console.groq.com/docs/model/openai/gpt-oss-120b" target="_blank" rel="noreferrer">giá 120B</a>.
          </p>
        </>
      )}
    </section>
  );
}
