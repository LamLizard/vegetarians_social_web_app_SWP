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

export function ReportModerationStatus({ status }) {
  const config = REPORT_STATUSES[status];
  return config
    ? <Chip className={config.className} icon={config.icon}>{config.label}</Chip>
    : <Chip>{status || 'Chưa xác định'}</Chip>;
}
