import { useEffect, useState } from 'react';
import { AdminLayout, Button, Checkbox, ConfirmDialog, DataTable, Notice, PageHeader, SearchInput, StatusBadge } from '../components'; // Duy's code: thêm hộp xác nhận xóa.
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

const REPORT_REVIEW_THRESHOLD = 5; // Duy's code: từ 5 report đang chờ thì cần Admin xem xét.

// Duy's code: Giao diện quản lý thành viên dùng component và theme token chung.
export default function AdminMemberManagementPage() {
  const { user, logout } = useAuth();
  const [showOnlyReported, setShowOnlyReported] = useState(true);
  const [search, setSearch] = useState('');
  const [members, setMembersState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyMemberId, setBusyMemberId] = useState(null);
  const [memberToDelete, setMemberToDelete] = useState(null); // Duy's code: lưu thành viên đang chờ xác nhận xóa.
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

  const confirmDeleteMember = async () => { // Duy's code: xác nhận xóa mềm tài khoản.
    if (!memberToDelete) return; // Duy's code: bỏ qua nếu không có mục tiêu.
    setBusyMemberId(memberToDelete.id); // Duy's code: khóa thao tác trong lúc lưu.
    setRequestError(''); // Duy's code: xóa lỗi cũ trước request.
    try { // Duy's code: gọi API và chỉ ẩn dòng khi server thành công.
      await setMemberStatus(memberToDelete.id, 'deleted'); // Duy's code: lưu status deleted trong DB.
      setMembersState((current) => current.filter((row) => row.id !== memberToDelete.id)); // Duy's code: ẩn tài khoản khỏi bảng.
      setMemberToDelete(null); // Duy's code: đóng hộp xác nhận sau khi xóa thành công.
    } catch (error) { // Duy's code: giữ nguyên dữ liệu nếu API thất bại.
      setRequestError(error.message); // Duy's code: hiển thị lỗi để Admin biết kết quả.
      setMemberToDelete(null); // Duy's code: đóng hộp thoại để Notice lỗi trên trang hiển thị.
    } finally { // Duy's code: luôn mở lại thao tác sau request.
      setBusyMemberId(null); // Duy's code: kết thúc trạng thái đang xử lý.
    } // Duy's code: kết thúc xác nhận xóa mềm.
  }; // Duy's code: hoàn tất handler xóa.

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
        <div className="d-flex flex-wrap gap-1"> {/* Duy's code: cho phép hiện các nhãn độc lập. */}
          <StatusBadge entity="account" status={row.status === 'locked' ? 'locked' : 'active'} /> {/* Duy's code: nhãn khóa/hoạt động. */}
          {row.status !== 'locked' && Number(row.reportedCount) >= 1 && <StatusBadge entity="account" status="reported" />} {/* Duy's code: ẩn Reported khi đã khóa, hiện lại sau mở khóa nếu còn pending. */}
          {row.status !== 'locked' && Number(row.reportedCount) >= REPORT_REVIEW_THRESHOLD && <StatusBadge entity="account" status="reported" label="Cần xem xét" />} {/* Duy's code: chỉ hiện ngưỡng xem xét khi chưa khóa. */}
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
          <Button
            size="sm" // Duy's code: giữ nút xóa cùng kích thước hàng.
            variant="alert" // Duy's code: đánh dấu thao tác xóa nguy hiểm.
            icon="trash3" // Duy's code: biểu tượng xóa tài khoản.
            onClick={() => setMemberToDelete(row)} // Duy's code: yêu cầu xác nhận trước khi xóa.
            disabled={busyMemberId === row.id} // Duy's code: ngăn gửi trùng request.
          >
            Xóa {/* Duy's code: nhãn hành động xóa rõ ràng. */}
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
    </AdminLayout>
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
        <Notice tone="alert" title="Không thể xử lý yêu cầu quản lý thành viên"> {/* Duy's code: áp dụng cho lỗi tải, khóa/mở khóa và xóa. */}
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
      <ConfirmDialog
        open={Boolean(memberToDelete)} // Duy's code: chỉ mở khi đã chọn thành viên.
        title="Xóa tài khoản này?" // Duy's code: yêu cầu xác nhận rõ ràng.
        message={memberToDelete ? `Tài khoản ${memberToDelete.fullName} sẽ bị ẩn khỏi danh sách, thông tin vẫn được giữ trong DB với trạng thái deleted.` : undefined} // Duy's code: giải thích đây là xóa mềm.
        confirmLabel="Xóa tài khoản" // Duy's code: ghi rõ nút xác nhận.
        loading={busyMemberId === memberToDelete?.id} // Duy's code: khóa xác nhận trong lúc lưu.
        onConfirm={confirmDeleteMember} // Duy's code: gửi yêu cầu xóa sau xác nhận.
        onCancel={() => setMemberToDelete(null)} // Duy's code: hủy xác nhận, không đổi dữ liệu.
      />
    </AdminLayout>
  );
}
