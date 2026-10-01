import { useEffect, useState } from 'react';
import { AdminLayout, Button, Checkbox, ConfirmDialog, DataTable, Notice, PageHeader, Pagination, Panel, SearchInput, StatusBadge } from '../components'; // Duy's code: bổ sung filter và phân trang tài khoản.
import useAuth from '../hooks/useAuth';
import { REPORT_REASON } from '../constants/domain'; // Duy's code: dịch reason_code theo enum hiện có trên DB.
import { decideAccountReport, getAccountReports, getMembers, setMemberStatus } from '../services/admin-member.service';

const ADMIN_NAV = [
  { key: 'dashboard', label: 'Bảng điều khiển', icon: 'speedometer2', href: '/admin' },
  { key: 'moderation', label: 'Kiểm duyệt', icon: 'clipboard2-check', href: '/admin/moderation' },
  { key: 'appeals', label: 'Khiếu nại', icon: 'envelope-paper', href: '/admin/appeals' },
  { key: 'accounts', label: 'Tài khoản', icon: 'people', href: '/admin/accounts' },
  { key: 'categories', label: 'Danh mục', icon: 'tags', href: '/admin/categories' },
  { divider: true },
  { key: 'site', label: 'Xem trang người dùng', icon: 'box-arrow-up-right', href: '/' },
];

const MEMBER_PAGE_SIZE = 10; // Duy's code: giới hạn 10 tài khoản trên mỗi trang.
const REPORTED_ACCOUNT_PAGE_SIZE = 5; // Duy's code: giới hạn 5 tài khoản report trên mỗi trang.

