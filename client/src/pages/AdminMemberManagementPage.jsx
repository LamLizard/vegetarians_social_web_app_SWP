import { useEffect, useState } from 'react';
import { DataTable } from '../components';
import { getMembers, setMemberStatus } from '../services/admin-member.service';

export default function AdminMemberManagementPage() {
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
      render: (row) => (
        <span className={`badge ${row.status === 'locked' ? 'bg-danger' : row.status === 'reported' ? 'bg-warning text-dark' : 'bg-success'}`}>
          {row.status === 'locked' ? 'Đã khóa' : row.status === 'reported' ? 'Bị báo cáo' : 'Hoạt động'}
        </span>
      ),
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
          <button
            type="button"
            className={`btn btn-sm ${row.status === 'locked' ? 'btn-outline-success' : 'btn-outline-danger'}`}
            onClick={() => handleStatusChange(row)}
            disabled={busyMemberId === row.id}
          >
            {busyMemberId === row.id ? 'Đang lưu...' : row.status === 'locked' ? 'Mở khóa' : 'Khóa'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="container py-4">
      <div className="card shadow-sm border-0">
        <div className="card-body p-4">
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
            <div>
              <p className="text-uppercase text-muted small mb-1">Admin</p>
              <h2 className="mb-0">Member Management</h2>
            </div>

            <div className="d-flex flex-column flex-sm-row gap-2 align-items-sm-center">
              <label className="form-check form-switch mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={showOnlyReported}
                  onChange={(event) => setShowOnlyReported(event.target.checked)}
                />
                <span className="form-check-label">Chỉ hiện reported</span>
              </label>

              <div className="input-group" style={{ minWidth: 220 }}>
                <span className="input-group-text"><i className="bi bi-search" /></span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Tìm thành viên"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          </div>

          {requestError && <div className="alert alert-danger" role="alert">{requestError}</div>}

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
        </div>
      </div>
    </div>
  );
}
