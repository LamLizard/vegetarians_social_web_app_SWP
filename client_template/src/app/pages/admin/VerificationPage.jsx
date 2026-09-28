import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Avatar, Button, EmptyState, FormField, Modal, Photo, SearchInput, StatusBadge, Tabs, Tag, useToast,
} from '../../../components';
import cx from '../../../components/cx';
import { useApp } from '../../store/AppStore';
import { DIETS, POST_TYPES } from '../../store/mockData';
import { PostExtras } from '../../features/posts/PostCard';
import { postChecks, warningCount } from '../../features/posts/rules';
import { formatDate, formatMonthYear, timeAgo } from '../../utils/format';
import useMediaQuery from '../../utils/useMediaQuery';
import styles from './admin.module.css';

const REASONS = {
  post: ['Thiếu ghi chú trứng/sữa (BR-01)', 'Quảng cáo, spam', 'Có nguyên liệu không chay', 'Nội dung không liên quan', 'Ảnh không phù hợp'],
  place: ['Thiếu giấy phép kinh doanh', 'Thiếu ảnh mặt tiền quán', 'Không xác thực được địa chỉ', 'Thực đơn có món mặn'],
};

const fold = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

// Chuẩn hoá bài viết & quán về cùng 1 dạng để hiện chung 1 danh sách
const fromPost = (p, userById) => {
  const checks = postChecks(p);
  return {
    id: p.id, kind: 'post', data: p, who: userById(p.authorId), status: p.status,
    title: p.recipe?.title ?? p.restaurant?.name ?? (p.content.length > 70 ? `${p.content.slice(0, 70).trimEnd()}…` : p.content),
    label: POST_TYPES[p.type].label, at: p.createdAt, doneAt: p.moderatedAt,
    checks, warnings: warningCount(checks),
  };
};
const fromPlace = (r, userById) => {
  const checks = (r.documents ?? []).map((d) => ({ ok: d.ok, label: d.ok ? `Đã có: ${d.name}` : `Còn thiếu: ${d.name}` }));
  return {
    id: r.id, kind: 'place', data: r, who: userById(r.submittedBy), status: r.status,
    title: r.name, label: 'Quán ăn', at: r.submittedAt, doneAt: r.moderatedAt ?? r.verifiedAt,
    checks, warnings: warningCount(checks),
  };
};

