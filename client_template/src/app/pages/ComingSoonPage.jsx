import { Link, useParams } from 'react-router-dom';
import { Button, EmptyState } from '../../components';
import { useChat } from '../features/assistant/ChatContext';
import styles from './simple.module.css';

const SECTIONS = {
  menu: { icon: 'calendar-week', title: 'Thực đơn tuần', text: 'Lên thực đơn 7 ngày cân bằng dinh dưỡng, tự tạo danh sách đi chợ.', prompt: 'Lên thực đơn hôm nay cho mình' },
  restaurants: { icon: 'shop', title: 'Quán chay', text: 'Bản đồ quán chay đã được quản trị viên xác minh gần bạn.', prompt: 'Quán chay nào đã được xác minh?' },
  people: { icon: 'person-plus', title: 'Gợi ý theo dõi', text: 'Tìm thêm bạn bè cùng khẩu vị.' },
};

/** Trang cho các mục ngoài phạm vi hiện tại (chưa làm). */
export default function ComingSoonPage() {
  const { section } = useParams();
  const { askMam } = useChat();
  const s = SECTIONS[section] ?? { icon: 'tools', title: 'Tính năng mới', text: '' };

  return (
    <div className={styles.center}>
      <div className={styles.box}>
        <EmptyState
          icon={s.icon}
          title={`${s.title} sắp ra mắt`}
          action={(
            <div className="d-flex flex-wrap justify-content-center gap-2">
              {s.prompt && <Button icon="flower1" onClick={() => askMam(s.prompt)}>Hỏi Mầm trước</Button>}
              <Link to="/" className="btn btn-light">Về bảng tin</Link>
            </div>
          )}
        >
          {s.text} Nhóm đang hoàn thiện tính năng này.
        </EmptyState>
      </div>
    </div>
  );
}
