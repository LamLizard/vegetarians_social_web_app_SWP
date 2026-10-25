// Khoi's code: Hỏi server (POST /api/posts/youtube-check) xem video YouTube có PHÁT ĐƯỢC trên trang mình không,
// sau khi người dùng ngừng gõ 0,6 giây. Dùng ở form Đăng bài (video) và Tạo công thức (15/10/2026).
// Server vẫn kiểm tra lại lúc gửi — ở đây chỉ để báo sớm cho người dùng.
import { useEffect, useState } from 'react';
import postService from '../services/post.service';
import { getYouTubeId } from '../utils/validate';

const DEBOUNCE_MS = 600;

/**
 * @param {string} url  link đang gõ
 * @returns {{ status: 'idle'|'checking'|'ok'|'blocked'|'missing'|'unknown', title?: string, author?: string,
 *             message?: string, rejected: boolean }}
 *   idle = chưa có link hợp lệ · rejected = video không phát được → khoá nút gửi
 */
export default function useYouTubeCheck(url) {
  const id = getYouTubeId(String(url ?? '').trim());
  const [result, setResult] = useState({ id: null, status: 'idle' });

  useEffect(() => {
    if (!id) return undefined;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      postService.checkYouTube(`https://www.youtube.com/watch?v=${id}`, { signal: ctrl.signal })
        .then((r) => setResult({ ...r, id }))
        .catch((err) => { if (err?.name !== 'AbortError') setResult({ id, status: 'unknown' }); });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [id]);

  if (!id) return { status: 'idle', rejected: false };
  if (result.id !== id) return { status: 'checking', rejected: false }; // link mới, đang chờ / đang hỏi
  return { ...result, rejected: result.status === 'blocked' || result.status === 'missing' };
}

/** Câu hiển thị dưới ô link (hint khi ổn, error khi bị chặn) */
export function youTubeCheckText(check) {
  switch (check.status) {
    case 'checking': return { hint: 'Đang kiểm tra video…' };
    case 'ok': return { hint: `✓ ${[check.title, check.author].filter(Boolean).join(' · ') || 'Video phát được'}` };
    case 'blocked':
    case 'missing': return { error: check.message };
    case 'unknown': return { hint: 'Chưa kiểm tra được video lúc này, bạn vẫn gửi được.' };
    default: return {};
  }
}
