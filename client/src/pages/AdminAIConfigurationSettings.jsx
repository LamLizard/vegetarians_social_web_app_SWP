import Button from '../components/Button/Button';
import Checkbox from '../components/Checkbox/Checkbox';
import Notice from '../components/Notice/Notice';
import Select from '../components/Select/Select';
import styles from './AdminAIConfigurationPage.module.css';

const providers = [
  { value: 'openai', label: 'OpenAI Moderation' },
  { value: 'groq', label: 'Groq GPT-OSS 20B' },
];

function statusText(status) {
  if (!status || status.state === 'unknown') return 'Chưa có thông tin lỗi gần đây.';
  const time = status.observedAt ? new Date(status.observedAt).toLocaleString('vi-VN') : '';
  const label = status.state === 'rate_limited' ? 'Đã gặp giới hạn yêu cầu' : 'Đã gặp lỗi kết nối hoặc dịch vụ';
  return `${label}${time ? `, ${time}` : ''}.`;
}

export default function AdminAIConfigurationSettings({
  config, status, error, message, busy, hasChanges, onChange, onSave, onReload,
}) {
  return (
    <div className={styles.settings}>
      {error && <Notice tone="alert" action={{ label: 'Tải lại', onClick: onReload }}>{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      {config && (
        <form onSubmit={onSave} className={styles.form}>
          <div className={styles.settingsHeader}>
            <div><h2>Cấu hình dịch vụ</h2><p>Điều chỉnh các tính năng AI và nhà cung cấp.</p></div>
            <Button type="submit" loading={busy} disabled={!hasChanges}>Lưu cấu hình</Button>
          </div>
          <section className={styles.setting}>
            <div><h3>Kiểm duyệt bình luận</h3><p>Chọn dịch vụ cho nội dung bình luận.</p></div>
            <div className={styles.settingControls}>
              <Checkbox className={styles.switch} switch checked={config.comment.enabled} disabled={busy}
                onChange={(enabled) => onChange('comment', { enabled })}>Bật AI cho bình luận</Checkbox>
              <Select label="Dịch vụ kiểm duyệt bình luận" options={providers}
                value={config.comment.provider} disabled={busy || !config.comment.enabled}
                onChange={(provider) => onChange('comment', { provider })} />
            </div>
          </section>
          <section className={styles.setting}>
            <div><h3>Kiểm duyệt bài viết</h3><p>Chọn dịch vụ cho nội dung bài viết.</p></div>
            <div className={styles.settingControls}>
              <Checkbox className={styles.switch} switch checked={config.post.enabled} disabled={busy}
                onChange={(enabled) => onChange('post', { enabled })}>Bật AI cho bài viết</Checkbox>
              <Select label="Dịch vụ kiểm duyệt bài viết" options={providers}
                value={config.post.provider} disabled={busy || !config.post.enabled}
                onChange={(provider) => onChange('post', { provider })} />
            </div>
          </section>
          <section className={styles.setting}>
            {/* Tùng: hiển thị đúng provider/model chatbot, giữ checkbox cấu hình hiện có. */}
            <div><h3>Chatbot</h3><p>Model: DeepSeek ({config.chatbot.model})</p></div>
            <Checkbox className={styles.switch} switch checked={config.chatbot.enabled} disabled={busy}
              onChange={(enabled) => onChange('chatbot', { enabled })}>Bật chatbot</Checkbox>
          </section>
          <section className={styles.serviceStatus} aria-label="Tình trạng dịch vụ AI">
            <div><h3>Tình trạng dịch vụ</h3><p>Thông tin dựa trên lỗi gần nhất được máy chủ ghi nhận.</p></div>
            <div className={styles.serviceRows}>
              <p><strong>OpenAI:</strong> {statusText(status?.openai)}</p>
              <p><strong>Groq:</strong> {statusText(status?.groq)}</p>
              {/* Tùng: trạng thái DeepSeek không gộp với lỗi của Groq. */}
              <p><strong>DeepSeek:</strong> {statusText(status?.deepseek)}</p>
            </div>
          </section>
        </form>
      )}
    </div>
  );
}
