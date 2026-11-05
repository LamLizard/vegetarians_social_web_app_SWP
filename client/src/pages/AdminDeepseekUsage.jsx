import { useEffect, useId, useState } from 'react';
import Button from '../components/Button/Button';
import Notice from '../components/Notice/Notice';
import StatCard from '../components/StatCard/StatCard';
import { getDeepseekUsage } from '../services/deepseekUsage.service';
import styles from './AdminDeepseekUsage.module.css';

const DAY_MS = 86400000;
const UPDATE_MS = 30000;
// Khoi's code (07/11/2026): thêm loại gọi của lớp duyệt đầu ra (policy_verification).
const LABELS = { classifier: 'Phân loại', answer: 'Trả lời', verifier: 'Duyệt đầu ra' };

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
  return new Intl.NumberFormat('vi-VN').format(value);
}

function tokens(value, coverage, field) {
  const hasCompleteEmpty = coverage === 'observed' && value.usageUnknown === 0 && value.inFlight === 0;
  return value.usageKnown > 0 || hasCompleteEmpty ? amount(value[field]) : 'Chưa có';
}

export default function AdminDeepseekUsage() {
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
      if (currentToday !== today) { setToday(currentToday); return; }
      pending = true;
      request = new AbortController();
      try {
        const result = await getDeepseekUsage({ date, signal: request.signal });
        if (active && !request.signal.aborted) { setData(result); setError(''); }
      } catch (err) {
        if (active && !request.signal.aborted) {
          setData(null);
          setError(err?.message || 'Không thể tải thống kê DeepSeek.');
        }
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
  }, [date, refresh, today]);

  const totals = data?.totals;
  const knownCoverage = data && data.coverage.state !== 'unknown';
  const partialTokens = totals && (totals.usageUnknown > 0 || totals.inFlight > 0);

  return (
    <section className={styles.usage} aria-labelledby={`${id}-title`}>
      <div className={styles.heading}>
        <div><h2 id={`${id}-title`}>DeepSeek · Chatbot</h2><p>Theo dõi các lần gọi phân loại, trả lời và duyệt đầu ra.</p></div>
        <div className={styles.controls}>
          <div className={styles.dateField}>
            <label htmlFor={`${id}-date`}>Ngày thống kê</label>
            <input id={`${id}-date`} type="date" value={date} min={oldest} max={today}
              onChange={(event) => setSelectedDate(!event.target.value || event.target.value === today ? null : event.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={() => setRefresh((value) => value + 1)}>Tải lại</Button>
        </div>
      </div>
      {error && <Notice tone="alert" action={{ label: 'Thử lại', onClick: () => setRefresh((value) => value + 1) }}>{error}</Notice>}
      {loading && !data && <p className={styles.loading} role="status">Đang tải thống kê DeepSeek…</p>}
      {data && <>
        <div className={styles.context}>
          <p>Model {data.model} · Ngày {data.date}, giờ Việt Nam · Cập nhật: {timeLabel(data.generatedAt)}</p>
          <p>Số liệu trong bộ nhớ tiến trình từ {timeLabel(data.source.startedAt)}; có thể thiếu và mất khi server khởi động lại.</p>
        </div>
        {data.coverage.state === 'unknown' && <Notice>Chưa có dữ liệu cho ngày này trong tiến trình hiện tại.</Notice>}
        {data.coverage.state === 'partial' && <Notice>Số liệu trong ngày có thể chưa đầy đủ.</Notice>}
        {partialTokens && <Notice>Có lượt gọi chưa có token hoặc đang xử lý; tổng token có thể chưa đầy đủ.</Notice>}
        <div className={styles.stats}>
          <StatCard label="Tổng token" value={knownCoverage ? tokens(totals, data.coverage.state, 'totalTokens') : 'Chưa có'} hint="Đầu vào và đầu ra đã ghi nhận" />
          <StatCard label="Lần gọi" value={knownCoverage ? amount(totals.attempts) : 'Chưa có'} hint="Lần thử gọi DeepSeek, không phải lượt chat" />
          <StatCard label="Lỗi" value={knownCoverage ? amount(totals.errors) : 'Chưa có'} hint="Lần gọi không hoàn tất" />
          <StatCard label="Đang xử lý" value={knownCoverage ? amount(totals.inFlight) : 'Chưa có'} hint="Lần gọi đang chờ" />
        </div>
        <div className={styles.detailHeader}><h3>Phân bổ theo loại gọi</h3><p>Token là phần đã ghi nhận trong ngày.</p></div>
        {data.groups.length ? <div className={styles.tableWrap} tabIndex={0} aria-label="Bảng mức sử dụng DeepSeek theo loại gọi">
          <table className={styles.table}>
            <thead><tr><th>Loại gọi</th><th>Lần gọi</th><th>Đầu vào</th><th>Đầu ra</th><th>Lỗi</th></tr></thead>
            <tbody>{data.groups.map((group) => <tr key={group.kind}>
              <td>{LABELS[group.kind]}</td><td>{amount(group.attempts)}</td>
              <td>{tokens(group, data.coverage.state, 'promptTokens')}</td>
              <td>{tokens(group, data.coverage.state, 'completionTokens')}</td><td>{amount(group.errors)}</td>
            </tr>)}</tbody>
          </table>
        </div> : <p className={styles.empty}>Chưa ghi nhận lượt gọi nào trong khoảng dữ liệu hiện có.</p>}
        <p className={styles.note}>Số liệu lưu trong bộ nhớ server, mất khi server khởi động lại. Số liệu chỉ thuộc tiến trình đang phục vụ yêu cầu, không phải tổng tài khoản DeepSeek.</p>
      </>}
    </section>
  );
}
