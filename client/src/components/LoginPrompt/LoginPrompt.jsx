import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { GUEST_LIMIT } from '../../constants/domain';
import styles from './LoginPrompt.module.css';

const COPY = {
  posts: {
    icon: 'journal-bookmark',
    title: 'Bạn đã xem hết lượt hôm nay',
    text: `Khách được đọc ${GUEST_LIMIT.postsPerDay} bài mỗi ngày. Đăng nhập để đọc không giới hạn, lưu món yêu thích và bình luận.`,
  },
  chat: {
    icon: 'chat-heart',
    title: 'Bạn đã dùng hết lượt hỏi thử',
    text: `Khách được hỏi trợ lý ${GUEST_LIMIT.chatTurnsPerDay} lần mỗi ngày. Tạo tài khoản miễn phí để hỏi tiếp và lưu lịch sử trò chuyện.`,
  },
  recipe: {
    icon: 'journal-richtext',
    title: 'Đăng nhập để xem công thức',
    text: `Khách chỉ xem được ${GUEST_LIMIT.recipes} công thức nổi bật. Đăng nhập để xem chi tiết, nguyên liệu, cách làm và thích công thức.`,
  },
  action: {
    icon: 'person-check',
    title: 'Đăng nhập để tiếp tục',
    text: 'Bạn cần tài khoản để bình chọn, bình luận, báo cáo hoặc đăng bài.',
  },
};

/**
 * Mời khách đăng nhập (chặn mềm, BR-04): đóng được, không khoá cứng trang.
 *  - reason="posts": khách mở bài thứ 4 trong ngày (UC-02)
 *  - reason="chat" : khách hết 3 lượt chatbot (UC-10)
 *  - reason="recipe": khách bấm vào thẻ công thức ở /recipes
 *  - reason="action": khách bấm Thích / Bình luận / Báo cáo / Viết bài
 *
 * @param {boolean} open
 * @param {'posts'|'chat'|'recipe'|'action'} [reason='action']
 * @param {() => void} onLogin · onRegister · onClose
 */
export default function LoginPrompt({ open, reason = 'action', onLogin, onRegister, onClose }) {
  const c = COPY[reason] ?? COPY.action;
  return (
    <Modal open={open} onClose={onClose} title={c.title} size="sm">
      <div className={styles.body}>
        <span className={styles.icon} aria-hidden="true"><i className={`bi bi-${c.icon}`} /></span>
        <p className={styles.text}>{c.text}</p>
        <div className={styles.actions}>
          <Button block onClick={onLogin}>Đăng nhập</Button>
          <Button block variant="outline" onClick={onRegister}>Tạo tài khoản miễn phí</Button>
          <Button block variant="subtle" onClick={onClose}>Để sau</Button>
        </div>
      </div>
    </Modal>
  );
}