/** ID05 – Duyệt bài viết & xác minh quán chay */
export default function VerificationPage() {
  const { state, actions, userById } = useApp();
  const toast = useToast();
  const isDesktop = useMediaQuery('(min-width: 992px)');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'posts';
  const selectedId = params.get('item');
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [rejecting, setRejecting] = useState(null);

  const lists = useMemo(() => ({
    posts: state.posts.filter((p) => p.status === 'pending').map((p) => fromPost(p, userById)).sort((a, b) => a.at.localeCompare(b.at)),
    places: state.restaurants.filter((r) => r.status === 'pending_verification').map((r) => fromPlace(r, userById)).sort((a, b) => a.at.localeCompare(b.at)),
    history: [
      ...state.posts.filter((p) => p.moderatedAt).map((p) => fromPost(p, userById)),
      ...state.restaurants.filter((r) => r.status !== 'pending_verification').map((r) => fromPlace(r, userById)),
    ].sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')),
  }), [state.posts, state.restaurants, userById]);

  const items = lists[tab].filter((it) => {
    if (tab === 'posts' && typeFilter !== 'all' && it.data.type !== typeFilter) return false;
    const term = fold(q.trim());
    return !term || fold(`${it.title} ${it.who?.fullName} ${it.data.content ?? ''}`).includes(term);
  });

  // Màn hình lớn: tự chọn mục đầu tiên. Điện thoại: hiện danh sách trước.
  const selected = items.find((it) => it.id === selectedId) ?? (isDesktop ? items[0] : null);

  const go = (next) => setParams(Object.fromEntries(Object.entries({ tab, ...next }).filter(([, v]) => v)), { replace: true });
  useEffect(() => { setTypeFilter('all'); }, [tab]);

  // Sau khi xử lý xong 1 mục → tự chuyển sang mục kế tiếp
  const selectNextAfter = (id) => {
    const i = items.findIndex((it) => it.id === id);
    const next = items[i + 1] ?? items[i - 1];
    go({ item: isDesktop ? next?.id : undefined });
  };

  const approve = (it) => {
    if (it.kind === 'post') {
      actions.moderatePost(it.id, true);
      toast(`Đã duyệt "${it.title}", bài đã hiển thị công khai`);
    } else {
      actions.moderateRestaurant(it.id, true);
      toast(`Đã xác minh quán ${it.title}`);
    }
    selectNextAfter(it.id);
  };

  const reject = (it, reason) => {
    if (it.kind === 'post') actions.moderatePost(it.id, false, reason);
    else actions.moderateRestaurant(it.id, false, reason);
    toast(`Đã từ chối "${it.title}" và gửi lý do cho người đăng`, { tone: 'info' });
    setRejecting(null);
    selectNextAfter(it.id);
  };

  // Phím tắt cho người duyệt: J/K chuyển mục · A duyệt · R từ chối (bỏ qua khi đang gõ chữ / mở hộp thoại)
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || document.querySelector('dialog[open]')) return;
      const key = e.key.toLowerCase();
      const i = items.findIndex((it) => it.id === selected?.id);
      const pending = selected && (selected.status === 'pending' || selected.status === 'pending_verification');
      if (key === 'j' && items[i + 1]) { e.preventDefault(); go({ item: items[i + 1].id }); }
      if (key === 'k' && i > 0) { e.preventDefault(); go({ item: items[i - 1].id }); }
      if (key === 'a' && pending) { e.preventDefault(); approve(selected); }
      if (key === 'r' && pending) { e.preventDefault(); setRejecting(selected); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const tabs = [
    { key: 'posts', label: 'Bài viết', icon: 'journal-text', count: lists.posts.length },
    { key: 'places', label: 'Quán ăn', icon: 'shop', count: lists.places.length },
    { key: 'history', label: 'Đã xử lý', icon: 'clock-history' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1>Duyệt nội dung</h1>
          <p>Bài viết mới và quán chay gửi lên đều cần quản trị viên kiểm tra trước khi hiển thị công khai.</p>
        </div>
      </div>

      <div className={styles.verifyBox}>
        <Tabs items={tabs} value={tab} onChange={(key) => setParams({ tab: key })} label="Loại nội dung" className={styles.verifyTabs} />

        <div className={cx(styles.verify, selected && styles.hasSelection)}>
          {/* ---- Danh sách ---- */}
          <div className={styles.listCol}>
            <div className={styles.listTools}>
              <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tiêu đề, người đăng…" />
              {tab === 'posts' && (
                <div className={styles.typeFilters}>
                  <Tag active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>Tất cả</Tag>
                  {Object.entries(POST_TYPES).map(([k, t]) => (
                    <Tag key={k} active={typeFilter === k} onClick={() => setTypeFilter(k)}>{t.label}</Tag>
                  ))}
                </div>
              )}
            </div>

            {items.length === 0 ? (
              <EmptyState icon={tab === 'history' ? 'clock-history' : 'check2-all'} title={tab === 'history' ? 'Chưa có lịch sử' : 'Đã xử lý hết!'}>
                {q ? 'Không có mục nào khớp từ khoá.' : tab === 'history' ? 'Các mục bạn duyệt / từ chối sẽ hiện ở đây.' : 'Không còn mục nào đang chờ. Nghỉ tay uống ly trà nhé 🍵'}
              </EmptyState>
            ) : (
              <ul className={styles.items}>
                {items.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      className={cx(styles.item, selected?.id === it.id && styles.itemOn)}
                      aria-current={selected?.id === it.id}
                      onClick={() => go({ item: it.id })}
                    >
                      {it.kind === 'place'
                        ? <Photo src={it.data.image} className={styles.itemThumb} />
                        : <Avatar name={it.who?.fullName} src={it.who?.avatar} size={40} />}
                      <span className={styles.itemText}>
                        <b>{it.title}</b>
                        <small>{it.who?.fullName} · {timeAgo(tab === 'history' ? it.doneAt : it.at)}</small>
                        <span className={styles.itemMeta}>
                          {tab === 'history' ? <StatusBadge status={it.status} /> : <Tag>{it.label}</Tag>}
                          {tab !== 'history' && it.warnings > 0 && (
                            <span className={styles.warnFlag}><i className="bi bi-exclamation-triangle-fill" aria-hidden="true" /> {it.warnings} cảnh báo</span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ---- Chi tiết ---- */}
          <div className={styles.detailCol}>
            {selected ? (
              <Detail
                item={selected}
                onBack={() => go({ item: undefined })}
                onApprove={() => approve(selected)}
                onReject={() => setRejecting(selected)}
                countByAuthor={(s) => state.posts.filter((p) => p.authorId === selected.who?.id && p.status === s).length}
              />
            ) : (
              <EmptyState icon="hand-index" title="Chọn một mục để xem chi tiết" className="d-none d-lg-block" />
            )}
          </div>
        </div>
      </div>

      <RejectModal item={rejecting} onClose={() => setRejecting(null)} onConfirm={reject} />
    </div>
  );
}

function Detail({ item, onBack, onApprove, onReject, countByAuthor }) {
  const { kind, data, who } = item;
  const pending = item.status === 'pending' || item.status === 'pending_verification';

  return (
    <article className={styles.detail}>
      <header className={styles.detailHead}>
        <button type="button" className={cx(styles.backBtn, 'd-lg-none')} onClick={onBack}>
          <i className="bi bi-arrow-left" aria-hidden="true" /> Danh sách
        </button>
        <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
          <StatusBadge status={item.status} />
          <Tag>{item.label}</Tag>
        </div>
        <h2 className={styles.detailTitle}>{item.title}</h2>
        <small className={styles.detailSub}>Gửi lúc {new Date(item.at).toLocaleString('vi-VN')} ({timeAgo(item.at)} trước)</small>
      </header>

      <div className={styles.detailBody}>
        {/* Người gửi */}
        <section className={styles.submitter}>
          <Avatar name={who?.fullName} src={who?.avatar} size={44} />
          <div className="flex-grow-1">
            <Link to={`/profile/${who?.id}`} className={styles.submitterName}>{who?.fullName}</Link>
            <small>
              {DIETS[who?.diet]?.label} · thành viên từ {formatMonthYear(who?.joinedAt)}
              {kind === 'post' && <> · {countByAuthor('public')} bài đã duyệt, {countByAuthor('rejected')} bị từ chối</>}
            </small>
          </div>
          <StatusBadge status={who?.status} />
        </section>

        {kind === 'post' ? (
          <section>
            <h3 className={styles.detailLabel}>Nội dung bài viết</h3>
            <div className={styles.previewCard}>
              <p className={styles.previewText}>{data.content}</p>
              <PostExtras post={data} />
              {data.image && <Photo src={data.image} alt="Ảnh trong bài" className={styles.previewImg} />}
            </div>
          </section>
        ) : (
          <section>
            <h3 className={styles.detailLabel}>Thông tin quán</h3>
            {data.image && <Photo src={data.image} alt={`Ảnh quán ${data.name}`} className={styles.placeImg} />}
            <dl className={styles.facts}>
              <div><dt><i className="bi bi-geo-alt" aria-hidden="true" /> Địa chỉ</dt><dd>{data.address}</dd></div>
              <div><dt><i className="bi bi-flower3" aria-hidden="true" /> Loại quán</dt><dd>{DIETS[data.kind]?.label ?? 'Chưa rõ'}</dd></div>
              {data.phone && <div><dt><i className="bi bi-telephone" aria-hidden="true" /> Điện thoại</dt><dd>{data.phone}</dd></div>}
              {data.openHours && <div><dt><i className="bi bi-clock" aria-hidden="true" /> Giờ mở cửa</dt><dd>{data.openHours}</dd></div>}
              {data.priceRange && <div><dt><i className="bi bi-cash-coin" aria-hidden="true" /> Giá</dt><dd>{data.priceRange}</dd></div>}
            </dl>
            {data.note && <p className={styles.placeNote}><b>Ghi chú của người gửi:</b> {data.note}</p>}
          </section>
        )}

        {item.checks.length > 0 && (
          <section>
            <h3 className={styles.detailLabel}>{kind === 'post' ? 'Kiểm tra tự động' : 'Hồ sơ đính kèm'}</h3>
            <ul className={styles.checks}>
              {item.checks.map((c) => (
                <li key={c.label} className={cx(c.ok ? styles.checkOk : c.soft ? styles.checkSoft : styles.checkBad)}>
                  <i className={`bi bi-${c.ok ? 'check-circle-fill' : c.soft ? 'dash-circle' : 'exclamation-triangle-fill'}`} aria-hidden="true" />
                  {c.label}
                </li>
              ))}
            </ul>
            {kind === 'post' && <small className={styles.checkHint}>Kết quả tự động chỉ để tham khảo, quyết định cuối cùng thuộc về bạn.</small>}
          </section>
        )}

        {!pending && (
          <section className={styles.result}>
            <h3 className={styles.detailLabel}>Kết quả xử lý</h3>
            <p className="mb-1">
              <StatusBadge status={item.status} /> lúc {item.doneAt ? formatDate(item.doneAt) : 'chưa rõ'}
            </p>
            {data.rejectReason && <p className="mb-0"><b>Lý do:</b> {data.rejectReason}</p>}
          </section>
        )}
      </div>

      {pending && (
        <footer className={styles.detailActions}>
          <span className={styles.keys} aria-hidden="true">
            <kbd>A</kbd> duyệt <kbd>R</kbd> từ chối <kbd>J</kbd><kbd>K</kbd> chuyển mục
          </span>
          <Button variant="alert" icon="x-lg" onClick={onReject}>Từ chối</Button>
          <Button icon={kind === 'post' ? 'check2' : 'patch-check'} onClick={onApprove}>
            {kind === 'post' ? 'Duyệt & đăng' : 'Xác minh quán'}
          </Button>
        </footer>
      )}
    </article>
  );
}

function RejectModal({ item, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (item) {
      // Gợi ý sẵn lý do từ cảnh báo tự động đầu tiên
      const firstWarning = item.checks.find((c) => !c.ok && !c.soft);
      setReason(firstWarning ? `${firstWarning.label}.` : '');
      setError('');
    }
  }, [item]);

  const submit = () => {
    if (reason.trim().length < 10) {
      setError('Ghi rõ lý do (ít nhất 10 ký tự) để người đăng biết cần sửa gì.');
      return;
    }
    onConfirm(item, reason.trim());
  };

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={item?.kind === 'place' ? 'Từ chối xác minh quán' : 'Từ chối bài viết'}
      footer={(
        <>
          <Button variant="subtle" onClick={onClose}>Hủy</Button>
          <Button variant="alert" icon="x-lg" onClick={submit}>Từ chối & gửi lý do</Button>
        </>
      )}
    >
      {item && (
        <>
          <p className="mb-3">
            <b>{item.title}</b> của {item.who?.fullName}. Người đăng sẽ nhận thông báo kèm lý do dưới đây.
          </p>
          <span className="form-label fw-semibold small mb-1 d-block">Lý do thường gặp</span>
          <div className="d-flex flex-wrap gap-2 mb-3">
            {REASONS[item.kind].map((r) => (
              <Tag key={r} active={reason === `${r}.`} onClick={() => { setReason(`${r}.`); setError(''); }}>{r}</Tag>
            ))}
          </div>
          <FormField
            label="Lý do từ chối"
            required
            multiline
            rows={3}
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(''); }}
            error={error}
            hint="Viết ngắn gọn, lịch sự và nói rõ cách sửa."
          />
        </>
      )}
    </Modal>
  );
}
