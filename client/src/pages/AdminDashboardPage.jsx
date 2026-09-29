// Trang chủ khu quản trị (M-14) — route dự kiến /admin
// Thứ tự ưu tiên: việc cần xử lý → cảnh báo → hàng đợi → cộng đồng → nhật ký.
// Page giữ UI + config, còn dữ liệu lấy qua services/admin.service.js (component kit KHÔNG gọi API).
import { useEffect, useState } from 'react';
import {
  AdminLayout, Avatar, Button, ConfirmDialog, DataTable, EmptyState, ENTITY_LABEL, Notice,
  PageHeader, Panel, Skeleton, StatCard, formatDate, timeAgo, useToast,
} from '../components';
import useAuth from '../hooks/useAuth';
import adminService from '../services/admin.service';
import postModerationService from '../services/postModeration.service';

// ---------------------------------------------------------------------
// CONFIG UI — số liệu/cảnh báo/hàng đợi lấy từ admin.service.js
// ---------------------------------------------------------------------

// 1 · Việc cần xử lý — mỗi ô bấm được; `key` khớp field trong pendingStats
const PENDING_CARDS = [
  { key: 'post', label: 'Post chờ duyệt', icon: 'journal-text', hint: 'Bài đăng mới gửi lên', href: '/admin/moderation?type=post' },
  { key: 'report', label: 'Report chưa xử lý', icon: 'flag', hint: 'Báo cáo vi phạm đang mở', href: '/admin/moderation?type=report' },
  { key: 'appeals', label: 'Khiếu nại đang chờ', icon: 'envelope-paper', hint: 'Thành viên phản hồi quyết định', href: '/admin/appeals' },
  { key: 'stale', label: 'Tồn đọng lâu (> 48h)', icon: 'hourglass-split', hint: 'Mục chờ quá 48 giờ', href: '/admin/moderation?stale=1' },
];

// 4 · Báo cáo tăng là XẤU, các chỉ số còn lại tăng là tốt → quyết định màu mũi tên
const GOOD_WHEN_UP = { newMembers: true, activeUsers: true, newPosts: true, comments: true, reports: false };

// 5 · Nhật ký quản trị: Ai · HÀNH ĐỘNG · đối tượng · thời gian · lý do
const AUDIT_COLUMNS = [
  {
    key: 'admin',
    header: 'Ai',
    width: 190,
    primary: true,
    render: (row) => (
      <span className="d-inline-flex align-items-center gap-2">
        <Avatar name={row.admin} size={26} />
        <span>{row.admin}</span>
      </span>
    ),
  },
  { key: 'action', header: 'Hành động', width: 130, render: (row) => <b>{row.action}</b> },
  { key: 'target', header: 'Đối tượng', width: 150 },
  { key: 'at', header: 'Thời gian', width: 140, render: (row) => formatDate(row.at) },
  { key: 'reason', header: 'Lý do', hideOnMobile: true },
];

const isStale = (createdAt) => Date.now() - new Date(createdAt).getTime() > 48 * 3600_000;

