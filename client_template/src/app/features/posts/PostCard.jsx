import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Avatar, Button, HighlightChip, IconButton, Menu, Modal, Notice, Photo, StatusBadge, useToast,
} from '../../../components';
import cx from '../../../components/cx';
import { NUTRIENTS } from '../../../components/nutrients';
import { useApp, useCurrentUser } from '../../store/AppStore';
import { useChat } from '../assistant/ChatContext';
import { quickAnswer } from '../assistant/assistantEngine';
import { DIETS } from '../../store/mockData';
import { firstName, formatNumber, timeAgo } from '../../utils/format';
import styles from './post.module.css';

const TYPE_PHRASE = {
  recipe: 'chia sẻ công thức',
  review: 'review một quán chay',
  question: 'hỏi cộng đồng',
};
const PREVIEW_CHARS = 280;
const isVeganNote = (note = '') => /thuần chay|không trứng, không sữa|không trứng và sữa/i.test(note);

function Stars({ value }) {
  return (
    <span className={styles.stars} role="img" aria-label={`${value} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={`bi bi-${value >= i ? 'star-fill' : value >= i - 0.5 ? 'star-half' : 'star'}`} aria-hidden="true" />
      ))}
    </span>
  );
}

/** Thanh tỉ lệ năng lượng đạm / carbs / béo (tính theo kcal: 4 – 4 – 9) + chú thích có số. */
export function MacroBar({ macros }) {
  const parts = [
    { key: 'protein', g: macros.protein, kcal: macros.protein * 4, short: 'Đạm' },
    { key: 'carb', g: macros.carb, kcal: macros.carb * 4, short: 'Carbs' },
    { key: 'fat', g: macros.fat, kcal: macros.fat * 9, short: 'Béo' },
  ];
  return (
    <div className={styles.macro}>
      <div className={styles.macroBar} role="img" aria-label={parts.map((p) => `${NUTRIENTS[p.key].label} ${p.g} gam`).join(', ')}>
        {parts.map((p) => <span key={p.key} style={{ flexGrow: p.kcal, background: NUTRIENTS[p.key].color }} />)}
      </div>
      <ul className={styles.macroLegend} aria-hidden="true">
        {parts.map((p) => (
          <li key={p.key}><i style={{ background: NUTRIENTS[p.key].color }} />{p.short} <b>{p.g}g</b></li>
        ))}
      </ul>
    </div>
  );
}

/** Khối công thức (tên món, thời gian, calo, macro, thành phần) + khối quán của bài viết. Dùng lại ở trang duyệt. */
export function PostExtras({ post }) {
  const { state } = useApp();
  const verified = post.restaurant && state.restaurants.some((r) => r.status === 'verified' && r.name === post.restaurant.name);
  return (
    <>
      {post.recipe && (
        <div className={styles.recipe}>
          <div className={styles.recipeTop}>
            <h3 className={styles.recipeTitle}>{post.recipe.title}</h3>
            <span className={cx(styles.dietChip, !isVeganNote(post.recipe.ingredientsNote) && styles.dietChipEgg)}>
              <i className={`bi bi-${isVeganNote(post.recipe.ingredientsNote) ? 'flower3' : 'egg'}`} aria-hidden="true" />
              {isVeganNote(post.recipe.ingredientsNote) ? 'Thuần chay' : 'Có trứng / sữa'}
            </span>
          </div>
          <div className={styles.recipeMeta}>
            {post.recipe.cookTime && <span><i className="bi bi-clock" aria-hidden="true" /> {post.recipe.cookTime}</span>}
            {post.recipe.kcal && <span><i className="bi bi-fire" aria-hidden="true" /> {post.recipe.kcal} kcal</span>}
            {post.recipe.tag && <span><i className="bi bi-tag" aria-hidden="true" /> {post.recipe.tag}</span>}
          </div>
          {post.recipe.macros && <MacroBar macros={post.recipe.macros} />}
          <p className={styles.note}><b>Thành phần:</b> {post.recipe.ingredientsNote}</p>
        </div>
      )}

      {post.restaurant && (
        <div className={styles.place}>
          <span className={styles.placeIcon} aria-hidden="true"><i className="bi bi-shop" /></span>
          <div className={styles.placeInfo}>
            <b>{post.restaurant.name}</b>
            <small><i className="bi bi-geo-alt" aria-hidden="true" /> {post.restaurant.address}</small>
            {verified
              ? <StatusBadge status="verified" label="Quán đã xác minh" className="mt-1 align-self-start" />
              : <small className={styles.unverified}>Quán chưa được xác minh</small>}
          </div>
          <div className={styles.placeScore}>
            <b>{String(post.restaurant.rating).replace('.', ',')}</b>
            <Stars value={post.restaurant.rating} />
          </div>
        </div>
      )}
    </>
  );
}

/** Nút phản ứng có hiệu ứng "nảy" khi bật */
function Reaction({ on, icon, iconOn, label, count, onClick }) {
  return (
    <motion.button
      type="button"
      className={cx(styles.react, on && styles.reactOn)}
      aria-pressed={on}
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
    >
      <motion.i
        key={on ? 'on' : 'off'}
        className={`bi bi-${on ? iconOn : icon}`}
        aria-hidden="true"
        initial={on ? { scale: 0.4 } : false}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 600, damping: 14 }}
      />
      <span>{label}</span>
      {count > 0 && <span className={styles.reactCount}>{formatNumber(count)}</span>}
    </motion.button>
  );
}

/** Ô "Mầm trả lời nhanh" dưới bài hỏi đáp */
function QuickAnswer({ question }) {
  const [open, setOpen] = useState(false);
  const { askMam } = useChat();
  const answer = quickAnswer(question);
  return (
    <div className={styles.quick}>
      <div className={styles.quickHead}>
        <span className={styles.quickMark} aria-hidden="true"><i className="bi bi-flower1" /></span>
        <b>Mầm trả lời nhanh</b>
        <HighlightChip icon="stars">AI</HighlightChip>
      </div>
      <p className={cx(styles.quickText, !open && styles.clamp)}>{answer}</p>
      <div className={styles.quickActions}>
        <button type="button" className={styles.linkBtn} onClick={() => setOpen((v) => !v)}>{open ? 'Thu gọn' : 'Đọc hết'}</button>
        <button type="button" className={styles.linkBtn} onClick={() => askMam(question)}>Hỏi tiếp Mầm</button>
      </div>
    </div>
  );
}

/**
 * Một bài viết. Bố cục thay đổi theo loại bài (công thức / review / hỏi đáp / chia sẻ).
 * Bài chưa công khai (chờ duyệt, bị từ chối) chỉ tác giả thấy → ẩn tương tác.
 */
export default function PostCard({ post }) {
  const { actions, userById } = useApp();
  const me = useCurrentUser();
  const { askMam } = useChat();
  const toast = useToast();
  const author = userById(post.authorId);
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(post.comments.length > 0 && post.comments.length <= 2);
  const [showAll, setShowAll] = useState(false);
  const [comment, setComment] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const commentRef = useRef(null);

  const isMine = post.authorId === me.id;
  const isPublic = post.status === 'public';
  const isRecipe = post.type === 'recipe';
  const liked = post.likes.includes(me.id);
  const saved = post.savedBy.includes(me.id);
  const cookedBy = post.cookedBy ?? [];
  const cooked = cookedBy.includes(me.id);
  const long = post.content.length > PREVIEW_CHARS;
  const text = long && !expanded ? `${post.content.slice(0, PREVIEW_CHARS).trimEnd()}…` : post.content;
  const comments = showAll ? post.comments : post.comments.slice(-2);
  const hidden = post.comments.length - comments.length;
  const subject = post.recipe?.title ?? post.restaurant?.name;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/profile/${post.authorId}#${post.id}`); } catch { /* bị chặn */ }
  };

  const focusComment = () => {
    setShowComments(true);
    setTimeout(() => commentRef.current?.focus(), 0);
  };

  const send = (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    actions.addComment(post.id, comment);
    setComment('');
    setShowAll(true);
  };

  const askAbout = () => {
    if (isRecipe) askMam(`Phân tích món ${post.recipe.title}: bao nhiêu đạm, thuần chay hoá thế nào?`);
    else if (post.type === 'review') askMam('Quán chay nào đã được xác minh?');
    else askMam(post.content);
  };

  const cookedNames = cookedBy.map((id) => userById(id)).filter(Boolean);
  const cookedLine = cookedNames.length === 0 ? null
    : cookedNames.length === 1 ? `${firstName(cookedNames[0].fullName)} đã nấu theo`
      : `${firstName(cookedNames[0].fullName)} và ${cookedNames.length - 1} người khác đã nấu theo`;

  const menuItems = [
    { icon: saved ? 'bookmark-x' : 'bookmark', label: saved ? 'Bỏ lưu bài viết' : 'Lưu bài viết', onClick: () => { actions.toggleSave(post.id); toast(saved ? 'Đã bỏ lưu' : 'Đã lưu vào "Đã lưu"'); } },
    { icon: 'link-45deg', label: 'Sao chép liên kết', onClick: async () => { await copyLink(); toast('Đã sao chép liên kết'); } },
    { divider: true },
    isMine
      ? { icon: 'trash3', label: 'Xoá bài viết', tone: 'alert', onClick: () => setConfirmDelete(true) }
      : { icon: 'flag', label: 'Báo cáo bài viết', hint: 'Quản trị viên sẽ xem xét', onClick: () => toast('Đã gửi báo cáo tới quản trị viên') },
  ];

  return (
    <motion.article
      id={post.id}
      className={cx(styles.post, !isPublic && styles.notPublic, styles[`type_${post.type}`])}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {!isPublic && (
        <div className={styles.statusBar}>
          <StatusBadge status={post.status} />
          <span>{post.status === 'pending' ? 'Chỉ bạn thấy bài này cho tới khi được duyệt.' : 'Bài không hiển thị công khai.'}</span>
        </div>
      )}

      <header className={styles.head}>
        <Link to={`/profile/${author.id}`} aria-label={`Trang cá nhân của ${author.fullName}`}>
          <Avatar name={author.fullName} src={author.avatar} size={44} />
        </Link>
        <div className={styles.meta}>
          <div className={styles.byline}>
            <Link to={`/profile/${author.id}`} className={styles.author}>{author.fullName}</Link>
            {TYPE_PHRASE[post.type] && <span className={styles.phrase}> {TYPE_PHRASE[post.type]}</span>}
          </div>
          <div className={styles.sub}>
            <span>{DIETS[author.diet]?.label}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.createdAt} title={new Date(post.createdAt).toLocaleString('vi-VN')}>{timeAgo(post.createdAt)}</time>
          </div>
        </div>
        <Menu width={260} items={menuItems} renderTrigger={(p) => <IconButton variant="ghost" icon="three-dots" label="Tuỳ chọn bài viết" {...p} />} />
      </header>

      {post.type === 'question' ? (
        <p className={styles.question}>{post.content}</p>
      ) : (
        <p className={styles.text}>
          {text}
          {long && <button type="button" className={styles.more} onClick={() => setExpanded((v) => !v)}>{expanded ? 'Thu gọn' : 'Xem thêm'}</button>}
        </p>
      )}

      {post.image && (
        <div className={styles.mediaWrap}>
          <Photo src={post.image} alt={subject ? `Ảnh: ${subject}` : 'Ảnh món ăn'} className={styles.media} />
        </div>
      )}

      <PostExtras post={post} />

      {post.type === 'question' && isPublic && <QuickAnswer question={post.content} />}

      {post.status === 'rejected' && <Notice tone="alert" title="Bài bị từ chối" className={styles.rejected}>{post.rejectReason}</Notice>}

      {isPublic && (
        <>
          {isRecipe && cookedLine && (
            <div className={styles.cookedLine}>
              <span className={styles.avatarStack}>
                {cookedNames.slice(0, 3).map((u) => <Avatar key={u.id} name={u.fullName} src={u.avatar} size={22} />)}
              </span>
              {cookedLine}
            </div>
          )}

          <footer className={styles.actions}>
            <Reaction on={liked} icon="heart" iconOn="heart-fill" label="Ngon" count={post.likes.length} onClick={() => actions.toggleLike(post.id)} />
            {isRecipe ? (
              <Reaction on={cooked} icon="check2-circle" iconOn="check-circle-fill" label="Đã nấu theo" count={cookedBy.length}
                onClick={() => { actions.toggleCooked(post.id); if (!cooked) toast(`Tuyệt! Đã ghi nhận bạn nấu theo "${post.recipe.title}"`); }} />
            ) : (
              <Reaction on={saved} icon="bookmark" iconOn="bookmark-fill" label="Lưu" count={0}
                onClick={() => { actions.toggleSave(post.id); toast(saved ? 'Đã bỏ lưu' : 'Đã lưu vào "Đã lưu"'); }} />
            )}
            <button type="button" className={styles.react} onClick={focusComment}>
              <i className="bi bi-chat" aria-hidden="true" /><span>Bình luận</span>
              {post.comments.length > 0 && <span className={styles.reactCount}>{post.comments.length}</span>}
            </button>
            <span className={styles.spacer} />
            {post.type !== 'question' && (
              <button type="button" className={cx(styles.react, styles.askMam)} onClick={askAbout} title="Hỏi Mầm về bài này">
                <i className="bi bi-flower1" aria-hidden="true" /><span>Hỏi Mầm</span>
              </button>
            )}
            <IconButton variant="ghost" size="sm" icon="send" label="Chia sẻ" onClick={async () => { await copyLink(); actions.share(post.id); toast('Đã sao chép liên kết để chia sẻ'); }} />
          </footer>

          <AnimatePresence initial={false}>
            {showComments && (
              <motion.div
                className={styles.comments}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className={styles.commentsInner}>
                  {hidden > 0 && <button type="button" className={styles.linkBtn} onClick={() => setShowAll(true)}>Xem thêm {hidden} bình luận</button>}
                  {comments.map((c) => {
                    const cu = userById(c.authorId);
                    return (
                      <div key={c.id} className={styles.comment}>
                        <Link to={`/profile/${cu.id}`}><Avatar name={cu.fullName} src={cu.avatar} size={30} /></Link>
                        <div>
                          <div className={styles.commentBubble}>
                            <Link to={`/profile/${cu.id}`} className={styles.commentAuthor}>{cu.fullName}</Link>
                            <p>{c.content}</p>
                          </div>
                          <div className={styles.commentMeta}>
                            <span>{timeAgo(c.createdAt)}</span>
                            <button type="button" onClick={() => { setComment(`@${cu.fullName} `); commentRef.current?.focus(); }}>Trả lời</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <form className={styles.commentForm} onSubmit={send}>
                    <Avatar name={me.fullName} src={me.avatar} size={30} />
                    <div className={styles.commentInputWrap}>
                      <input ref={commentRef} value={comment} onChange={(e) => setComment(e.target.value)} className={styles.commentInput} placeholder="Viết bình luận…" aria-label="Viết bình luận" maxLength={500} />
                      <IconButton type="submit" variant="ghost" size="sm" icon="arrow-up-circle-fill" label="Gửi bình luận" disabled={!comment.trim()} />
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Xoá bài viết?"
        size="sm"
        footer={(
          <>
            <Button variant="subtle" onClick={() => setConfirmDelete(false)}>Hủy</Button>
            <Button variant="alert" icon="trash3" onClick={() => { actions.deletePost(post.id); toast('Đã xoá bài viết'); }}>Xoá bài</Button>
          </>
        )}
      >
        <p className="mb-0">Bài viết cùng toàn bộ phản ứng và bình luận sẽ bị xoá vĩnh viễn.</p>
      </Modal>
    </motion.article>
  );
}

