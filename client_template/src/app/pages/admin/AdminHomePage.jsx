import { Link, useNavigate } from 'react-router-dom';
import {
  Avatar, Button, Panel, StatusBadge, Tag,
} from '../../../components';
import cx from '../../../components/cx';
import { useApp, useCurrentUser } from '../../store/AppStore';
import { DIETS, POST_TYPES, WEEKLY_POSTS } from '../../store/mockData';
import { firstName, formatDate, timeAgo } from '../../utils/format';
import PostsChart from './PostsChart';
import styles from './admin.module.css';

const greeting = () => {
  const h = new Date().getHours();
  return h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
};

const DAY_MS = 86_400_000;

/** ID04 – Trang chủ quản trị */
export default function AdminHomePage() {
  const { state, userById } = useApp();
  const me = useCurrentUser();
  const navigate = useNavigate();

  const members = state.users.filter((u) => u.role === 'member');
  const newThisWeek = members.filter((u) => Date.now() - new Date(u.joinedAt) < 7 * DAY_MS).length;
  const pendingPosts = state.posts.filter((p) => p.status === 'pending');
  const pendingPlaces = state.restaurants.filter((r) => r.status === 'pending_verification');
  const locked = members.filter((u) => u.status === 'locked');
  const totalPending = pendingPosts.length + pendingPlaces.length;
  const weekTotal = WEEKLY_POSTS.reduce((s, d) => s + d.posts, 0);
  const weekApproved = WEEKLY_POSTS.reduce((s, d) => s + d.approved, 0);

  // Hàng chờ gộp bài + quán, mục gửi lâu nhất lên trước
  const queue = [
    ...pendingPosts.map((p) => ({
      id: p.id, kind: 'post', at: p.createdAt, who: userById(p.authorId),
      title: p.recipe?.title ?? p.restaurant?.name ?? `${p.content.slice(0, 60)}…`,
      label: POST_TYPES[p.type].label, status: 'pending',
    })),
    ...pendingPlaces.map((r) => ({
      id: r.id, kind: 'place', at: r.submittedAt, who: userById(r.submittedBy),
      title: r.name, label: 'Quán ăn', status: 'pending_verification',
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const newest = [...members].sort((a, b) => b.joinedAt.localeCompare(a.joinedAt)).slice(0, 4);

  const tiles = [
    { icon: 'people', label: 'Thành viên', value: members.length, note: `+${newThisWeek} trong 7 ngày qua`, to: '/admin/members' },
    { icon: 'journal-text', label: 'Bài chờ duyệt', value: pendingPosts.length, note: 'Bài viết, công thức, review', to: '/admin/verification?tab=posts', warn: pendingPosts.length > 0 },
    { icon: 'shop', label: 'Quán chờ xác minh', value: pendingPlaces.length, note: 'Hồ sơ quán chay gửi lên', to: '/admin/verification?tab=places', warn: pendingPlaces.length > 0 },
    { icon: 'lock', label: 'Tài khoản bị khoá', value: locked.length, note: 'Không thể đăng nhập', to: '/admin/members?status=locked' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1>{greeting()}, {firstName(me.fullName)} 👋</h1>
          <p>
            {totalPending > 0
              ? <>Có <b>{totalPending} mục</b> đang chờ bạn xử lý. Mục gửi lâu nhất: {timeAgo(queue[0].at)} trước.</>
              : 'Hàng chờ đã trống. Cộng đồng đang rất ổn!'}
          </p>
        </div>
        {totalPending > 0 && (
          <Button icon="clipboard2-check" onClick={() => navigate('/admin/verification')}>Bắt đầu duyệt</Button>
        )}
      </div>

      <div className={styles.tiles}>
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className={styles.tile}>
            <span className={cx(styles.tileIcon, t.warn && styles.tileIconWarn)} aria-hidden="true"><i className={`bi bi-${t.icon}`} /></span>
            <span className={styles.tileLabel}>{t.label}</span>
            <span className={styles.tileValue}>{t.value}</span>
            <span className={styles.tileNote}>{t.note}</span>
          </Link>
        ))}
      </div>

      <div className={styles.gridA}>
        <Panel
          title="Bài đăng mới 7 ngày qua"
          action={<span className={styles.panelMeta}>{weekTotal} bài · {Math.round((weekApproved / weekTotal) * 100)}% được duyệt</span>}
        >
          <PostsChart data={WEEKLY_POSTS} />
        </Panel>

        <Panel title="Trợ lý AI hôm nay" icon="flower1">
          <ul className={styles.aiStats}>
            <li><span>Câu hỏi đã trả lời</span><b>342</b></li>
            <li><span>Bị bộ lọc từ khoá chặn</span><b>7 <small className="text-body-secondary fw-normal">(2%)</small></b></li>
            <li><span>Lỗi khi gọi AI (không trừ lượt)</span><b>3</b></li>
            <li><span>Thành viên đã dùng hết lượt</span><b>11</b></li>
          </ul>
          <div className={styles.topicLabel}>Chủ đề được hỏi nhiều</div>
          <div className="d-flex flex-wrap gap-1">
            {['Vitamin B12', 'Đạm thực vật', 'Thực đơn tuần', 'Sắt', 'Bữa sáng nhanh'].map((t) => <Tag key={t}>{t}</Tag>)}
          </div>
        </Panel>
      </div>

      <div className={styles.gridB}>
        <Panel
          title="Hàng chờ duyệt"
          action={<Link to="/admin/verification">Xem tất cả</Link>}
          flush
        >
          {queue.length === 0 && <p className={styles.emptyLine}>Không còn mục nào chờ duyệt 🎉</p>}
          <ul className={styles.queue}>
            {queue.slice(0, 5).map((q) => (
              <li key={q.id}>
                <Link to={`/admin/verification?tab=${q.kind === 'post' ? 'posts' : 'places'}&item=${q.id}`} className={styles.queueItem}>
                  <Avatar name={q.who?.fullName} src={q.who?.avatar} size={38} />
                  <span className={styles.queueText}>
                    <b>{q.title}</b>
                    <small>{q.label} · {q.who?.fullName} · {timeAgo(q.at)}</small>
                  </span>
                  <StatusBadge status={q.status} />
                  <i className="bi bi-chevron-right" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Hoạt động gần đây" flush>
          <ol className={styles.activity}>
            {[...state.activity].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6).map((a) => (
              <li key={a.id}>
                <span className={cx(styles.actIcon, styles[`act_${a.tone}`])} aria-hidden="true"><i className={`bi bi-${a.icon}`} /></span>
                <span className={styles.actText}>
                  {a.text}
                  <small>{timeAgo(a.createdAt)}</small>
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel title="Thành viên mới" action={<Link to="/admin/members">Quản lý thành viên</Link>} flush>
        <ul className={styles.newMembers}>
          {newest.map((u) => (
            <li key={u.id}>
              <Avatar name={u.fullName} src={u.avatar} size={40} />
              <span className={styles.queueText}>
                <b>{u.fullName}</b>
                <small>{DIETS[u.diet]?.label} · tham gia {formatDate(u.joinedAt)}</small>
              </span>
              <StatusBadge status={u.status} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
