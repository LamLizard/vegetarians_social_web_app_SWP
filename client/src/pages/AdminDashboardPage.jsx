// Trang chủ khu quản trị (M-14) — /admin
// Khoi's code 30/10/2026: thiết kế lại theo phương án B "Tổng quan có biểu đồ":
//   kỳ (Hôm nay · 7 ngày · 30 ngày) → 4 chỉ số cộng đồng + 1 ô việc kiểm duyệt đang chờ
//   → biểu đồ bài viết / báo cáo theo ngày + hàng đợi theo thời gian chờ → bài bị báo cáo nhiều nhất + hoạt động quản trị.
// Duyệt / từ chối làm ở trang Kiểm duyệt (dashboard chỉ tóm tắt và dẫn đường). Page giữ UI, dữ liệu qua services/admin.service.js.
import { useEffect, useState } from 'react';
import {
  AdminLayout, Button, EmptyState, Notice, Panel, Skeleton, StatCard, formatDateTime, formatNumber,
} from '../components';
import { describeAuditAction } from '../constants/domain';
import useAuth from '../hooks/useAuth';
import adminService from '../services/admin.service';
import s from './AdminDashboardPage.module.css';

const RANGES = [
  { value: 'today', label: 'Hôm nay', previous: 'hôm qua' },
  { value: '7d', label: '7 ngày', previous: '7 ngày trước đó' },
  { value: '30d', label: '30 ngày', previous: '30 ngày trước đó' },
];

// 4 chỉ số cộng đồng ở hàng đầu (key khớp community[] của API). "Báo cáo" xem ở biểu đồ.
const KPIS = ['newPosts', 'comments', 'activeUsers', 'newMembers'];
// Báo cáo tăng là XẤU, các chỉ số còn lại tăng là tốt → màu mũi tên
const GOOD_WHEN_UP = { newMembers: true, activeUsers: true, newPosts: true, comments: true, reports: false };

// Việc chờ theo trang duyệt (key khớp pendingStats). Khiếu nại chưa có API → không hiện.
const PENDING_TYPES = [
  { key: 'post', label: 'Bài viết chờ duyệt', icon: 'journal-text', href: '/admin/moderation?type=post' },
  { key: 'report', label: 'Báo cáo chưa xử lý', icon: 'flag', href: '/admin/moderation?type=report' },
  { key: 'recipe', label: 'Công thức chờ duyệt', icon: 'book-half', href: '/admin/recipes/verify' },
  { key: 'ingredient', label: 'Nguyên liệu đề xuất', icon: 'basket', href: '/admin/ingredients/verify' },
  { key: 'shop', label: 'Quán chờ xác minh', icon: 'shop', href: '/admin/shops/verify' },
];

// Hàng đợi bài + báo cáo theo thời gian chờ (vòng tròn)
const AGE = [
  { key: 'over48', label: 'Quá 48 giờ', color: 'var(--ac-alert)' },
  { key: 'from24to48', label: '24 – 48 giờ', color: 'var(--ac-warn-fg)' },
  { key: 'under24', label: 'Dưới 24 giờ', color: 'var(--ac-moss)' },
];

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const dayLabel = (iso, many) => {
  const [y, m, d] = iso.split('-').map(Number);
  return many ? `${d}/${m}` : WEEKDAY[new Date(y, m - 1, d).getDay()];
};

/** Hành động trong nhật ký → nhãn màu (Duyệt xanh · Từ chối đỏ · còn lại xám) */
function actionTone(action) {
  const a = String(action || '').toLowerCase();
  if (a.includes('reject') || a.includes('lock') || a.includes('delete') || a.includes('remove') || a.includes('deactivat')) return 'bad';
  if (a.includes('approve') || a.includes('accept') || a.includes('verif') || a.includes('activat') || a.includes('unlock') || a.includes('restore') || a.includes('created')) return 'ok';
  return 'neutral';
}

/** Mức thay đổi so với kỳ trước: "▲ 7" / "▼ 3" / "không đổi" — màu theo tốt/xấu */
function Delta({ metric }) {
  const diff = (metric.value ?? 0) - (metric.previous ?? 0);
  if (!diff) return <span className={s.flat}>không đổi</span>;
  const good = (GOOD_WHEN_UP[metric.key] ?? true) === diff > 0;
  return (
    <span className={good ? s.up : s.down}>
      <i className={`bi bi-caret-${diff > 0 ? 'up' : 'down'}-fill`} aria-hidden="true" />
      {formatNumber(Math.abs(diff))}
    </span>
  );
}

