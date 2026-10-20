import { useEffect, useState } from 'react';
import Button from '../Button/Button';
import Modal from '../Modal/Modal';

// Duy's Code: Hiện lỗi cấp trang trong hộp thoại cố định để người dùng thấy ngay.
export default function ErrorDialog({ error, title = 'Có lỗi xảy ra', onRetry, onDismiss }) {
  const [open, setOpen] = useState(Boolean(error));
  const message = typeof error === 'string' ? error : error?.message;

  useEffect(() => {
    setOpen(Boolean(error));
  }, [error]);

  const dismiss = () => {
    setOpen(false);
    onDismiss?.();
  };

  if (!message) return null;

  return (
    <Modal
      open={open}
      onClose={dismiss}
      title={title}
      size="sm"
      footer={(
        <div className="d-flex gap-2">
          {onRetry && <Button variant="outline" onClick={() => { dismiss(); onRetry(); }}>Thử lại</Button>}
          <Button variant="alert" onClick={dismiss}>Đóng</Button>
        </div>
      )}
    >
      <p role="alert" className="mb-0">{message}</p>
    </Modal>
  );
}
