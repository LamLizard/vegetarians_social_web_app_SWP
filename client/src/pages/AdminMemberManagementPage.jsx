import { useEffect, useState } from 'react';
import { AdminLayout, Button, Checkbox, DataTable, Notice, PageHeader, SearchInput, StatusBadge } from '../components'; // Duy's code: dùng StatusBadge.
import useAuth from '../hooks/useAuth';
import { getMembers, setMemberStatus } from '../services/admin-member.service';

const ADMIN_NAV = [
  { key: 'dashboard', label: 'Bảng điều khiển', icon: 'speedometer2', href: '/admin' },
  { key: 'moderation', label: 'Kiểm duyệt', icon: 'clipboard2-check', href: '/admin/moderation' },
  { key: 'appeals', label: 'Khiếu nại', icon: 'envelope-paper', href: '/admin/appeals' },
  { key: 'accounts', label: 'Tài khoản', icon: 'people', href: '/admin/accounts' },
  { key: 'categories', label: 'Danh mục', icon: 'tags', href: '/admin/categories' },
  { divider: true },
  { key: 'site', label: 'Xem trang người dùng', icon: 'box-arrow-up-right', href: '/' },
];

// Duy's code: Giao diện quản lý thành viên dùng component và theme token chung.
export default function AdminMemberManagementPage() {
  const { user, logout } = useAuth();
  const [showOnlyReported, setShowOnlyReported] = useState(true);
  const [search, setSearch] = useState('');
  const [members, setMembersState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyMemberId, setBusyMemberId] = useState(null);
  const [requestError, setRequestError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setRequestError('');
    getMembers({ showOnlyReported, keyword: search })
      .then((rows) => { if (active) setMembersState(rows); })
      .catch((error) => { if (active) setRequestError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, showOnlyReported]);

  const handleStatusChange = async (member) => {
    const status = member.status === 'locked' ? 'active' : 'locked';
    setBusyMemberId(member.id);
    setRequestError('');
    try {
      const updatedMember = await setMemberStatus(member.id, status);
      setMembersState((current) => current.map((row) => (
        row.id === member.id ? { ...row, status: updatedMember.status } : row
      )));
    } catch (error) {
      setRequestError(error.message);
    } finally {
      setBusyMemberId(null);
    }
  };

  const columns = [
    {
      key: 'fullName',
      header: 'Tên thành viên',
      primary: true,
      render: (row) => (
        <div>
          <div className="fw-semibold">{row.fullName}</div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row) => ( // Duy's code: tách report khỏi trạng thái truy cập.
        <div className="d-flex flex-wrap gap-1"> {/* Duy's code: cho phép hiện hai nhãn. */}
          <StatusBadge entity="account" status={row.status === 'locked' ? 'locked' : 'active'} /> {/* Duy's code: nhãn khóa/hoạt động. */}
          {Number(row.reportedCount) >= 1 && <StatusBadge entity="account" status="reported" />} {/* Duy's code: nhãn khi còn report pending. */}
          {/* Duy's code: kết thúc nhóm trạng thái. */}</div>
      ), // Duy's code: render status account và report độc lập.
    },
    {
      key: 'reportedCount',
      header: 'Reported',
      align: 'center',
      render: (row) => <span className="fw-semibold">{row.reportedCount}</span>,
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      render: (row) => new Date(row.createdAt).toLocaleDateString('vi-VN'),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      render: (row) => (
        <div className="d-flex justify-content-end gap-2">
          <Button
            size="sm"
            variant={row.status === 'locked' ? 'outline' : 'alert'}
            icon={row.status === 'locked' ? 'unlock' : 'lock'}
            onClick={() => handleStatusChange(row)}
            disabled={busyMemberId === row.id}
            loading={busyMemberId === row.id}
          >
            {row.status === 'locked' ? 'Mở khóa' : 'Khóa'}
          </Button>
        </div>
      ),
    },
  ];

  const filters = (
    <div className="d-flex flex-column flex-sm-row gap-3 align-items-sm-center">
      <Checkbox
        checked={showOnlyReported}
        switch
        onChange={setShowOnlyReported}
      >
        Chỉ hiện reported
      </Checkbox>
      <div style={{ width: 'min(100%, 260px)' }}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Tìm thành viên"
          label="Tìm thành viên"
          size="sm"
        />
      </div>
    </div>
  );

  const adminUser = { name: user?.fullName || 'Quản trị viên', avatarUrl: user?.avatarUrl || '' };
  const accountMenu = [
    { icon: 'box-arrow-right', label: 'Đăng xuất', tone: 'alert', onClick: logout },
  ];

  return (
    <AdminLayout
      nav={ADMIN_NAV}
      activeKey="accounts"
      title="Tài khoản"
      user={adminUser}
      accountMenu={accountMenu}
    >
      <PageHeader title="Quản lý thành viên" actions={filters} />
      {requestError && (
        <Notice tone="alert" title="Không tải được danh sách thành viên">
          {requestError}
        </Notice>
      )}
      <DataTable
        caption="Danh sách thành viên"
        rows={loading ? [] : members}
        rowKey="id"
        columns={columns}
        empty={{
          title: loading ? 'Đang tải thành viên...' : 'Không tìm thấy thành viên',
          children: loading ? 'Đang lấy dữ liệu từ máy chủ.' : 'Thử thay đổi từ khóa hoặc bộ lọc.',
        }}
      />
    </AdminLayout>
  );
}
