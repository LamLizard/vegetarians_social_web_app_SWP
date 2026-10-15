// Tùng — cảnh báo form trống với một hành động xác nhận, không thêm lựa chọn giữ hồ sơ.
import Button from '../components/Button/Button';
import Modal from '../components/Modal/Modal';
import Notice from '../components/Notice/Notice';

export default function ShopRetryWarning({ open, onConfirm, onCancel }) {
  return <Modal open={open} title="Đăng ký lại từ đầu?" size="sm" onClose={onCancel}
    footer={<Button variant="alert" onClick={onConfirm}>Đăng ký lại</Button>}>
    <Notice tone="alert">Form đăng ký lại sẽ trống. Bạn cần nhập lại thông tin và tải ảnh mới.
      Hồ sơ đã gửi vẫn được lưu trong lịch sử.</Notice>
  </Modal>;
}
