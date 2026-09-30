const pool = require('../src/config/db');
const adminModel = require('../src/models/admin.model');

function warnWhenEmpty(label, count) {
  if (count === 0) console.warn(`CẢNH BÁO: ${label} hiện không có dữ liệu.`);
}

async function main() {
  const [dashboard, alerts, queue, audit] = await Promise.all([
    adminModel.getDashboard(),
    adminModel.getAlerts(1),
    adminModel.getQueue(1),
    adminModel.getAudit(1),
  ]);
  const stats = dashboard.pendingStats;
  const pendingTotal = stats.post + stats.report + stats.appeals;

  console.log('=== pendingStats ===');
  console.log(`Bài viết chờ: ${stats.post}`);
  console.log(`Báo cáo chờ: ${stats.report}`);
  console.log(`Khiếu nại chờ: ${stats.appeals}`);
  console.log(`Tồn đọng quá 48 giờ: ${stats.stale}`);
  console.log(`Số ngày của mục cũ nhất: ${stats.staleOldestDays}`);
  warnWhenEmpty('Hàng chờ quản trị', pendingTotal);

  console.log('\n=== Cảnh báo ===');
  console.log(`Số nhóm cảnh báo: ${alerts.totalItems}`);
  warnWhenEmpty('Cảnh báo', alerts.totalItems);

  console.log('\n=== Hàng đợi kiểm duyệt ===');
  console.log(`Số dòng hàng đợi: ${queue.totalItems}`);
  warnWhenEmpty('Hàng đợi kiểm duyệt', queue.totalItems);

  console.log('\n=== Nhật ký quản trị ===');
  console.log(`Số dòng nhật ký: ${audit.totalItems}`);
  warnWhenEmpty('Nhật ký quản trị', audit.totalItems);
  if (audit.items.length > 0) {
    console.log('Ba dòng mới nhất (admin · hành động · thời gian):');
    audit.items.slice(0, 3).forEach((row) => {
      const at = new Date(row.at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
      console.log(`${row.admin || '—'} · ${row.action || '—'} · ${at}`);
    });
  }
}

main()
  .catch((error) => {
    console.error('Không thể kiểm tra dữ liệu Dashboard:', error.message || error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());