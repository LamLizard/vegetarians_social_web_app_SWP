import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Avatar, Button, EmptyState, IconButton, Notice, Photo, StatusBadge, Tag, useToast,
} from '../../../components';
import cx from '../../../components/cx';
import { useApp, useCurrentUser } from '../../store/AppStore';
import { DIETS, DISCOVER_DISHES } from '../../store/mockData';
import { formatMonthYear, formatNumber } from '../../utils/format';
import { useShell } from '../../layouts/ShellContext';
import PostCard from '../../features/posts/PostCard';
import GardenHeatmap from '../../features/today/GardenHeatmap';
import DishMini from '../../features/discover/DishMini';
import EditProfileModal from './EditProfileModal';
import NotFoundPage from '../NotFoundPage';
import styles from './profile.module.css';

const STATUS_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'public', label: 'Công khai' },
  { key: 'pending', label: 'Chờ duyệt' },
  { key: 'rejected', label: 'Bị từ chối' },
];

// Huy hiệu tính từ dữ liệu thật của người dùng
function badgesOf(user, posts) {
  const pub = posts.filter((p) => p.status === 'public');
  const cooked = pub.reduce((s, p) => s + (p.cookedBy?.length ?? 0), 0);
  const days = (Date.now() - new Date(user.joinedAt)) / 86_400_000;
  return [
    user.streak >= 30 && { icon: 'fire', label: 'Giữ lửa 30 ngày' },
    pub.filter((p) => p.type === 'recipe').length >= 2 && { icon: 'journal-richtext', label: 'Bếp trưởng' },
    pub.some((p) => p.type === 'review') && { icon: 'geo-alt', label: 'Reviewer quán chay' },
    cooked >= 3 && { icon: 'stars', label: 'Truyền cảm hứng' },
    user.diet === 'periodic' && { icon: 'moon-stars', label: 'Chay kỳ đều đặn' },
    days < 30 && { icon: 'tree', label: 'Thành viên mới' },
  ].filter(Boolean);
}

/** ID03 – Trang cá nhân "Hộ chiếu chay". */
export default function ProfilePage() {
  const { userId } = useParams();
  // key → sang trang người khác thì tab, bộ lọc tự về mặc định
  return <ProfileView key={userId} userId={userId} />;
}

