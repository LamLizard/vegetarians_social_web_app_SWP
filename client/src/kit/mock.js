// Hàm giả lập chỉ dùng trong Review Kit (thay cho API thật).

export const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** Giả lập tải ảnh lên cloud: chạy % trong ~1.2 giây. fail = true → báo lỗi mạng. */
export const mockUpload = (fail) => (file, { onProgress, signal }) => new Promise((resolve, reject) => {
  let p = 0;
  const t = setInterval(() => {
    if (signal.aborted) { clearInterval(t); reject(new Error('Đã huỷ')); return; }
    p += 20;
    onProgress(p);
    if (p >= 100) {
      clearInterval(t);
      if (fail) reject(new Error('Mất kết nối, chưa tải được ảnh'));
      else resolve(URL.createObjectURL(file));
    }
  }, 240);
});
