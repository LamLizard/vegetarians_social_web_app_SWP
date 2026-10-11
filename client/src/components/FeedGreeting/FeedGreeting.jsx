// Khoi's code: Lời chào cột trái của Bảng tin — theo prototype UI v2 (src/v2/components/Hero.jsx).
// Chỉ giữ phần lời chào (quyết định 09/10/2026). Ẩn: số liệu cộng đồng, thẻ "Mầm gợi ý hôm nay"
// vì chưa có dữ liệu thật. Không dùng BlurText; từ xoay tự viết bằng CSS (không thêm thư viện).
import { useEffect, useState } from 'react';
import s from './FeedGreeting.module.css';

const DISHES = ['bún Huế chay', 'gỏi cuốn', 'cơm gạo lứt', 'canh nấm'];
const ROTATE_MS = 3000;

const greet = (h = new Date().getHours()) => {
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
};

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** @param {{name: string}|null} user   null = khách → không gọi tên */
export default function FeedGreeting({ user }) {
  const firstName = user?.name?.trim().split(/\s+/).pop();
  const [i, setI] = useState(2); // bắt đầu ở "cơm gạo lứt" như thiết kế

  // Đổi món mỗi 3 giây; người dùng tắt hiệu ứng trong hệ điều hành → đứng yên
  useEffect(() => {
    if (reduceMotion()) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % DISHES.length), ROTATE_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={s.hero}>
      <p className={s.title}>
        <span className={s.line1}>{greet()}{firstName ? `, ${firstName}` : ''}.</span>
        <span className={s.line2}>
          <span>Hôm nay ăn</span>
          {/* Ô món + dấu "?" dính nhau → "?" không bị rớt xuống dòng riêng */}
          <span className={s.nowrap}>
            <span className={s.rotate} aria-hidden="true">
              <span key={i} className={s.word}>{DISHES[i]}</span>
            </span>
            <span className="visually-hidden">gì</span>
            <span aria-hidden="true">&nbsp;?</span>
          </span>
        </span>
      </p>
      <p className={s.lead}>Công thức, mẹo bếp và quán chay ngon quanh bạn.</p>
    </div>
  );
}