/** Biểu đồ cột: bài viết mới và báo cáo theo ngày (CSS thuần, không thêm thư viện) */
function DailyChart({ series }) {
  const max = Math.max(1, ...series.flatMap((d) => [d.posts, d.reports]));
  const many = series.length > 10;
  const total = series.reduce((t, d) => ({ posts: t.posts + d.posts, reports: t.reports + d.reports }), { posts: 0, reports: 0 });
  return (
    <figure className={s.chart} aria-label={`Bài viết và báo cáo theo ngày: tổng ${total.posts} bài viết, ${total.reports} báo cáo`}>
      <div className={s.bars}>
        {series.map((d) => (
          <div key={d.date} className={s.day} title={`${dayLabel(d.date, true)}: ${d.posts} bài viết · ${d.reports} báo cáo`}>
            <span className={s.barPost} style={{ height: `${(d.posts / max) * 100}%` }} />
            <span className={s.barReport} style={{ height: `${(d.reports / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className={s.axis} aria-hidden="true">
        {series.map((d, i) => (
          <span key={d.date}>{!many || i % 5 === 0 || i === series.length - 1 ? dayLabel(d.date, many) : ''}</span>
        ))}
      </div>
      <figcaption className={s.legend}>
        <span><i className={s.dotPost} />Bài viết mới <b>{formatNumber(total.posts)}</b></span>
        <span><i className={s.dotReport} />Báo cáo <b>{formatNumber(total.reports)}</b></span>
      </figcaption>
    </figure>
  );
}

/** Vòng tròn hàng đợi theo thời gian chờ */
function AgeDonut({ age }) {
  const values = AGE.map((a) => age?.[a.key] ?? 0);
  const total = values.reduce((t, v) => t + v, 0);
  const stops = AGE.map((a, i) => {
    const from = values.slice(0, i).reduce((t, v) => t + v, 0) / (total || 1) * 100;
    const to = from + values[i] / (total || 1) * 100;
    return `${a.color} ${from}% ${to}%`;
  }).join(', ');
  return (
    <div className={s.ageWrap}>
      <div className={s.donut} style={{ background: total ? `conic-gradient(${stops})` : 'var(--ac-track)' }}
        role="img" aria-label={AGE.map((a, i) => `${a.label}: ${values[i]}`).join(', ')}>
        <div className={s.donutHole}><b>{formatNumber(total)}</b><span>việc</span></div>
      </div>
      <ul className={s.ageList}>
        {AGE.map((a, i) => (
          <li key={a.key}><i style={{ background: a.color }} />{a.label}<b>{formatNumber(values[i])}</b></li>
        ))}
      </ul>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const [range, setRange] = useState('7d');
  const [board, setBoard] = useState({ status: 'loading', data: null, error: null });
  const [audit, setAudit] = useState({ status: 'loading', items: [], error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const [auditKey, setAuditKey] = useState(0);

  const handleLogout = () => { logout(); window.location.assign('/'); };

  useEffect(() => {
    let alive = true;
    setBoard((b) => ({ ...b, status: 'loading', error: null }));
    adminService.getDashboard(range)
      .then((data) => { if (alive) setBoard({ status: 'ready', data, error: null }); })
      .catch((error) => { if (alive) setBoard({ status: 'error', data: null, error }); });
    return () => { alive = false; };
  }, [range, reloadKey]);

  useEffect(() => {
    let alive = true;
    adminService.getAudit(1)
      .then((data) => { if (alive) setAudit({ status: 'ready', items: data.items ?? [], error: null }); })
      .catch((error) => { if (alive) setAudit({ status: 'error', items: [], error }); });
    return () => { alive = false; };
  }, [auditKey]);

  const loading = board.status === 'loading';
  const data = board.data;
  const pending = data?.pendingStats ?? {};
  const community = data?.community ?? [];
  const rangeInfo = RANGES.find((r) => r.value === range);
  const metric = (key) => community.find((c) => c.key === key);

  return (
    <AdminLayout activeKey="dashboard" title="Tổng quan" user={user} onLogout={handleLogout}>
      <div className={s.page}>
        <header className={s.head}>
          <div>
            <h1 className={s.title}>Tổng quan</h1>
            <p className={s.desc}>Tình hình cộng đồng và hàng đợi kiểm duyệt.</p>
          </div>
          <div className={s.range} role="group" aria-label="Khoảng thời gian">
            {RANGES.map((r) => (
              <button key={r.value} type="button" className={r.value === range ? s.rangeOn : undefined}
                aria-pressed={r.value === range} onClick={() => setRange(r.value)}>
                {r.label}
              </button>
            ))}
          </div>
        </header>

        {board.status === 'error' ? (
          <Notice tone="alert" title="Không tải được số liệu quản trị" action={{ label: 'Thử lại', onClick: () => setReloadKey((k) => k + 1) }}>
            {board.error?.message || 'Vui lòng kiểm tra kết nối rồi thử lại.'}
          </Notice>
        ) : (
          <>
            {/* 1 · Chỉ số cộng đồng của kỳ đang chọn + ô việc đang chờ (bấm → việc quá hạn) */}
            <div className={s.kpis} aria-busy={loading || undefined}>
              {KPIS.map((key) => {
                const m = metric(key);
                return (
                  <StatCard key={key} loading={loading} label={m?.label ?? ''} value={m?.value ?? 0} unit={m?.unit}
                    hint={m && <><Delta metric={m} /> <span className={s.vs}>so với {rangeInfo.previous}</span></>} />
                );
              })}
              <StatCard
                className={s.pendingCard}
                loading={loading}
                label="Việc kiểm duyệt đang chờ"
                value={pending.total ?? 0}
                unit="việc"
                icon="hourglass-split"
                tone={pending.stale > 0 ? 'bad' : pending.total > 0 ? 'warn' : 'ok'}
                hint={pending.stale > 0 ? `${formatNumber(pending.stale)} việc quá 48 giờ, lâu nhất ${pending.staleOldestDays} ngày` : 'Không có việc quá 48 giờ'}
                href={pending.stale > 0 ? '/admin/moderation?stale=1' : '/admin/moderation'}
              />
            </div>

            {/* 2 · Biểu đồ theo ngày + hàng đợi theo thời gian chờ */}
            <div className={s.row}>
              <Panel className={s.fill} title="Bài viết và báo cáo theo ngày" icon="bar-chart">
                {loading ? <Skeleton shape="block" height={190} /> : <DailyChart series={data.series ?? []} />}
              </Panel>
              <Panel title="Việc đang chờ" icon="hourglass-split">
                {loading ? <Skeleton lines={6} /> : (
                  <>
                    <p className={s.note}>Bài viết và báo cáo, chia theo thời gian đã chờ</p>
                    <AgeDonut age={pending.age} />
                    <ul className={s.types}>
                      {PENDING_TYPES.map((t) => (
                        <li key={t.key}>
                          <a href={t.href}>
                            <i className={`bi bi-${t.icon}`} aria-hidden="true" />
                            <span>{t.label}</span>
                            <b className={pending[t.key] ? s.countOn : s.countOff}>{formatNumber(pending[t.key] ?? 0)}</b>
                          </a>
                        </li>
                      ))}
                    </ul>
                    {pending.stale > 0 && (
                      <Button as="a" href="/admin/moderation?stale=1" size="sm" icon="lightning-charge" block>
                        Xử lý {formatNumber(pending.stale)} việc quá hạn
                      </Button>
                    )}
                  </>
                )}
              </Panel>
            </div>
          </>
        )}

        {/* 3 · Bài bị báo cáo nhiều nhất + hoạt động quản trị */}
        <div className={s.row2}>
          {board.status !== 'error' && (
            <Panel flush title="Bài bị báo cáo nhiều nhất" icon="flag" action={(
              <Button as="a" href="/admin/moderation?type=report" variant="subtle" size="sm" icon="arrow-right" iconPosition="end">Xem tất cả</Button>
            )}>
              {loading ? <div className={s.pad}><Skeleton lines={5} /></div> : (data.topReported ?? []).length === 0 ? (
                <EmptyState icon="check2-circle" title="Không có bài nào bị báo cáo">Mọi báo cáo đã được xử lý.</EmptyState>
              ) : (
                <ul className={s.list}>
                  {data.topReported.map((p, i) => (
                    <li key={p.postId}>
                      <span className={s.ellipsis} title={p.title}>{p.title}</span>
                      <span className={i === 0 ? s.tagBad : s.tagWarn}>{p.reports} báo cáo</span>
                      <Button as="a" href="/admin/moderation?type=report" size="sm" variant="outline">Xem</Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          <Panel flush title="Hoạt động quản trị gần đây" icon="clock-history">
            {audit.status === 'error' ? (
              <div className={s.pad}>
                <Notice tone="alert" title="Không tải được nhật ký" action={{ label: 'Thử lại', onClick: () => setAuditKey((k) => k + 1) }}>
                  {audit.error?.message || 'Vui lòng thử lại sau.'}
                </Notice>
              </div>
            ) : audit.status === 'loading' ? <div className={s.pad}><Skeleton lines={5} /></div> : audit.items.length === 0 ? (
              <EmptyState icon="inbox" title="Chưa có thao tác nào" />
            ) : (
              <ul className={s.list}>
                {audit.items.map((a) => (
                  <li key={a.id}>
                    <span className={s.ellipsis}>
                      <b>{a.admin}</b>{' '}
                      <span className={s[`tag${actionTone(a.action) === 'ok' ? 'Ok' : actionTone(a.action) === 'bad' ? 'Bad' : 'Neutral'}`]}>
                        {describeAuditAction(a.action, a.targetType)}
                      </span>
                      {a.targetEmail && <span className={s.muted}> · {a.targetEmail}</span>}
                      {a.reason && <span className={s.muted} title={a.reason}> · “{a.reason}”</span>}
                    </span>
                    <time className={s.time} dateTime={a.at}>{formatDateTime(a.at)}</time>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </AdminLayout>
  );
}
