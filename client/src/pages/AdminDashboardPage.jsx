// Trang chủ khu quản trị (M-14) — route dự kiến /admin
// Page cầm dữ liệu rồi truyền props; component kit KHÔNG gọi API.
import {
  AdminLayout, Button, DataTable, PageHeader, Panel, StatCard, StatusBadge, formatDate,
} from '../components';

// ---------------------------------------------------------------------
// DỮ LIỆU TẠM — chưa có API admin, khai báo ngay trong page
// TODO: thay bằng admin.service.js khi có API
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

// href trỏ sẵn sang đúng hàng chờ (chưa có react-router → kit tự dùng thẻ <a>)
// TODO: thay bằng admin.service.js khi có API (GET /admin/stats)
const STATS = [
  { key: 'post', label: 'Post chờ duyệt', value: 8, icon: 'journal-text', hint: 'Bài đăng do thành viên gửi', href: '/admin/moderation?type=post' },
  { key: 'dish', label: 'Dish chờ duyệt', value: 5, icon: 'egg-fried', hint: 'Món mới do thành viên tạo', href: '/admin/moderation?type=dish' },
  { key: 'shop', label: 'Shop chờ xác minh', value: 3, icon: 'shop', hint: 'Quán đăng ký tham gia', href: '/admin/moderation?type=shop' },
  { key: 'report', label: 'Report chờ xử lý', value: 4, icon: 'flag', hint: 'Báo cáo vi phạm từ người dùng', href: '/admin/moderation?type=report' },
];

// 5 dòng mẫu cho "Hàng chờ gần đây"
// TODO: thay bằng admin.service.js khi có API (GET /admin/moderation?limit=5)
const RECENT_QUEUE = [
  { id: 1, entity: 'post', typeLabel: 'Bài đăng', title: 'Bún riêu chay nấm rơm — công thức của mẹ', createdAt: '2026-09-27T08:35:00', status: 'pending' },
  { id: 2, entity: 'dish', typeLabel: 'Món ăn', title: 'Đậu hũ sốt nấm đông cô', createdAt: '2026-09-27T07:10:00', status: 'pending' },
  { id: 3, entity: 'shop', typeLabel: 'Quán', title: 'Quán chay An Nhiên (Q.1)', createdAt: '2026-09-26T19:40:00', status: 'pending' },
  { id: 4, entity: 'report', typeLabel: 'Báo cáo', title: "Báo cáo bình luận quảng cáo trong bài 'Gỏi cuốn chay'", createdAt: '2026-09-26T15:05:00', status: 'pending' },
  { id: 5, entity: 'dish', typeLabel: 'Món ăn', title: 'Gỏi cuốn chay chấm tương đậu', createdAt: '2026-09-25T21:20:00', status: 'pending' },
];

// Cột của bảng: Loại · Tiêu đề · Ngày gửi · Trạng thái
const QUEUE_COLUMNS = [
  { key: 'typeLabel', header: 'Loại', width: 140 },
  { key: 'title', header: 'Tiêu đề', primary: true },
  { key: 'createdAt', header: 'Ngày gửi', width: 160, render: (row) => formatDate(row.createdAt) },
  { key: 'status', header: 'Trạng thái', width: 170, render: (row) => <StatusBadge entity={row.entity} status={row.status} size="sm" /> },
];

export default function AdminDashboardPage() {
  const pendingTotal = STATS.reduce((sum, stat) => sum + stat.value, 0);
  const nav = ADMIN_NAV.map((item) => (item.key === 'moderation' ? { ...item, badge: pendingTotal } : item));

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

      <div className="row g-3 mb-4">
        {STATS.map((stat) => (
          <div key={stat.key} className="col-12 col-md-6 col-xl-3">
            <StatCard
              label={stat.label}
              value={stat.value}
              unit="mục"
              icon={stat.icon}
              tone={stat.value > 0 ? 'warn' : 'ok'}
              hint={stat.hint}
              href={stat.href}
            />
          </div>
        ))}
      </div>

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
          rows={RECENT_QUEUE}
          rowKey="id"
          empty={{ icon: 'check2-circle', title: 'Đã xử lý hết', children: 'Không còn mục nào chờ duyệt.' }}
        />
      </Panel>
    </AdminLayout>
  );
}
