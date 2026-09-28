import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Avatar } from '../../../components';
import cx from '../../../components/cx';
import { useApp, useCurrentUser } from '../../store/AppStore';
import { DIETS, DISCOVER_DISHES } from '../../store/mockData';
import { useChat } from '../assistant/ChatContext';
import { STARTER_PROMPTS } from '../assistant/assistantEngine';
import { useShell } from '../../layouts/ShellContext';
import { useTheme } from '../../utils/theme';
import styles from './command.module.css';

const fold = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

/**
 * Bảng lệnh (Ctrl/⌘ + K): 1 ô duy nhất để tìm bài viết, thành viên, món ăn,
 * hỏi trợ lý Mầm, hoặc chạy lệnh nhanh. Dùng mũi tên ↑ ↓ và Enter.
 */
export default function CommandPalette({ open, onClose }) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const { state } = useApp();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const { askMam } = useChat();
  const { openCompose } = useShell();
  const [theme, toggleTheme] = useTheme();

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      setQ('');
      setActive(0);
      d.showModal();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
    if (!open && d.open) d.close();
  }, [open]);

  const text = q.trim();
  const groups = useMemo(() => {
    const term = fold(text);
    if (!term) {
      return [
        { title: 'Hỏi Mầm', items: STARTER_PROMPTS.slice(0, 3).map((p) => ({ icon: p.icon, label: p.text, run: () => askMam(p.text) })) },
        {
          title: 'Lệnh nhanh',
          items: [
            { icon: 'journal-richtext', label: 'Đăng công thức mới', run: () => openCompose('recipe') },
            { icon: 'compass', label: 'Hôm nay nấu gì? (Khám phá món)', run: () => navigate('/discover') },
            { icon: theme === 'dark' ? 'sun' : 'moon-stars', label: theme === 'dark' ? 'Chuyển sang chế độ Ngày' : 'Chuyển sang chế độ Đêm', run: toggleTheme },
            { icon: 'person-badge', label: 'Hộ chiếu chay của tôi', run: () => navigate(`/profile/${me.id}`) },
            { icon: 'bookmark', label: 'Bài đã lưu', run: () => navigate('/saved') },
          ],
        },
      ];
    }
    const people = state.users
      .filter((u) => u.role === 'member' && u.status === 'active' && fold(u.fullName).includes(term))
      .slice(0, 3);
    const posts = state.posts
      .filter((p) => p.status === 'public' && fold(`${p.content} ${p.recipe?.title ?? ''} ${p.restaurant?.name ?? ''}`).includes(term))
      .slice(0, 4);
    const dishes = DISCOVER_DISHES.filter((d) => fold(`${d.title} ${d.tag}`).includes(term)).slice(0, 3);

    return [
      { title: 'Hỏi Mầm', items: [{ icon: 'flower1', label: `Hỏi Mầm: “${text}”`, run: () => askMam(text), accent: true }] },
      { title: 'Tìm kiếm', items: [{ icon: 'search', label: `Tìm “${text}” trong bảng tin`, run: () => navigate(`/?q=${encodeURIComponent(text)}`) }] },
      people.length > 0 && {
        title: 'Thành viên',
        items: people.map((u) => ({ avatar: u, label: u.fullName, hint: DIETS[u.diet]?.label, run: () => navigate(`/profile/${u.id}`) })),
      },
      posts.length > 0 && {
        title: 'Bài viết',
        items: posts.map((p) => ({
          icon: p.type === 'recipe' ? 'journal-richtext' : p.type === 'review' ? 'shop' : p.type === 'question' ? 'question-circle' : 'chat-heart',
          label: p.recipe?.title ?? p.restaurant?.name ?? (p.content.length > 60 ? `${p.content.slice(0, 60)}…` : p.content),
          hint: state.users.find((u) => u.id === p.authorId)?.fullName,
          run: () => navigate(`/profile/${p.authorId}#${p.id}`),
        })),
      },
      dishes.length > 0 && {
        title: 'Món ăn',
        items: dishes.map((d) => ({ icon: 'egg-fried', label: d.title, hint: `${d.time} · ${d.kcal} kcal`, run: () => navigate('/discover') })),
      },
    ].filter(Boolean);
  }, [text, state.users, state.posts, me.id, theme, askMam, openCompose, navigate, toggleTheme]);

  const flat = groups.flatMap((g) => g.items);
  const current = Math.min(active, flat.length - 1);

  const run = (item) => {
    onClose();
    item?.run();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % flat.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + flat.length) % flat.length); }
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); run(flat[current]); }
  };

  // Giữ mục đang chọn trong tầm nhìn khi dùng phím mũi tên
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  let index = -1;
  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label="Bảng lệnh: tìm kiếm hoặc hỏi Mầm"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
    >
      {open && (
        <motion.div
          className={styles.panel}
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 36 }}
        >
          <div className={styles.inputRow}>
            <i className="bi bi-search" aria-hidden="true" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => { setQ(e.target.value); setActive(0); }}
              onKeyDown={onKeyDown}
              placeholder="Tìm món, bạn bè, bài viết… hoặc hỏi Mầm"
              aria-label="Tìm kiếm hoặc hỏi Mầm"
              role="combobox"
              aria-expanded="true"
              aria-controls="cmd-list"
              aria-activedescendant={flat.length ? `cmd-${current}` : undefined}
            />
            <kbd className={styles.esc}>Esc</kbd>
          </div>

          <div id="cmd-list" ref={listRef} className={styles.list} role="listbox">
            {groups.map((g) => (
              <div key={g.title} role="group" aria-label={g.title}>
                <div className={styles.groupTitle}>{g.title}</div>
                {g.items.map((item) => {
                  index += 1;
                  const i = index;
                  return (
                    <div
                      key={`${g.title}-${item.label}`}
                      id={`cmd-${i}`}
                      role="option"
                      aria-selected={i === current}
                      className={cx(styles.item, i === current && styles.itemOn, item.accent && styles.itemAccent)}
                      onMouseMove={() => setActive(i)}
                      onClick={() => run(item)}
                    >
                      {item.avatar
                        ? <Avatar name={item.avatar.fullName} src={item.avatar.avatar} size={28} />
                        : <span className={styles.itemIcon} aria-hidden="true"><i className={`bi bi-${item.icon}`} /></span>}
                      <span className={styles.itemLabel}>{item.label}</span>
                      {item.hint && <span className={styles.itemHint}>{item.hint}</span>}
                      {i === current && <i className={cx('bi bi-arrow-return-left', styles.enter)} aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className={styles.foot}>
            <span><kbd>↑</kbd><kbd>↓</kbd> chọn</span>
            <span><kbd>Enter</kbd> mở</span>
            <span><kbd>Esc</kbd> đóng</span>
          </div>
        </motion.div>
      )}
    </dialog>
  );
}
