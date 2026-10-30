import { useEffect, useId, useState } from 'react';
import Button from '../components/Button/Button';
import ConfirmDialog from '../components/ConfirmDialog/ConfirmDialog';
import Modal from '../components/Modal/Modal';
import Notice from '../components/Notice/Notice';
import styles from './ChatMealPlanner.module.css';

const MEALS = [
  ['breakfast', 'Bữa sáng'],
  ['lunch', 'Bữa trưa'],
  ['dinner', 'Bữa tối'],
];

function isMonday(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime())
    && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1;
}

function hasCompleteWeek(preview, weekStart) {
  if (!isMonday(weekStart) || !Array.isArray(preview?.days) || preview.days.length !== 7) return false;
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  return preview.days.every((day, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return day?.date === date.toISOString().slice(0, 10)
      && day.meals && MEALS.every(([key]) => Object.hasOwn(day.meals, key)
        && (day.meals[key] === null || (typeof day.meals[key]?.name === 'string' && day.meals[key].name.trim())));
  });
}

// Presentation only: the parent owns authorization, preview and saving.
export default function ChatMealPlanner({
  open, weekStart = '', preview, busy = false, missingProfile = false,
  error, canConfirm = false, onWeekStartChange, onPreview, onConfirm,
  onProfile, onContinueWithoutProfile, onCancel, pending = false, onCheck,
  savePending = false, saveNotice, onCheckSave,
}) {
  const dateId = useId();
  const [confirmOpen, setConfirmOpen] = useState(false);
  useEffect(() => { if (!open) setConfirmOpen(false); }, [open]);

  const validWeek = isMonday(weekStart);
  const currentPreview = preview?.weekStart === weekStart ? preview : null;
  const days = hasCompleteWeek(currentPreview, weekStart) ? currentPreview.days : null;
  const warnings = Array.isArray(currentPreview?.warnings)
    ? currentPreview.warnings.filter((item) => typeof item === 'string') : [];
  const close = () => { setConfirmOpen(false); onCancel?.(); };

  return (
    <>
      <Modal
        open={open}
        onClose={close}
        title="Gợi ý thực đơn bằng AI"
        description="Chọn ngày thứ Hai để xem gợi ý cho cả tuần."
        size="lg"
        dismissible={!busy}
        footer={(
          <>
            <Button variant="subtle" onClick={close} disabled={busy}>Đóng</Button>
            <Button onClick={() => onPreview?.()} disabled={!validWeek || !onPreview || pending || savePending} loading={busy}>
              Xem gợi ý
            </Button>
            {days && (
              <Button variant="outline" onClick={() => setConfirmOpen(true)}
                disabled={busy || !canConfirm || !onConfirm}>
                Lưu thực đơn
              </Button>
            )}
          </>
        )}
      >
        <div className={styles.content}>
          <div>
            <label className={styles.label} htmlFor={dateId}>Ngày bắt đầu tuần</label>
            <input id={dateId} className="form-control" type="date" value={weekStart}
              onChange={(event) => onWeekStartChange?.(event.target.value)} disabled={busy || pending || savePending} />
            {weekStart && !validWeek && <p className={styles.hint}>Vui lòng chọn một ngày thứ Hai hợp lệ.</p>}
          </div>

          {missingProfile && (
            <Notice title="Chưa có hồ sơ sức khỏe">
              <p>Bạn có thể bổ sung hồ sơ hoặc tiếp tục khi chưa kiểm tra dị ứng theo hồ sơ.</p>
              <div className={styles.actions}>
                {onProfile && <Button variant="outline" size="sm" onClick={onProfile}>Đến hồ sơ</Button>}
                {onContinueWithoutProfile && (
                  <Button variant="subtle" size="sm" onClick={onContinueWithoutProfile} disabled={busy || pending || savePending}>
                    Tiếp tục không có hồ sơ
                  </Button>
                )}
              </div>
            </Notice>
          )}
          {pending && <Notice title="Đang chờ kết quả trước">
            <p role="status">Chưa xác định được trạng thái yêu cầu. Không tạo yêu cầu mới trong lúc chờ.</p>
            <Button variant="outline" size="sm" onClick={onCheck} disabled={busy || !onCheck}>Kiểm tra lại</Button>
          </Notice>}
          {savePending && <Notice title="Đang chờ xác nhận lưu">
            <p role="status">Chưa xác định được kết quả lưu. Hãy kiểm tra lại trước khi lưu lần khác.</p>
            <Button variant="outline" size="sm" onClick={onCheckSave} disabled={busy || !onCheckSave}>Kiểm tra lại</Button>
          </Notice>}
          {saveNotice && <Notice>{saveNotice}</Notice>}
          {error && <Notice tone="alert" title="Chưa thể tạo gợi ý">{error}</Notice>}
          {warnings.map((warning, index) => <Notice key={`${index}-${warning}`}>{warning}</Notice>)}
          {currentPreview && !days && <Notice tone="alert">Gợi ý chưa đủ dữ liệu cho 7 ngày.</Notice>}
          {days && (
            <>
              <div className={styles.days}>
                {days.map((day, index) => (
                  <section className={styles.day} key={`${index}-${day?.date ?? ''}`}>
                    <h3>Ngày {index + 1}{day?.date ? ` · ${day.date}` : ''}</h3>
                    <ul>
                      {MEALS.map(([key, label]) => {
                        const meal = day?.meals?.[key];
                        return (
                          <li key={key}>
                            <strong>{label}:</strong> {meal?.name || 'Chưa có món'}
                            {meal?.allergyUnchecked && <span className={styles.hint}> · Chưa đủ dữ liệu kiểm tra dị ứng</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
              {!canConfirm && !saveNotice && !savePending && <Notice>Chưa thể lưu thực đơn lúc này.</Notice>}
            </>
          )}
        </div>
      </Modal>
      <ConfirmDialog
        open={open && confirmOpen && Boolean(days) && canConfirm}
        title="Lưu thực đơn này?"
        message="Thực đơn hiện có trong tuần có thể được thay đổi. Hãy kiểm tra các món trước khi xác nhận."
        confirmLabel="Lưu thực đơn"
        tone="primary"
        loading={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); onConfirm?.(); }}
      />
    </>
  );
}