// Duy's code: Giao diện quản lý thành viên dùng component và theme token chung.
export default function AdminMemberManagementPage() {
  const { user, logout } = useAuth();
  const [memberSearch, setMemberSearch] = useState(''); // Duy's code: tìm tên/email ở bảng thành viên.
  const [showLockedOnly, setShowLockedOnly] = useState(false); // Duy's code: chỉ lọc tài khoản đang khóa khi bật.
  const [memberPage, setMemberPage] = useState(1); // Duy's code: trang hiện tại của bảng thành viên.
  const [reportSearch, setReportSearch] = useState(''); // Duy's code: chỉ tìm trong bảng report tài khoản.
  const [reportedAccountPage, setReportedAccountPage] = useState(1); // Duy's code: trang hiện tại của bảng report.
  const [members, setMembersState] = useState([]);
  const [reportedAccounts, setReportedAccounts] = useState([]); // Duy's code: các case account đang chờ.
  const [membersLoading, setMembersLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [busyMemberId, setBusyMemberId] = useState(null);
  const [busyCaseId, setBusyCaseId] = useState(null); // Duy's code: tránh trùng ID member và report_case.
  const [memberToDelete, setMemberToDelete] = useState(null); // Duy's code: lưu thành viên đang chờ xác nhận xóa.
  const [caseDecision, setCaseDecision] = useState(null); // Duy's code: case và quyết định cần xác nhận.
  const [requestError, setRequestError] = useState('');

  // Duy's code: lọc và phân trang phía client, không thay đổi API hay database.
  const normalizedMemberSearch = memberSearch.trim().toLocaleLowerCase('vi');
  const filteredMembers = members.filter((member) => {
    const matchesStatus = !showLockedOnly || member.status === 'locked';
    const searchableText = `${member.fullName || ''} ${member.email || ''}`.toLocaleLowerCase('vi');
    return matchesStatus && (!normalizedMemberSearch || searchableText.includes(normalizedMemberSearch));
  });
  const totalMemberPages = Math.max(1, Math.ceil(filteredMembers.length / MEMBER_PAGE_SIZE));
  const currentMemberPage = Math.min(memberPage, totalMemberPages);
  const visibleMembers = filteredMembers.slice(
    (currentMemberPage - 1) * MEMBER_PAGE_SIZE,
    currentMemberPage * MEMBER_PAGE_SIZE,
  );
  const totalReportedAccountPages = Math.max(1, Math.ceil(reportedAccounts.length / REPORTED_ACCOUNT_PAGE_SIZE));
  const currentReportedAccountPage = Math.min(reportedAccountPage, totalReportedAccountPages);
  const visibleReportedAccounts = reportedAccounts.slice(
    (currentReportedAccountPage - 1) * REPORTED_ACCOUNT_PAGE_SIZE,
    currentReportedAccountPage * REPORTED_ACCOUNT_PAGE_SIZE,
  );

  useEffect(() => {
    let active = true;
    setMembersLoading(true);
    getMembers()
      .then((rows) => { if (active) setMembersState(rows); })
      .catch((error) => { if (active) setRequestError(error.message); })
      .finally(() => { if (active) setMembersLoading(false); });
    return () => { active = false; };
  }, []);

  // Duy's code: filter tên/email chỉ ảnh hưởng danh sách account report.
  useEffect(() => {
    let active = true;
    setReportsLoading(true);
    getAccountReports(reportSearch)
      .then((rows) => { if (active) setReportedAccounts(rows); })
      .catch((error) => { if (active) setRequestError(error.message); })
      .finally(() => { if (active) setReportsLoading(false); });
    return () => { active = false; };
  }, [reportSearch]);

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

  // Duy's code: quyết định cập nhật report_case, report và trạng thái account trong backend.
  const confirmCaseDecision = async () => {
    if (!caseDecision) return;
    const { reportCase, action } = caseDecision;
    setBusyCaseId(reportCase.caseId);
    setRequestError('');
    try {
      const result = await decideAccountReport(reportCase.caseId, action);
      setMembersState((current) => current.map((row) => (
        row.id === result.accountId ? { ...row, status: result.status } : row
      )));
      setReportedAccounts((current) => current.filter((row) => row.caseId !== reportCase.caseId));
      setCaseDecision(null);
    } catch (error) {
      setRequestError(error.message);
      setCaseDecision(null);
    } finally {
      setBusyCaseId(null);
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
      render: (row) => <StatusBadge entity="account" status={row.status === 'locked' ? 'locked' : 'active'} />,
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

  // Duy's code: một dòng báo cáo tổng hợp các report gắn chung report_case.
  const reportColumns = [
    { key: 'fullName', header: 'Tên tài khoản', primary: true },
    { key: 'email', header: 'Email' },
    { key: 'reportedCount', header: 'Số lượt báo cáo', align: 'center' },
    {
      key: 'reports',
      header: 'Lý do báo cáo',
      render: (row) => (
        <div className="d-flex flex-column gap-2">
          {row.reports.map((report) => (
            <div key={report.id}>
              <div className="fw-semibold">{REPORT_REASON[report.reasonCode] || report.reasonCode}</div>
              {report.reasonText && <div className="small text-body-secondary">{report.reasonText}</div>}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'latestReportAt',
      header: 'Ngày bị báo cáo',
      render: (row) => (
        <div className="d-flex flex-column gap-2">
          {row.reports.map((report) => (
            <time key={report.id} dateTime={report.createdAt}>
              {new Date(report.createdAt).toLocaleString('vi-VN')}
            </time>
          ))}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      render: (row) => (
        <div className="d-flex flex-wrap justify-content-end gap-2">
          <Button size="sm" variant="alert" icon="lock" disabled={busyCaseId === row.caseId}
            onClick={() => setCaseDecision({ reportCase: row, action: 'accept' })}>
            Chấp nhận khóa
          </Button>
          <Button size="sm" variant="outline" icon="x-circle" disabled={busyCaseId === row.caseId}
            onClick={() => setCaseDecision({ reportCase: row, action: 'reject' })}>
            Từ chối
          </Button>
        </div>
      ),
    },
  ];

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
      <PageHeader title="Quản lý thành viên" />
      {requestError && (
        <Notice tone="alert" title="Không thể xử lý yêu cầu quản lý thành viên"> {/* Duy's code: áp dụng cho lỗi tải, khóa/mở khóa và xóa. */}
          {requestError}
        </Notice>
      )}
      <section aria-labelledby="members-table-heading" className="mb-4">
        <h2 id="members-table-heading" className="h4">Tài khoản thành viên</h2>
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3">
          <Checkbox
            checked={showLockedOnly}
            switch
            onChange={(checked) => {
              setShowLockedOnly(checked);
              setMemberPage(1);
            }}
          >
            Chỉ hiện tài khoản bị khóa
          </Checkbox>
          <div style={{ width: 'min(100%, 320px)' }}>
            <SearchInput
              value={memberSearch}
              onChange={(value) => {
                setMemberSearch(value);
                setMemberPage(1);
              }}
              placeholder="Tìm tên tài khoản hoặc email"
              label="Tìm thành viên theo tên hoặc email"
              size="sm"
            />
          </div>
        </div>
        <DataTable
          caption="Danh sách tài khoản thành viên"
          rows={membersLoading ? [] : visibleMembers}
          loading={membersLoading}
          rowKey="id"
          columns={columns}
          footer={!membersLoading && (
            <Pagination
              page={currentMemberPage}
              totalPages={totalMemberPages}
              onChange={setMemberPage}
              totalItems={filteredMembers.length}
              pageSize={MEMBER_PAGE_SIZE}
              itemLabel="tài khoản"
            />
          )}
          empty={{
            title: membersLoading ? 'Đang tải thành viên...' : 'Chưa có thành viên',
            children: membersLoading ? 'Đang lấy dữ liệu từ máy chủ.' : 'Danh sách tài khoản thành viên đang trống.',
          }}
        />
      </section>
      <Panel title="Tài khoản bị báo cáo" icon="flag" flush className="mb-4">
        <div className="p-3 border-bottom">
          <div style={{ width: 'min(100%, 320px)' }}>
            <SearchInput value={reportSearch} onChange={(value) => {
              setReportSearch(value);
              setReportedAccountPage(1);
            }}
              placeholder="Tìm thành viên bị báo cáo" label="Tìm thành viên bị báo cáo" size="sm" />
          </div>
        </div>
        <DataTable
          caption="Danh sách report case tài khoản đang chờ"
          rows={visibleReportedAccounts}
          loading={reportsLoading}
          rowKey="caseId"
          columns={reportColumns}
          footer={!reportsLoading && (
            <Pagination
              page={currentReportedAccountPage}
              totalPages={totalReportedAccountPages}
              onChange={setReportedAccountPage}
              totalItems={reportedAccounts.length}
              pageSize={REPORTED_ACCOUNT_PAGE_SIZE}
              itemLabel="tài khoản bị báo cáo"
            />
          )}
          empty={{
            title: reportsLoading ? 'Đang tải báo cáo tài khoản...' : 'Không có tài khoản bị báo cáo',
            children: reportsLoading ? 'Đang lấy dữ liệu từ máy chủ.' : 'Không tìm thấy báo cáo tài khoản đang chờ.',
          }}
        />
      </Panel>
      <ConfirmDialog
        open={Boolean(caseDecision)}
        title={caseDecision?.action === 'accept' ? 'Chấp nhận báo cáo và khóa tài khoản?' : 'Từ chối báo cáo tài khoản?'}
        message={caseDecision
          ? `${caseDecision.reportCase.fullName} có ${caseDecision.reportCase.reportedCount} phiếu đang chờ trong case này.`
          : undefined}
        confirmLabel={caseDecision?.action === 'accept' ? 'Khóa tài khoản' : 'Từ chối báo cáo'}
        tone={caseDecision?.action === 'accept' ? 'alert' : 'primary'}
        loading={busyCaseId === caseDecision?.reportCase.caseId}
        onConfirm={confirmCaseDecision}
        onCancel={() => setCaseDecision(null)}
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
