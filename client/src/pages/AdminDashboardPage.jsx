// Trang chủ khu quản trị (M-14) — route dự kiến /admin
// Thứ tự ưu tiên: việc cần xử lý → cảnh báo → hàng đợi → cộng đồng → nhật ký.
// Page giữ UI + config, còn dữ liệu lấy qua services/admin.service.js (component kit KHÔNG gọi API).
import { useEffect, useState } from 'react';
import {
  AdminLayout, Avatar, Button, ConfirmDialog, DataTable, EmptyState, ENTITY_LABEL, Notice,
  PageHeader, Pagination, Panel, Skeleton, StatCard, formatDateTime, useToast,
} from '../components';
import { describeAuditAction } from '../constants/domain';
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

const EMPTY_PAGE = { items: [], page: 1, pageSize: 5, totalPages: 1, totalItems: 0, loading: true, error: null };

const truncated = (value) => (
  <span title={value || ''} style={{ display: 'block', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
    {value || '—'}
  </span>
);

export default function AdminDashboardPage() {
  const toast = useToast();
  const { user, logout } = useAuth();

  const [board, setBoard] = useState(null);
  const [alerts, setAlerts] = useState(EMPTY_PAGE);
  const [queue, setQueue] = useState(EMPTY_PAGE);
  const [audit, setAudit] = useState(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [alertsReloadKey, setAlertsReloadKey] = useState(0);
  const [queueReloadKey, setQueueReloadKey] = useState(0);
  const [auditReloadKey, setAuditReloadKey] = useState(0);
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
      })
      .catch((err) => { if (alive) setError(err); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [reloadKey]);

  useEffect(() => {
    let alive = true;
    setAlerts((current) => ({ ...current, loading: true, error: null }));
    adminService.getAlerts(alerts.page)
      .then((data) => { if (alive) setAlerts({ ...data, loading: false, error: null }); })
      .catch((err) => { if (alive) setAlerts((current) => ({ ...current, loading: false, error: err })); });
    return () => { alive = false; };
  }, [alerts.page, alertsReloadKey]);

  useEffect(() => {
    let alive = true;
    setQueue((current) => ({ ...current, loading: true, error: null }));
    adminService.getQueue(queue.page)
      .then((data) => { if (alive) setQueue({ ...data, loading: false, error: null }); })
      .catch((err) => { if (alive) setQueue((current) => ({ ...current, loading: false, error: err })); });
    return () => { alive = false; };
  }, [queue.page, queueReloadKey]);

  useEffect(() => {
    let alive = true;
    setAudit((current) => ({ ...current, loading: true, error: null }));
    adminService.getAudit(audit.page)
      .then((data) => { if (alive) setAudit({ ...data, loading: false, error: null }); })
      .catch((err) => { if (alive) setAudit((current) => ({ ...current, loading: false, error: err })); });
    return () => { alive = false; };
  }, [audit.page, auditReloadKey]);

  const retry = () => setReloadKey((k) => k + 1);
  const pending = board?.pendingStats ?? {};
  const community = board?.community ?? [];

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
      await postModerationService.decidePost(row.id, action, note);
      toast(action === 'approve' ? 'Đã duyệt bài viết.' : 'Đã từ chối bài viết; bài chuyển sang Đã xóa.');
      setDecision(null);
      retry();
      setQueueReloadKey((key) => key + 1);
      setAuditReloadKey((key) => key + 1);
    } catch (err) {
      setActionError(err.message || 'Không thể lưu quyết định. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  // 3 · Cột hàng đợi — render gọi handler của page, kit vẫn không gọi API
  const queueColumns = [
    { key: 'excerpt', header: 'Nội dung', primary: true, width: 250, render: (row) => truncated(row.excerpt) },
    { key: 'entity', header: 'Loại', width: 95, render: (row) => ENTITY_LABEL[row.entity] ?? row.entity },
    {
      key: 'author',
      header: 'Tác giả',
      width: 150,
      render: (row) => (
        <span className="d-inline-flex align-items-center gap-2">
          <Avatar name={row.author} size={26} />
          {truncated(row.author)}
        </span>
      ),
    },
    { key: 'reason', header: 'Lý do vào hàng đợi', width: 155, render: (row) => truncated(row.reason) },
    { key: 'createdAt', header: 'Ngày được gửi', width: 145, render: (row) => formatDateTime(row.createdAt) },
    {
      key: 'actions',
      header: '',
      width: 190,
      align: 'right',
      render: (row) => row.entity === 'post' ? (
        <>
          <Button size="sm" icon="check-lg" disabled={saving} onClick={() => openDecision(row, 'approve')}>Duyệt</Button>
          <Button size="sm" variant="alert" icon="x-lg" disabled={saving} onClick={() => openDecision(row, 'reject')}>Từ chối</Button>
        </>
      ) : null,
    },
  ];

  const auditColumns = [
    { key: 'admin', header: 'Admin', width: 145, render: (row) => truncated(row.admin) },
    { key: 'action', header: 'Hành động', width: 190, render: (row) => truncated(describeAuditAction(row.action, row.targetType)) },
    { key: 'targetEmail', header: 'Đối tượng', width: 190, render: (row) => truncated(row.targetEmail) },
    { key: 'targetType', header: 'Loại', width: 130 },
    { key: 'at', header: 'Thời gian', width: 145, render: (row) => formatDateTime(row.at) },
    { key: 'reason', header: 'Lý do', width: 210, render: (row) => truncated(row.reason) },
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

      {error && (
        <Notice tone="alert" title="Không tải được số liệu quản trị" action={{ label: 'Thử lại', onClick: retry }}>
          {error.message || 'Vui lòng kiểm tra kết nối rồi thử lại.'}
        </Notice>
      )}
      {!error && <>
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
          </>}

          {/* 2 · CẢNH BÁO — nổi bật, nằm trên mọi số liệu cộng đồng */}
          <Panel className="mb-4" title="Cảnh báo" icon="bell-fill" action={(
            <Button as="a" href="/admin/moderation?type=report" variant="subtle" size="sm" icon="arrow-right" iconPosition="end">
              Xem tất cả
            </Button>
          )}>
            {alerts.error ? (
              <Notice tone="alert" title="Không tải được cảnh báo" action={{ label: 'Thử lại', onClick: () => setAlertsReloadKey((key) => key + 1) }}>
                {alerts.error.message || 'Vui lòng thử lại sau.'}
              </Notice>
            ) : alerts.loading ? (
              <Skeleton lines={4} />
            ) : alerts.items.length === 0 ? (
              <EmptyState icon="check2-circle" title="Không có cảnh báo nào">
                Không có mục nào vượt ngưỡng báo cáo hay tăng bất thường.
              </EmptyState>
            ) : (
              <div className="d-flex flex-column gap-3">
                {alerts.items.map((alert) => (
                  <Notice
                    key={alert.id}
                    tone={alert.tone}
                    title={alert.title}
                  />
                ))}
              </div>
            )}
            {!alerts.loading && !alerts.error && <Pagination page={alerts.page} totalPages={alerts.totalPages}
              totalItems={alerts.totalItems} pageSize={alerts.pageSize} onChange={(page) => setAlerts((current) => ({ ...current, page }))} />}
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
            {queue.error ? (
              <div className="p-3"><Notice tone="alert" title="Không tải được hàng đợi" action={{ label: 'Thử lại', onClick: () => setQueueReloadKey((key) => key + 1) }}>
                {queue.error.message || 'Vui lòng thử lại sau.'}
              </Notice></div>
            ) : (
              <DataTable
                caption="Hàng đợi kiểm duyệt: nội dung, loại, tác giả, lý do, ngày được gửi"
                columns={queueColumns}
                rows={queue.items}
                rowKey={(row) => `${row.entity}-${row.id}`}
                loading={queue.loading}
                empty={{ icon: 'check2-circle', title: 'Đã xử lý hết', children: 'Không còn mục nào trong hàng đợi.' }}
                footer={!queue.loading && <Pagination page={queue.page} totalPages={queue.totalPages} totalItems={queue.totalItems}
                  pageSize={queue.pageSize} onChange={(page) => setQueue((current) => ({ ...current, page }))} />}
              />
            )}
          </Panel>

          {/* 4 · TÌNH HÌNH CỘNG ĐỒNG — chỉ số gọn, KHÔNG biểu đồ */}
          {!error && <Panel className="mb-4" title="Hôm nay" icon="graph-up-arrow">
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
          </Panel>}

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
            {audit.error ? (
              <div className="p-3"><Notice tone="alert" title="Không tải được nhật ký" action={{ label: 'Thử lại', onClick: () => setAuditReloadKey((key) => key + 1) }}>
                {audit.error.message || 'Vui lòng thử lại sau.'}
              </Notice></div>
            ) : (
              <DataTable
                caption="Nhật ký thao tác quản trị gần đây"
                columns={auditColumns}
                rows={audit.items}
                rowKey="id"
                loading={audit.loading}
                empty={{ icon: 'inbox', title: 'Chưa có thao tác nào' }}
                footer={!audit.loading && <Pagination page={audit.page} totalPages={audit.totalPages} totalItems={audit.totalItems}
                  pageSize={audit.pageSize} onChange={(page) => setAudit((current) => ({ ...current, page }))} />}
              />
            )}
          </Panel>
      <ConfirmDialog
        open={!!decision}
        title={decision?.action === 'approve' ? 'Duyệt bài viết?' : 'Từ chối bài viết?'}
        message={<>Quyết định sẽ được lưu vào hệ thống và ghi vào nhật ký quản trị.{actionError && <><br /><strong role="alert" className="text-danger">Chưa lưu được quyết định: {actionError}</strong></>}</>}
        confirmLabel={decision?.action === 'approve' ? 'Duyệt bài' : 'Từ chối'}
        tone={decision?.action === 'approve' ? 'primary' : 'alert'}
        reason={decision?.action === 'approve' ? false : {
          label: 'Lý do từ chối',
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