function ProfileView({ userId }) {
  const { state, actions, userById } = useApp();
  const me = useCurrentUser();
  const toast = useToast();
  const { openCompose } = useShell();
  const { hash } = useLocation();
  const [tab, setTab] = useState('posts');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState(false);

  // Mở từ bảng lệnh / thông báo với #mã-bài → cuộn tới bài đó
  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    return () => clearTimeout(t);
  }, [hash]);

  const user = userById(userId);
  if (!user) return <NotFoundPage embedded />;

  const isMe = user.id === me.id;
  const hiddenByLock = user.status === 'locked' && !isMe && me.role !== 'admin';
  const isFollowing = me.following.includes(user.id);
  const diet = DIETS[user.diet];

  const posts = state.posts
    .filter((p) => p.authorId === user.id && (isMe || p.status === 'public'))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const publicPosts = posts.filter((p) => p.status === 'public');
  const countBy = (s) => posts.filter((p) => p.status === s).length;
  const shown = statusFilter === 'all' ? posts : posts.filter((p) => p.status === statusFilter);
  const savedPosts = state.posts.filter((p) => p.savedBy.includes(user.id) && p.status === 'public');
  const wantDishes = DISCOVER_DISHES.filter((d) => user.savedDishes?.includes(d.id));
  const cookedTotal = publicPosts.reduce((s, p) => s + (p.cookedBy?.length ?? 0), 0);
  const topRecipe = publicPosts
    .filter((p) => p.type === 'recipe')
    .sort((a, b) => (b.cookedBy?.length ?? 0) - (a.cookedBy?.length ?? 0) || b.likes.length - a.likes.length)[0];
  const badges = badgesOf(user, posts);

  const tabs = [
    { key: 'posts', label: 'Bài viết', count: posts.length },
    ...(isMe ? [{ key: 'cook', label: 'Muốn nấu', count: wantDishes.length }, { key: 'saved', label: 'Đã lưu', count: savedPosts.length }] : []),
    { key: 'about', label: 'Giới thiệu' },
  ];

  const toggleFollow = () => {
    actions.toggleFollow(user.id);
    toast(isFollowing ? `Đã bỏ theo dõi ${user.fullName}` : `Đã theo dõi ${user.fullName}`);
  };

  const tileIn = (i) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] },
  });

  return (
    <div className={styles.page}>
      {/* ---------- Đầu trang ---------- */}
      <section className={styles.hero}>
        <div className={styles.coverWrap}>
          <Photo src={user.cover} alt="" className={styles.cover} />
          {isMe && <Button variant="subtle" size="sm" icon="camera" className={styles.coverBtn} onClick={() => setEditing(true)}>Đổi ảnh bìa</Button>}
        </div>
        <div className={styles.idRow}>
          <Avatar name={user.fullName} src={user.avatar} size={112} className={styles.avatar} />
          <div className={styles.idText}>
            <h1 className={`display ${styles.name}`}>{user.fullName}</h1>
            <p className={styles.handle}>
              {diet && <><i className={`bi bi-${diet.icon}`} aria-hidden="true" /> {diet.label}</>}
              {user.city && <span>{user.city}</span>}
              <span>Tham gia {formatMonthYear(user.joinedAt)}</span>
            </p>
            <div className={styles.badgeRow}>
              {user.role === 'admin' && <StatusBadge status="verified" label="Quản trị viên" />}
              {user.status === 'locked' && <StatusBadge status="locked" />}
            </div>
          </div>
          <div className={styles.idActions}>
            {isMe ? (
              <>
                <Button icon="plus-lg" onClick={() => openCompose('recipe')}>Đăng công thức</Button>
                <Button variant="subtle" icon="pencil" onClick={() => setEditing(true)}>Chỉnh sửa</Button>
              </>
            ) : (
              <>
                <Button variant={isFollowing ? 'subtle' : 'primary'} icon={isFollowing ? 'person-check' : 'person-plus'} onClick={toggleFollow} disabled={user.status === 'locked'}>
                  {isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
                </Button>
                <IconButton icon="link-45deg" label="Sao chép liên kết trang" onClick={async () => {
                  try { await navigator.clipboard.writeText(`${window.location.origin}/profile/${user.id}`); } catch { /* bỏ qua */ }
                  toast('Đã sao chép liên kết');
                }} />
              </>
            )}
          </div>
        </div>
        {user.bio && <p className={styles.bio}>{user.bio}</p>}
      </section>

      {hiddenByLock ? (
        <Notice tone="info" title="Tài khoản này đang tạm khoá">Nội dung của thành viên này tạm thời không hiển thị.</Notice>
      ) : (
        <>
          {/* ---------- Hộ chiếu chay: 5 ô bento ---------- */}
          <section className={styles.bento} aria-label="Hộ chiếu chay">
            <motion.div className={cx(styles.tile, styles.tStreak)} {...tileIn(0)}>
              <span className={styles.tLabel}><i className="bi bi-fire" aria-hidden="true" /> Chuỗi ngày ăn chay</span>
              <div className={styles.streak}>
                <b>{user.streak ?? 0}</b>
                <span>ngày<br />liên tục</span>
              </div>
              <small>{user.streak >= 30 ? 'Giữ nhịp rất đều, tiếp tục nhé!' : 'Mỗi bữa chay đều được tính vào khu vườn.'}</small>
            </motion.div>

            <motion.div className={cx(styles.tile, styles.tGarden)} {...tileIn(1)}>
              <span className={styles.tLabel}><i className="bi bi-flower2" aria-hidden="true" /> Khu vườn 6 tháng qua</span>
              <GardenHeatmap user={user} weeks={26} />
            </motion.div>

            <motion.div className={cx(styles.tile, styles.tStats)} {...tileIn(2)}>
              <dl className={styles.stats}>
                <div><dt>Bài viết</dt><dd>{publicPosts.length}</dd></div>
                <div><dt>Người theo dõi</dt><dd>{formatNumber(user.followers.length)}</dd></div>
                <div><dt>Đang theo dõi</dt><dd>{formatNumber(user.following.length)}</dd></div>
                <div><dt>Được nấu theo</dt><dd>{cookedTotal}</dd></div>
              </dl>
            </motion.div>

            <motion.div className={cx(styles.tile, styles.tTop)} {...tileIn(3)}>
              {topRecipe ? (
                <a href={`#${topRecipe.id}`} className={styles.topLink} onClick={() => setTab('posts')}>
                  <Photo src={topRecipe.image?.replace('w=900', 'w=500')} alt="" className={styles.topImg} />
                  <span className={styles.topText}>
                    <small>Món được nấu theo nhiều nhất</small>
                    <b>{topRecipe.recipe.title}</b>
                    <span>{topRecipe.cookedBy?.length ?? 0} người đã nấu theo</span>
                  </span>
                </a>
              ) : (
                <div className={styles.topEmpty}>
                  <i className="bi bi-journal-richtext" aria-hidden="true" />
                  <b>Chưa có công thức</b>
                  {isMe && <button type="button" className={styles.linkBtn} onClick={() => openCompose('recipe')}>Đăng công thức đầu tiên</button>}
                </div>
              )}
            </motion.div>

            <motion.div className={cx(styles.tile, styles.tBadges)} {...tileIn(4)}>
              <span className={styles.tLabel}><i className="bi bi-award" aria-hidden="true" /> Huy hiệu</span>
              {badges.length ? (
                <ul className={styles.badges}>
                  {badges.map((b) => <li key={b.label}><i className={`bi bi-${b.icon}`} aria-hidden="true" />{b.label}</li>)}
                </ul>
              ) : <p className={styles.muted}>Chưa có huy hiệu nào. Đăng công thức hoặc giữ chuỗi ngày chay để nhận nhé.</p>}
            </motion.div>
          </section>

          {/* ---------- Tab nội dung ---------- */}
          <div className={styles.tabs} role="tablist" aria-label="Mục trang cá nhân">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={cx(styles.tab, tab === t.key && styles.tabOn)} onClick={() => setTab(t.key)}>
                {t.label}
                {t.count != null && <span className={styles.count}>{t.count}</span>}
                {tab === t.key && <motion.span layoutId="profile-tab" className={styles.tabLine} transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
              </button>
            ))}
          </div>

          <div className={styles.body}>
            {tab === 'posts' && (
              <>
                {isMe && (
                  <div className={styles.filters} role="group" aria-label="Lọc theo trạng thái">
                    {STATUS_FILTERS.map((f) => (
                      <Tag key={f.key} active={statusFilter === f.key} onClick={() => setStatusFilter(f.key)}>
                        {f.label} ({f.key === 'all' ? posts.length : countBy(f.key)})
                      </Tag>
                    ))}
                  </div>
                )}
                {shown.map((p) => <PostCard key={p.id} post={p} />)}
                {shown.length === 0 && (
                  <div className={styles.emptyBox}>
                    <EmptyState icon="journal" title="Chưa có bài viết">
                      {isMe ? 'Chia sẻ món chay đầu tiên của bạn với cộng đồng nhé!' : `${user.fullName} chưa đăng bài nào.`}
                    </EmptyState>
                  </div>
                )}
              </>
            )}

            {tab === 'cook' && (
              wantDishes.length ? (
                <div className={styles.dishGrid}>{wantDishes.map((d) => <DishMini key={d.id} dish={d} />)}</div>
              ) : (
                <div className={styles.emptyBox}>
                  <EmptyState icon="bookmark-heart" title="Danh sách Muốn nấu đang trống" action={<Link to="/discover" className="btn btn-primary">Mở Khám phá</Link>}>
                    Quẹt phải một món ở mục Khám phá để lưu vào đây.
                  </EmptyState>
                </div>
              )
            )}

            {tab === 'saved' && (
              savedPosts.length ? savedPosts.map((p) => <PostCard key={p.id} post={p} />) : (
                <div className={styles.emptyBox}>
                  <EmptyState icon="bookmark" title="Chưa lưu bài nào">Bấm "Lưu" trong menu của bài viết để xem lại sau.</EmptyState>
                </div>
              )
            )}

            {tab === 'about' && (
              <div className={styles.about}>
                <p>{user.bio || 'Chưa có lời giới thiệu.'}</p>
                <ul>
                  {diet && <li><i className={`bi bi-${diet.icon}`} aria-hidden="true" />Chế độ ăn: <b>{diet.label}</b></li>}
                  {user.city && <li><i className="bi bi-geo-alt" aria-hidden="true" />Sống tại <b>{user.city}</b></li>}
                  <li><i className="bi bi-calendar-check" aria-hidden="true" />Tham gia {formatMonthYear(user.joinedAt)}</li>
                  {isMe && <li><i className="bi bi-envelope" aria-hidden="true" />{user.email} <small>(chỉ mình bạn thấy)</small></li>}
                </ul>
              </div>
            )}
          </div>
        </>
      )}

      {isMe && <EditProfileModal open={editing} onClose={() => setEditing(false)} />}
    </div>
  );
}
