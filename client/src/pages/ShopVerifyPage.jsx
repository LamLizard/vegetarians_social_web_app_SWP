// Tùng — Sprint 2: queue cả ba loại hồ sơ; snapshot identity tách bản Shop hiện tại.
import { useCallback, useEffect, useRef, useState } from 'react';
import useAuth from '../hooks/useAuth';
import useShopResource from '../hooks/useShopResource';
import shopVerificationService from '../services/shopVerification.service';
import AdminLayout from '../components/AdminLayout/AdminLayout';
import Button from '../components/Button/Button';
import ConfirmDialog from '../components/ConfirmDialog/ConfirmDialog';
import DataTable from '../components/DataTable/DataTable';
import Modal from '../components/Modal/Modal';
import Notice from '../components/Notice/Notice';
import PageHeader from '../components/PageHeader/PageHeader';
import Pagination from '../components/Pagination/Pagination';
import Spinner from '../components/Spinner/Spinner';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import { ShopSnapshot, ShopSubmissionStatus, SUBMISSION_LABELS, shopDate } from './ShopFormFields';
import styles from './ShopVerifyPage.module.css';

export default function ShopVerifyPage() {
  const { user, logout, isCheckingSession } = useAuth();
  const admin = !isCheckingSession && user?.role === 'admin';
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState(null);
  const [message, setMessage] = useState(null);
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const loadQueue = useCallback(signal => shopVerificationService.list(page, signal), [page]);
  const loadDetail = useCallback(signal => shopVerificationService.detail(selected, signal), [selected]);
  const queue = useShopResource(loadQueue, admin);
  const detail = useShopResource(loadDetail, admin && Boolean(selected));
  const submission = detail.data?.submission;
  const canDecide = !detail.loading && !detail.error && submission?.submissionId === selected && submission?.status === 'pending';

  const confirm = async reason => {
    if (!decision || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setFailure(null);
    try {
      await shopVerificationService.decide(decision.id, decision.action, reason);
      if (alive.current) {
        setMessage('Đã lưu quyết định và gửi thông báo cho chủ quán.');
        setDecision(null); setSelected(null); queue.reload();
      }
    } catch (error) {
      if (alive.current) {
        setFailure(error);
        if (error.status === 409) { setDecision(null); detail.reload(); queue.reload(); }
      }
    } finally { inFlight.current = false; if (alive.current) setSaving(false); }
  };

  const columns = [
    { key: 'shopName', header: 'Quán', primary: true },
    { key: 'submissionType', header: 'Loại hồ sơ', render: row => SUBMISSION_LABELS[row.submissionType] },
    { key: 'ownerName', header: 'Chủ quán', render: row => row.ownerName || row.ownerEmail },
    { key: 'submittedAt', header: 'Ngày gửi', render: row => shopDate(row.submittedAt) },
    { key: 'actions', header: 'Chi tiết', align: 'right', render: row => <Button size="sm" variant="outline" onClick={() => { setFailure(null); setSelected(row.submissionId); }}>Xem hồ sơ</Button> },
  ];
  const identity = decision?.type === 'identity_edit';
  return <AdminLayout activeKey="shops" title="Xác minh quán" user={user} onLogout={() => { logout(); window.location.assign('/'); }}>
    <div className={styles.page}>
      <PageHeader title="Xác minh quán" description="Xét đăng ký, đăng ký lại và yêu cầu sửa thông tin quán."
        actions={<Button variant="outline" icon="arrow-clockwise" disabled={saving || queue.loading} onClick={queue.reload}>Tải lại</Button>} />
      {isCheckingSession ? <Spinner showLabel /> : !admin ? <Notice tone="alert">Chỉ Admin được truy cập trang xác minh quán.</Notice> : <>
        {message && <Notice tone="success" onDismiss={() => setMessage(null)}>{message}</Notice>}
        {failure && !decision && <Notice tone="alert" onDismiss={() => setFailure(null)}>{failure.message}</Notice>}
        {queue.error ? <Notice tone="alert" action={{ label: 'Thử lại', onClick: queue.reload }}>{queue.error.message}</Notice> : <DataTable
          columns={columns} rows={queue.data?.items || []} rowKey="submissionId" loading={queue.loading || !queue.data}
          caption="Hồ sơ quán đang chờ xác minh" empty={{ title: 'Không có hồ sơ chờ duyệt' }}
          footer={queue.data && <Pagination page={queue.data.page} pageSize={queue.data.pageSize} totalPages={queue.data.totalPages} totalItems={queue.data.total} itemLabel="hồ sơ" onChange={setPage} />} />}
      </>}
    </div>
    <Modal open={Boolean(selected) && admin} onClose={() => { if (!saving) { setSelected(null); setDecision(null); } }}
      title="Chi tiết hồ sơ quán" size="lg" dismissible={!saving}
      footer={canDecide && <><Button variant="alert" disabled={saving} onClick={() => { setFailure(null); setDecision({ id: submission.submissionId, type: submission.submissionType, action: 'reject' }); }}>Từ chối</Button>
        <Button disabled={saving} onClick={() => { setFailure(null); setDecision({ id: submission.submissionId, type: submission.submissionType, action: 'accept' }); }}>Duyệt hồ sơ</Button></>}>
      {detail.loading || (!detail.data && !detail.error) ? <Spinner showLabel /> : detail.error ? <Notice tone="alert" action={{ label: 'Thử lại', onClick: detail.reload }}>{detail.error.message}</Notice>
        : submission?.submissionId === selected && <div className={styles.detail}>
          <div className={styles.metadata}><b>{SUBMISSION_LABELS[submission.submissionType]}</b><ShopSubmissionStatus status={submission.status} />
            <span>Hồ sơ #{submission.submissionId} · {shopDate(submission.submittedAt)}</span>
            <span>{submission.ownerName || submission.ownerEmail}</span></div>
          <div><h3 className={styles.title}>Quán hiện tại</h3><StatusBadge entity="shop" status={detail.data.shop.verificationStatus} />
            <p className={styles.operating}>Hoạt động: {({ active: 'Đang hoạt động', inactive: 'Tạm ngưng', renovating: 'Đang sửa chữa' })[detail.data.shop.status]}</p>
            <ShopSnapshot value={detail.data.shop} /></div>
          <div className={styles.comparison}><section><h3 className={styles.title}>Trước khi gửi</h3><ShopSnapshot value={submission.beforeValue} /></section>
            <section><h3 className={styles.title}>Thông tin đề xuất</h3><ShopSnapshot value={submission.afterValue} /></section></div>
          {submission.submissionType === 'identity_edit' && <Notice>Chỉ các thông tin đề xuất được áp dụng khi duyệt. Lịch và menu hiện tại được giữ nguyên.</Notice>}
          {submission.reviewNote && <Notice tone="alert" title="Lý do từ chối">{submission.reviewNote}</Notice>}
        </div>}
    </Modal>
    <ConfirmDialog open={Boolean(decision) && admin} loading={saving} tone={decision?.action === 'accept' ? 'primary' : 'alert'}
      title={`${decision?.action === 'accept' ? 'Duyệt' : 'Từ chối'} ${identity ? 'yêu cầu sửa thông tin' : 'đăng ký quán'}?`}
      confirmLabel={decision?.action === 'accept' ? 'Duyệt hồ sơ' : 'Từ chối hồ sơ'}
      reason={decision?.action === 'reject' ? { label: 'Lý do từ chối', required: true } : undefined}
      message={<>{identity ? 'Quyết định này xử lý yêu cầu sửa; quán vẫn được xác minh.' : 'Kết quả sẽ được gửi cho chủ quán.'}
        {failure && <span role="alert" className="d-block mt-3">{failure.message}</span>}</>}
      onConfirm={confirm} onCancel={() => { if (!saving) { setDecision(null); setFailure(null); } }} />
  </AdminLayout>;
}
