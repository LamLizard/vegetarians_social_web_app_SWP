// Trang chủ khu quản trị (M-14) — route dự kiến /admin
// Page giữ UI + config, còn dữ liệu lấy qua services/admin.service.js (component kit KHÔNG gọi API).
import { useEffect, useState } from 'react';
import {
  AdminLayout, Button, DataTable, ENTITY_LABEL, Notice, PageHeader, Panel, StatCard, StatusBadge, formatDate,
} from '../components';
import adminService from '../services/admin.service';

// ---------------------------------------------------------------------
// CONFIG UI + USER TẠM — số liệu & hàng chờ lấy từ admin.service.js
// TODO: lấy user thật từ AuthContext khi có route /admin
// ---------------------------------------------------------------------

const ADMIN_USER = { name: 'Quản trị viên', avatarUrl: '' };

const ADMIN_NAV = [
  { key: 'dashboard', label: 'Bảng điều khiển', icon: 'speedometer2', href: '/admin' },
  { key: 'moderation', label: 'Kiểm duyệt', icon: 'clipboard2-check', href: '/admin/moderation' },
  { key: 'accounts', label: 'Tài khoản', icon: 'people', href: '/admin/accounts' },
  { key: 'categories', label: 'Danh mục', icon: 'tags', href: '/admin/categories' },
  { divider: true },
  { key: 'site', label: 'Xem trang người dùng', icon: 'box-arrow-up-right', href: '/' },
];

const ADMIN_ACCOUNT_MENU = [
  { icon: 'house-door', label: 'Về bảng tin' },
  { divider: true },
  { icon: 'box-arrow-right', label: 'Đăng xuất', tone: 'alert' },
];

// 4 ô số liệu: label/icon/hint/href là config UI (chỉ dùng ở đây), còn `value` lấy từ API theo `key`
// href trỏ sẵn sang đúng hàng chờ (chưa có react-router → kit tự dùng thẻ <a>)
const STAT_CARDS = [
  { key: 'post', label: 'Post chờ duyệt', icon: 'journal-text', hint: 'Bài đăng do thành viên gửi', href: '/admin/moderation?type=post' },
  { key: 'dish', label: 'Dish chờ duyệt', icon: 'egg-fried', hint: 'Món mới do thành viên tạo', href: '/admin/moderation?type=dish' },
  { key: 'shop', label: 'Shop chờ xác minh', icon: 'shop', hint: 'Quán đăng ký tham gia', href: '/admin/moderation?type=shop' },
  { key: 'report', label: 'Report chờ xử lý', icon: 'flag', hint: 'Báo cáo vi phạm từ người dùng', href: '/admin/moderation?type=report' },
];

// Cột của bảng: Loại · Tiêu đề · Ngày gửi · Trạng thái
const QUEUE_COLUMNS = [
  { key: 'typeLabel', header: 'Loại', width: 140, render: (row) => ENTITY_LABEL[row.entity] ?? row.entity },
  { key: 'title', header: 'Tiêu đề', primary: true },
  { key: 'createdAt', header: 'Ngày gửi', width: 160, render: (row) => formatDate(row.createdAt) },
  { key: 'status', header: 'Trạng thái', width: 170, render: (row) => <StatusBadge entity={row.entity} status={row.status} size="sm" /> },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Page cầm dữ liệu. Bấm "Thử lại" → tăng reloadKey → effect chạy lại.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([adminService.getDashboardStats(), adminService.getRecentQueue(5)])
      .then(([nextStats, nextQueue]) => {
        if (!alive) return;
        setStats(nextStats);
        setQueue(nextQueue);
      })
      .catch((err) => { if (alive) setError(err); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [reloadKey]);

  const retry = () => setReloadKey((k) => k + 1);
  const valueOf = (key) => stats.find((stat) => stat.key === key)?.value ?? 0;
  const pendingTotal = stats.reduce((sum, stat) => sum + (Number(stat.value) || 0), 0);
  const nav = ADMIN_NAV.map((item) => (item.key === 'moderation' && pendingTotal > 0 ? { ...item, badge: pendingTotal } : item));

  // Khu số liệu: vẫn là StatCard thật + prop loading của kit (kit tự vẽ Skeleton) → giữ nguyên bố cục
  const statCards = (
    <div className="row g-3 mb-4" aria-busy={loading || undefined}>
      {STAT_CARDS.map((card) => {
        const value = valueOf(card.key);
        return (
          <div key={card.key} className="col-12 col-md-6 col-xl-3">
            <StatCard
              label={card.label}
              value={value}
              unit="mục"
              icon={card.icon}
              tone={value > 0 ? 'warn' : 'ok'}
              hint={card.hint}
              href={card.href}
              loading={loading}
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <AdminLayout
      nav={nav}
      activeKey="dashboard"
      title="Bảng điều khiển"
      user={ADMIN_USER}
      accountMenu={ADMIN_ACCOUNT_MENU}
    >
      <PageHeader
        title="Bảng điều khiển"
        description="Tổng quan việc cần xử lý trong khu quản trị. Bấm vào ô số liệu để mở đúng hàng chờ."
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
          {statCards}

          <Panel
            flush
            title="Hàng chờ gần đây"
            icon="clock-history"
            action={(
              <Button as="a" href="/admin/moderation" variant="subtle" size="sm" icon="arrow-right" iconPosition="end">
                Xem tất cả
              </Button>
            )}
          >
            <DataTable
              caption="5 mục mới nhất đang chờ duyệt"
              columns={QUEUE_COLUMNS}
              rows={queue}
              rowKey="id"
              loading={loading}
              empty={{ icon: 'check2-circle', title: 'Đã xử lý hết', children: 'Không còn mục nào chờ duyệt.' }}
            />
          </Panel>
        </>
      )}
    </AdminLayout>
  );
}
