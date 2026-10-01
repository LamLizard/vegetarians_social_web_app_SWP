// Nhãn riêng của module Tung: giữ nguyên enum database và constants/component dùng chung.
import { Chip, StatusBadge } from '../components';

const REPORT_STATUSES = {
  pending: { label: 'Chờ xử lý', className: 'text-warning', icon: 'hourglass-split' },
  accepted: { label: 'Đã chấp nhận gỡ bài', className: 'text-success', icon: 'check-circle' },
  rejected: { label: 'Đã từ chối gỡ bài', className: 'text-secondary', icon: 'x-circle' },
};

export function PostModerationStatus({ status }) {
  return status === 'reported'
    ? <Chip icon="flag">Công khai — có báo cáo</Chip>
    : <StatusBadge entity="post" status={status} />;
}

// Tung's code: Dùng cùng trạng thái report/case, nhưng nhãn thao tác phải đúng
// target. Mặc định post để những chỗ thống kê report của bài vẫn giữ nhãn cũ.
export function ReportModerationStatus({ status, targetType = 'post' }) {
  const config = REPORT_STATUSES[status];
  const label = targetType === 'comment' && status === 'accepted' ? 'Đã chấp nhận xóa bình luận'
    : targetType === 'comment' && status === 'rejected' ? 'Đã từ chối xóa bình luận' : config?.label;
  return config
    ? <Chip className={config.className} icon={config.icon}>{label}</Chip>
    : <Chip>{status || 'Chưa xác định'}</Chip>;
}
