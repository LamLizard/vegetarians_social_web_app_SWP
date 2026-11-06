import { useEffect, useId, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import RadioGroup from '../RadioGroup/RadioGroup';
import TextArea from '../TextArea/TextArea';
import Notice from '../Notice/Notice';
import { REPORT_REASON, REPORT_TARGET, toOptions } from '../../constants/domain';

/**
 * Hộp báo cáo vi phạm (FR-24): chọn lý do + ghi chú. Báo cáo vào hàng chờ Admin (report.status = 'pending').
 *
 * @param {boolean} open
 * @param {'post'|'comment'|'recipe'} targetType   report.target_type
 * @param {string} [targetTitle]   vd tiêu đề bài, hiện cho người dùng biết đang báo cáo cái gì
 * @param {({reasonCode, reasonText}) => Promise<void>} onSubmit
 *        reasonCode = report.reason_code ('spam', 'wrong_topic', 'not_vegan', 'abusive', 'other')
 *        Ném lỗi → hiện câu lỗi trong hộp (vd "Bạn đã báo cáo bài này rồi")
 * @param {() => void} onClose
 */
export default function ReportDialog({ open, targetType = 'post', targetTitle, onSubmit, onClose }) {
  const [reason, setReason] = useState('');
  const [text, setText] = useState('');
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState('');
  const formId = useId();

  useEffect(() => {
    if (!open) { setReason(''); setText(''); setErrors({}); setServerError(''); }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!reason) errs.reason = 'Chọn lý do báo cáo';
    if (reason === 'other' && !text.trim()) errs.text = 'Mô tả ngắn vấn đề bạn gặp';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSending(true);
    setServerError('');
    try {
      await onSubmit?.({ reasonCode: reason, reasonText: text.trim() || null });
      onClose?.();
    } catch (err) {
      setServerError(err?.message || 'Chưa gửi được báo cáo, thử lại sau');
    } finally {
      setSending(false);
    }
  };

  const what = (REPORT_TARGET[targetType] ?? 'nội dung').toLowerCase();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Báo cáo ${what}`}
      description={targetTitle ? `"${targetTitle}"` : undefined}
      size="sm"
      dismissible={!sending}
      footer={(
        <>
          <Button variant="subtle" onClick={onClose} disabled={sending}>Huỷ</Button>
          <Button type="submit" form={formId} variant="alert" icon="flag" loading={sending}>Gửi báo cáo</Button>
        </>
      )}
    >
      <form id={formId} onSubmit={submit} noValidate className="d-grid gap-3">
        {serverError && <Notice tone="alert">{serverError}</Notice>}
        <RadioGroup
          label="Lý do"
          required
          options={toOptions(REPORT_REASON)}
          value={reason}
          onChange={(v) => { setReason(v); setErrors((x) => ({ ...x, reason: undefined })); }}
          error={errors.reason}
        />
        <TextArea
          label="Mô tả thêm"
          required={reason === 'other'}
          rows={2}
          maxLength={500}
          value={text}
          onChange={(v) => { setText(v); setErrors((x) => ({ ...x, text: undefined })); }}
          error={errors.text}
          hint="Admin sẽ xem xét. Người đăng không biết ai đã báo cáo."
        />
      </form>
    </Modal>
  );
}
