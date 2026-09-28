import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Avatar, Button, EmptyState, FormField, IconButton, Modal, Notice, Panel, SearchInput, StatusBadge, Tag, useToast,
} from '../../../components';
import cx from '../../../components/cx';
import { useApp, useCurrentUser } from '../../store/AppStore';
import { DIETS } from '../../store/mockData';
import { formatDate } from '../../utils/format';
import styles from './admin.module.css';

const PAGE_SIZE = 6;
const LOCK_REASONS = ['Spam, quảng cáo', 'Ngôn từ xúc phạm thành viên khác', 'Đăng nội dung không phải món chay nhiều lần', 'Tài khoản giả mạo'];
const SORTS = {
  newest: { label: 'Mới tham gia', fn: (a, b) => b.joinedAt.localeCompare(a.joinedAt) },
  name: { label: 'Tên A → Z', fn: (a, b) => a.fullName.split(' ').pop().localeCompare(b.fullName.split(' ').pop(), 'vi') },
  posts: { label: 'Nhiều bài nhất', fn: (a, b) => b.postCount - a.postCount },
};

const fold = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

/** ID06 – Quản lý thành viên: tìm, lọc, khoá / mở khoá tài khoản */
export default function MembersPage() {
  const { state, actions } = useApp();
  const me = useCurrentUser();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'all';
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null); // { user, action: 'lock' | 'unlock' }

  const rows = useMemo(() => state.users.map((u) => ({
    ...u,
    postCount: state.posts.filter((p) => p.authorId === u.id && p.status === 'public').length,
    rejectedCount: state.posts.filter((p) => p.authorId === u.id && p.status === 'rejected').length,
  })), [state.users, state.posts]);

  const counts = {
    all: rows.length,
    active: rows.filter((u) => u.status === 'active').length,
    locked: rows.filter((u) => u.status === 'locked').length,
  };

  const filtered = rows
    .filter((u) => status === 'all' || u.status === status)
    .filter((u) => role === 'all' || u.role === role)
    .filter((u) => !q.trim() || fold(`${u.fullName} ${u.email}`).includes(fold(q.trim())))
    .sort(SORTS[sort].fn);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  useEffect(() => setPage(1), [q, role, sort, status]);

  const setStatus = (s) => setParams(s === 'all' ? {} : { status: s });

  const confirm = (reason) => {
    const { user, action } = target;
    actions.setUserStatus(user.id, action === 'lock' ? 'locked' : 'active', reason);
    toast(action === 'lock' ? `Đã khoá tài khoản ${user.fullName}` : `Đã mở khoá tài khoản ${user.fullName}`, { tone: action === 'lock' ? 'info' : 'success' });
    setTarget(null);
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1>Quản lý thành viên</h1>
          <p>{counts.all} tài khoản · {counts.active} đang hoạt động · {counts.locked} bị khoá</p>
        </div>
      </div>

      <Panel flush>
        <div className={styles.toolbar}>
          <SearchInput className={styles.toolSearch} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên hoặc email…" />
          <div className={styles.toolFilters} role="group" aria-label="Lọc theo trạng thái">
            {[['all', 'Tất cả'], ['active', 'Hoạt động'], ['locked', 'Bị khoá']].map(([k, label]) => (
              <Tag key={k} active={status === k} onClick={() => setStatus(k)}>{label} ({counts[k]})</Tag>
            ))}
          </div>
          <div className={styles.toolSelects}>
            <select className="form-select form-select-sm" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Lọc theo vai trò">
              <option value="all">Mọi vai trò</option>
              <option value="member">Thành viên</option>
              <option value="admin">Quản trị viên</option>
            </select>
            <select className="form-select form-select-sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sắp xếp">
              {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {shown.length === 0 ? (
          <EmptyState icon="person-x" title="Không tìm thấy thành viên">Thử đổi từ khoá hoặc bộ lọc.</EmptyState>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Thành viên</th>
                <th scope="col">Chế độ ăn</th>
                <th scope="col" className={styles.num}>Bài viết</th>
                <th scope="col">Tham gia</th>
                <th scope="col">Trạng thái</th>
                <th scope="col" className={styles.actionsCol}><span className="visually-hidden">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => {
                const isAdmin = u.role === 'admin';
                return (
                  <tr key={u.id} className={cx(u.status === 'locked' && styles.rowLocked)}>
                    <td data-label="Thành viên">
                      <div className={styles.memberCell}>
                        <Avatar name={u.fullName} src={u.avatar} size={40} />
                        <span>
                          <Link to={`/profile/${u.id}`} className={styles.memberName}>{u.fullName}</Link>
                          {isAdmin && <span className={styles.roleTag}>Quản trị</span>}
                          <small>{u.email}</small>
                        </span>
                      </div>
                    </td>
                    <td data-label="Chế độ ăn">{DIETS[u.diet]?.label ?? 'Chưa rõ'}</td>
                    <td data-label="Bài viết" className={styles.num}>
                      {u.postCount}
                      {u.rejectedCount > 0 && <small className={styles.rejectedNote} title="Số bài bị từ chối">{u.rejectedCount} bị từ chối</small>}
                    </td>
                    <td data-label="Tham gia">{formatDate(u.joinedAt)}</td>
                    <td data-label="Trạng thái">
                      <StatusBadge status={u.status} />
                      {u.status === 'locked' && u.lockReason && <small className={styles.lockReason}>{u.lockReason}</small>}
                    </td>
                    <td className={styles.actionsCol}>
                      <div className={styles.rowActions}>
                        <Link to={`/profile/${u.id}`} className={styles.iconLink} aria-label={`Xem trang của ${u.fullName}`} title="Xem trang cá nhân">
                          <i className="bi bi-eye" aria-hidden="true" />
                        </Link>
                        {isAdmin || u.id === me.id ? (
                          <IconButton variant="ghost" size="sm" icon="shield-lock" label="Không thể khoá tài khoản quản trị" disabled />
                        ) : u.status === 'locked' ? (
                          <Button size="sm" variant="outline" icon="unlock" onClick={() => setTarget({ user: u, action: 'unlock' })}>Mở khoá</Button>
                        ) : (
                          <Button size="sm" variant="subtle" icon="lock" onClick={() => setTarget({ user: u, action: 'lock' })}>Khoá</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className={styles.pager}>
          <small>
            Hiển thị {filtered.length ? (current - 1) * PAGE_SIZE + 1 : 0}-{Math.min(current * PAGE_SIZE, filtered.length)} / {filtered.length}
          </small>
          <nav aria-label="Phân trang" className={styles.pagerBtns}>
            <IconButton variant="ghost" size="sm" icon="chevron-left" label="Trang trước" disabled={current === 1} onClick={() => setPage(current - 1)} />
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={cx(styles.pageNum, n === current && styles.pageOn)} aria-current={n === current ? 'page' : undefined} onClick={() => setPage(n)}>
                {n}
              </button>
            ))}
            <IconButton variant="ghost" size="sm" icon="chevron-right" label="Trang sau" disabled={current === pages} onClick={() => setPage(current + 1)} />
          </nav>
        </div>
      </Panel>

      <LockModal target={target} onClose={() => setTarget(null)} onConfirm={confirm} />
    </div>
  );
}

function LockModal({ target, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const locking = target?.action === 'lock';

  useEffect(() => {
    setReason('');
    setError('');
  }, [target]);

  const submit = () => {
    if (locking && reason.trim().length < 10) {
      setError('Ghi rõ lý do khoá (ít nhất 10 ký tự). Thành viên sẽ thấy lý do này khi đăng nhập.');
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      size="sm"
      title={locking ? 'Khoá tài khoản?' : 'Mở khoá tài khoản?'}
      footer={(
        <>
          <Button variant="subtle" onClick={onClose}>Hủy</Button>
          {locking
            ? <Button variant="alert" icon="lock" onClick={submit}>Khoá tài khoản</Button>
            : <Button icon="unlock" onClick={submit}>Mở khoá</Button>}
        </>
      )}
    >
      {target && (
        <>
          <div className={styles.modalUser}>
            <Avatar name={target.user.fullName} src={target.user.avatar} size={44} />
            <span>
              <b>{target.user.fullName}</b>
              <small>{target.user.email}</small>
            </span>
          </div>

          {locking ? (
            <>
              <Notice tone="alert" title="Thành viên sẽ không thể đăng nhập" className="mb-3">
                Bài viết của họ tạm thời bị ẩn khỏi trang cá nhân. Bạn có thể mở khoá lại bất cứ lúc nào.
              </Notice>
              <div className="d-flex flex-wrap gap-2 mb-3">
                {LOCK_REASONS.map((r) => (
                  <Tag key={r} active={reason === r} onClick={() => { setReason(r); setError(''); }}>{r}</Tag>
                ))}
              </div>
              <FormField label="Lý do khoá" required multiline value={reason} onChange={(e) => { setReason(e.target.value); setError(''); }} error={error} />
            </>
          ) : (
            <p className="mb-0">
              Tài khoản đã bị khoá vì: <i>"{target.user.lockReason ?? 'không rõ lý do'}"</i>. Sau khi mở khoá, thành viên có thể đăng nhập và đăng bài lại bình thường.
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