export default function AdminDashboardPage() {
  const toast = useToast();
  const { user, logout } = useAuth();

  const [board, setBoard] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [decision, setDecision] = useState(null);
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleLogout = () => { logout(); window.location.assign('/'); };

  // Page cầm dữ liệu. "Thử lại" → tăng reloadKey → effect chạy lại.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    adminService.getDashboard()
      .then((data) => {
        if (!alive) return;
        setBoard(data);
        setQueue(data.reviewQueue);
      })
      .catch((err) => { if (alive) setError(err); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [reloadKey]);

  const retry = () => setReloadKey((k) => k + 1);
  const pending = board?.pendingStats ?? {};
  const alerts = board?.alerts ?? [];
  const community = board?.community ?? [];
  const auditLog = board?.auditLog ?? [];

  // Chưa có react-router → điều hướng tạm bằng location; sau này truyền linkAs cho kit là xong
  const openList = (href) => { window.location.assign(href); };

  const openDecision = (row, action) => {
    setActionError('');
    setDecision({ row, action });
  };

  const confirmDecision = async (note) => {
    if (!decision || saving) return;
    const { row, action } = decision;
    setSaving(true);
    setActionError('');
    try {
      const save = row.entity === 'post' ? postModerationService.decidePost : postModerationService.decideReport;
      await save(row.id, action, note);
      toast(row.entity === 'post'
        ? (action === 'approve' ? 'Đã duyệt bài viết.' : 'Đã từ chối bài viết; bài chuyển sang Đã xóa.')
        : (action === 'accept' ? 'Đã chấp nhận gỡ bài theo báo cáo.' : 'Đã từ chối gỡ bài theo báo cáo.'));
      setDecision(null);
      retry();
    } catch (err) {
      setActionError(err.message || 'Không thể lưu quyết định. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  // 3 · Cột hàng đợi — render gọi handler của page, kit vẫn không gọi API
  const queueColumns = [
    { key: 'excerpt', header: 'Nội dung', primary: true },
    { key: 'entity', header: 'Loại', width: 110, render: (row) => ENTITY_LABEL[row.entity] ?? row.entity },
    {
      key: 'author',
      header: 'Tác giả',
      width: 180,
      render: (row) => (
        <span className="d-inline-flex align-items-center gap-2">
          <Avatar name={row.author} size={28} />
          <span>{row.author}</span>
        </span>
      ),
    },
    { key: 'reason', header: 'Lý do vào hàng đợi', hideOnMobile: true },
    {
      key: 'createdAt',
      header: 'Chờ bao lâu',
      width: 160,
      render: (row) => {
        const late = isStale(row.createdAt);
        return (
          <span className={late ? 'text-danger fw-semibold' : undefined}>
            {timeAgo(row.createdAt)}{late ? ' · quá 48h' : ''}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <>
          <Button size="sm" icon="check-lg" disabled={saving} onClick={() => openDecision(row, row.entity === 'post' ? 'approve' : 'accept')}>
            {row.entity === 'post' ? 'Duyệt' : 'Chấp nhận gỡ'}
          </Button>
          <Button size="sm" variant="alert" icon="x-lg" disabled={saving} onClick={() => openDecision(row, 'reject')}>
            {row.entity === 'post' ? 'Từ chối' : 'Từ chối gỡ'}
          </Button>
        </>
      ),
    },
  ];

  // 4 · Xu hướng: ↑↓ % so kỳ trước, màu theo việc tăng đó là tốt hay xấu
  const trendHint = (metric) => {
    const up = metric.trend >= 0;
    const good = (GOOD_WHEN_UP[metric.key] ?? true) === up;
    return (
      <span className={good ? 'text-success' : 'text-danger'}>
        <i className={`bi bi-arrow-${up ? 'up' : 'down'}-short`} aria-hidden="true" />
        {`${Math.abs(metric.trend)}% so kỳ trước`}
      </span>
    );
  };

  return (
    <AdminLayout
      activeKey="dashboard"
      title="Bảng điều khiển"
      user={user}
      onLogout={handleLogout}
    >
      <PageHeader
        title="Bảng điều khiển"
        description="Việc cần xử lý trước, cảnh báo ngay sau — số liệu cộng đồng ở dưới cùng."
      />

      {error ? (
        <Notice
          tone="alert"
          title="Không tải được dữ liệu quản trị"
          action={{ label: 'Thử lại', onClick: retry }}
        >
          {error.message || 'Vui lòng kiểm tra kết nối rồi thử lại.'}
        </Notice>
      ) : (
        <>
          {/* 1 · VIỆC CẦN XỬ LÝ — 4 ô, bấm là mở đúng danh sách */}
          <div className="row g-3 mb-4" aria-busy={loading || undefined}>
            {PENDING_CARDS.map((card) => {
              const value = pending[card.key] ?? 0;
              return (
                <div key={card.key} className="col-12 col-md-6 col-xl-3">
                  <StatCard
                    label={card.label}
                    value={value}
                    unit="mục"
                    icon={card.icon}
                    tone={value > 0 ? 'warn' : 'ok'}
                    hint={card.key === 'stale' ? `lâu nhất: ${pending.staleOldestDays ?? 0} ngày` : card.hint}
                    href={card.href}
                    loading={loading}
                  />
                </div>
              );
            })}
          </div>

          {/* 2 · CẢNH BÁO — nổi bật, nằm trên mọi số liệu cộng đồng */}
          <Panel className="mb-4" title="Cảnh báo" icon="bell-fill">
            {loading ? (
              <Skeleton lines={4} />
            ) : alerts.length === 0 ? (
              <EmptyState icon="check2-circle" title="Không có cảnh báo nào">
                Không có mục nào vượt ngưỡng báo cáo hay tăng bất thường.
              </EmptyState>
            ) : (
              <div className="d-flex flex-column gap-3">
                {alerts.map((alert) => (
                  <Notice
                    key={alert.id}
                    tone={alert.tone}
                    title={alert.title}
                    action={{ label: alert.actionLabel, onClick: () => openList(alert.href) }}
                  >
                    {alert.description}
                  </Notice>
                ))}
              </div>
            )}
          </Panel>

          {/* 3 · HÀNG ĐỢI KIỂM DUYỆT */}
          <Panel
            className="mb-4"
            flush
            title="Hàng đợi kiểm duyệt"
            icon="clipboard2-check"
            action={(
              <Button as="a" href="/admin/moderation" variant="subtle" size="sm" icon="arrow-right" iconPosition="end">
                Xem tất cả
              </Button>
            )}
          >
            <DataTable
              caption="Hàng đợi kiểm duyệt: nội dung, loại, tác giả, lý do, thời gian chờ"
              columns={queueColumns}
              rows={queue}
              rowKey={(row) => `${row.entity}-${row.id}`}
              loading={loading}
              empty={{ icon: 'check2-circle', title: 'Đã xử lý hết', children: 'Không còn mục nào trong hàng đợi.' }}
            />
          </Panel>

          {/* 4 · TÌNH HÌNH CỘNG ĐỒNG — chỉ số gọn, KHÔNG biểu đồ */}
          <Panel className="mb-4" title="Hôm nay" icon="graph-up-arrow">
            {loading ? (
              <div className="row g-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={`sk-${i}`} className="col-6 col-lg-4 col-xl">
                    <Skeleton shape="block" height={104} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="row g-3">
                {community.map((metric) => (
                  <div key={metric.key} className="col-6 col-lg-4 col-xl">
                    <StatCard label={metric.label} value={metric.value} unit={metric.unit} hint={trendHint(metric)} />
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* 5 · HOẠT ĐỘNG QUẢN TRỊ GẦN ĐÂY */}
          <Panel
            flush
            title="Hoạt động quản trị gần đây"
            icon="clock-history"
            action={(
              <Button as="a" href="/admin/audit" variant="subtle" size="sm" icon="arrow-right" iconPosition="end">
                Xem tất cả
              </Button>
            )}
          >
            <DataTable
              caption="Nhật ký thao tác quản trị gần đây"
              columns={AUDIT_COLUMNS}
              rows={auditLog}
              rowKey="id"
              loading={loading}
              empty={{ icon: 'inbox', title: 'Chưa có thao tác nào' }}
            />
          </Panel>
        </>
      )}

      <ConfirmDialog
        open={!!decision}
        title={decision?.entity === 'report'
          ? (decision.action === 'accept' ? 'Chấp nhận gỡ bài theo báo cáo?' : 'Từ chối gỡ bài theo báo cáo?')
          : (decision?.action === 'approve' ? 'Duyệt bài viết?' : 'Từ chối bài viết?')}
        message={<>Quyết định sẽ được lưu vào hệ thống và ghi vào nhật ký quản trị.{actionError && <><br /><strong role="alert" className="text-danger">Chưa lưu được quyết định: {actionError}</strong></>}</>}
        confirmLabel={decision?.entity === 'report'
          ? (decision.action === 'accept' ? 'Chấp nhận gỡ bài' : 'Từ chối gỡ bài')
          : (decision?.action === 'approve' ? 'Duyệt bài' : 'Từ chối')}
        tone={decision?.action === 'approve' ? 'primary' : 'alert'}
        reason={decision?.entity === 'post' && decision.action === 'approve' ? false : {
          label: decision?.entity === 'report' && decision.action === 'accept' ? 'Lý do chấp nhận gỡ bài' : 'Lý do từ chối',
          placeholder: 'Nhập lý do xử lý',
          required: true,
        }}
        loading={saving}
        onConfirm={confirmDecision}
        onCancel={() => { if (!saving) setDecision(null); }}
      />
    </AdminLayout>
  );
}
