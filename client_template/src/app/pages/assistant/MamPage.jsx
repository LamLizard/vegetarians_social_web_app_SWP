import { Button, MicronutrientList, Notice } from '../../../components';
import { useCurrentUser } from '../../store/AppStore';
import { DIETS, MY_MICROS } from '../../store/mockData';
import { useChat } from '../../features/assistant/ChatContext';
import MamThread from '../../features/assistant/MamThread';
import MamComposer from '../../features/assistant/MamComposer';
import NutritionRings from '../../features/today/NutritionRings';
import styles from './mamPage.module.css';

/** Trang Mầm – trợ lý AI toàn màn hình, câu trả lời kèm thẻ giao diện (thực đơn, vi chất, quán…). */
export default function MamPage() {
  const me = useCurrentUser();
  const { messages, typing, newConversation } = useChat();
  const diet = DIETS[me.diet];

  return (
    <div className={styles.page}>
      <section className={styles.chat} aria-label="Trò chuyện với Mầm">
        <header className={styles.head}>
          <span className={styles.mark} aria-hidden="true"><i className="bi bi-flower1" /></span>
          <div className={styles.headText}>
            <h1>Mầm</h1>
            <small>Trợ lý dinh dưỡng · hiểu chế độ {diet?.label.toLowerCase()} của bạn</small>
          </div>
          <Button variant="subtle" size="sm" icon="plus-lg" onClick={newConversation} disabled={!messages.length || typing}>
            Cuộc trò chuyện mới
          </Button>
        </header>
        <MamThread variant="page" />
        <div className={styles.composerWrap}>
          <MamComposer autoFocus />
        </div>
      </section>

      <aside className={styles.side} aria-label="Thông tin Mầm đang dùng">
        <section className={styles.block}>
          <h2>Mầm đang dựa trên</h2>
          <ul className={styles.context}>
            <li><span>Chế độ ăn</span><b>{diet?.label}</b></li>
            <li><span>Mục tiêu năng lượng</span><b>2.000 kcal/ngày</b></li>
            <li><span>Chuỗi ngày chay</span><b>{me.streak} ngày</b></li>
          </ul>
        </section>
        <section className={styles.block}>
          <h2>Hôm nay</h2>
          <NutritionRings size={112} />
        </section>
        <section className={styles.block}>
          <h2>Vi chất tuần này</h2>
          <MicronutrientList items={MY_MICROS} />
        </section>
        <Notice tone="info" title="Lưu ý">
          Mầm chỉ đưa thông tin tham khảo, không thay thế tư vấn của bác sĩ hay chuyên gia dinh dưỡng.
        </Notice>
      </aside>
    </div>
  );
}
