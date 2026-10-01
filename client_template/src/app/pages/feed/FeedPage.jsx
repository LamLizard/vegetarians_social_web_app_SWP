import { Fragment, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Avatar, Button, EmptyState } from '../../../components';
import cx from '../../../components/cx';
import { useApp, useCurrentUser } from '../../store/AppStore';
import { useShell } from '../../layouts/ShellContext';
import RightRail from '../../layouts/RightRail';
import PostCard from '../../features/posts/PostCard';
import TodayHeader from '../../features/today/TodayHeader';
import NutritionRings from '../../features/today/NutritionRings';
import SwipeDeck from '../../features/discover/SwipeDeck';
import useMediaQuery from '../../utils/useMediaQuery';
import { firstName } from '../../utils/format';
import styles from './feed.module.css';

const TABS = [
  { key: 'all', label: 'Dành cho bạn' },
  { key: 'following', label: 'Đang theo dõi' },
  { key: 'recipe', label: 'Công thức' },
  { key: 'question', label: 'Hỏi đáp' },
  { key: 'review', label: 'Review quán' },
];

const COMPOSE = [
  { type: 'recipe', icon: 'journal-richtext', label: 'Công thức' },
  { type: 'review', icon: 'shop', label: 'Review quán' },
  { type: 'question', icon: 'question-circle', label: 'Hỏi cộng đồng' },
  { type: 'share', icon: 'image', label: 'Ảnh' },
];

const fold = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

/** ID01 – Bảng tin (trang chính sau khi đăng nhập). */
export default function FeedPage() {
  const { state, userById } = useApp();
  const me = useCurrentUser();
  const { openCompose } = useShell();
  const [params, setParams] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const [tab, setTab] = useState('all');
  const wide = useMediaQuery('(min-width: 1280px)');

  const posts = useMemo(() => {
    const term = fold(q);
    return state.posts
      // Bài công khai + bài chờ duyệt của chính mình (để biết bài đã gửi)
      .filter((p) => p.status === 'public' || (p.authorId === me.id && p.status === 'pending'))
      .filter((p) => {
        if (tab === 'following') return me.following.includes(p.authorId);
        if (tab !== 'all') return p.type === tab;
        return true;
      })
      .filter((p) => !term || fold([p.content, p.recipe?.title, p.restaurant?.name, userById(p.authorId)?.fullName].join(' ')).includes(term))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [state.posts, me, tab, q, userById]);

  return (
    <div className={styles.page}>
      <div className={styles.feed}>
        {q ? (
          <div className={styles.searchHead}>
            <div>
              <p className={styles.searchLabel}>Kết quả tìm kiếm</p>
              <h1 className="display">“{q}”</h1>
            </div>
            <Button variant="subtle" size="sm" icon="x-lg" onClick={() => setParams({})}>Xoá tìm kiếm</Button>
          </div>
        ) : (
          <>
            <TodayHeader />

            <section className={styles.composer} aria-label="Đăng bài">
              <div className={styles.composerTop}>
                <Avatar name={me.fullName} src={me.avatar} size={42} />
                <button type="button" className={styles.composerInput} onClick={() => openCompose('share')}>
                  {firstName(me.fullName)} ơi, hôm nay bạn nấu gì?
                </button>
              </div>
              <div className={styles.composerChips}>
                {COMPOSE.map((c) => (
                  <button key={c.type} type="button" className={styles.chip} onClick={() => openCompose(c.type)}>
                    <i className={`bi bi-${c.icon}`} aria-hidden="true" />{c.label}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        <div className={styles.tabs} role="tablist" aria-label="Lọc bảng tin">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={cx(styles.tab, tab === t.key && styles.tabOn)} onClick={() => setTab(t.key)}>
              {t.label}
              {tab === t.key && <motion.span layoutId="feed-tab" className={styles.tabLine} transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            </button>
          ))}
        </div>

        {posts.map((p, i) => (
          <Fragment key={p.id}>
            <PostCard post={p} />
            {/* Màn hình chưa đủ rộng cho cột phải → chèn khối "Hôm nay" vào giữa bảng tin */}
            {!wide && !q && i === 1 && (
              <section className={styles.inline} aria-label="Dinh dưỡng hôm nay">
                <h2 className={styles.inlineTitle}>Dinh dưỡng hôm nay</h2>
                <NutritionRings size={112} />
              </section>
            )}
            {!wide && !q && i === 3 && (
              <section className={styles.inline} aria-label="Hôm nay nấu gì">
                <h2 className={styles.inlineTitle}>Hôm nay nấu gì?</h2>
                <SwipeDeck />
              </section>
            )}
          </Fragment>
        ))}

        {posts.length === 0 ? (
          <div className={styles.emptyBox}>
            <EmptyState
              icon={q ? 'search' : 'flower3'}
              title={q ? 'Không tìm thấy bài viết nào' : 'Chưa có bài viết'}
              action={!q && <Button icon="pencil-square" onClick={() => openCompose('share')}>Viết bài đầu tiên</Button>}
            >
              {q ? 'Thử từ khoá khác, ví dụ "đậu hũ", "bún", "B12".'
                : tab === 'following' ? 'Theo dõi thêm người cùng khẩu vị để thấy bài của họ ở đây.' : 'Hãy là người đầu tiên chia sẻ trong mục này!'}
            </EmptyState>
          </div>
        ) : (
          <p className={styles.end}>Bạn đã xem hết bài mới rồi</p>
        )}
      </div>

      <RightRail />
    </div>
  );
}
