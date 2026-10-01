// Định dạng thời gian / số theo kiểu tiếng Việt.

/** "Vừa xong", "5 phút", "3 giờ", "2 ngày", quá 7 ngày → "12/09/2026" */
export function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} ngày`;
  return formatDate(iso);
}

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

export const formatNumber = (n) => n.toLocaleString('vi-VN');

/** "tháng 3 năm 2026" */
export const formatMonthYear = (iso) =>
  new Date(iso).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

/** Tên gọi thân mật: "Lâm Anh Khôi" → "Khôi" */
export const firstName = (fullName = '') => fullName.trim().split(/\s+/).pop();

/**
 * Đọc ảnh người dùng chọn → thu nhỏ (cạnh dài tối đa maxSize px) → data URL JPEG.
 * Thu nhỏ để lưu được vào localStorage của bản demo.
 */
export function readImageFile(file, maxSize = 1200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được file ảnh.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File không phải ảnh hợp lệ.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
