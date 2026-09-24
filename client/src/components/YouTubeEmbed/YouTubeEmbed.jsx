import { useState } from 'react';
import { getYouTubeId } from '../../utils/validate';
import cx from '../cx';
import styles from './YouTubeEmbed.module.css';

/**
 * Video YouTube kiểu "tải nhẹ": ban đầu chỉ hiện ảnh bìa + nút Play, bấm mới tải trình phát.
 * → Trang có nhiều video vẫn nhanh. Ảnh bìa lỗi / link sai → hiện khung báo lỗi (NFR-07).
 * Dùng cho: Chi tiết Video (M-04), xem trước khi Đăng Video (M-06), PostCard loại video.
 *
 * @param {string} [videoId]  post.youtube_video_id (ưu tiên)
 * @param {string} [url]      hoặc link YouTube bất kỳ (tự lấy mã)
 * @param {string} title      tiêu đề video (đọc cho trình đọc màn hình)
 * @param {boolean} [autoLoad=false]  true → hiện trình phát ngay, không cần bấm
 * @param {'rounded'|'none'} [shape='rounded']
 */
export default function YouTubeEmbed({ videoId, url, title, autoLoad = false, shape = 'rounded', className }) {
  const id = videoId || getYouTubeId(url ?? '');
  const [playing, setPlaying] = useState(autoLoad);
  const [thumbFailed, setThumbFailed] = useState(false);
  const box = cx(styles.box, shape === 'rounded' && styles.rounded, className);

  if (!id) {
    return (
      <div className={cx(box, styles.error)} role="alert">
        <i className="bi bi-camera-video-off" aria-hidden="true" />
        <b>Không tải được video</b>
        <span>Link YouTube không hợp lệ hoặc video đã bị gỡ.</span>
      </div>
    );
  }

  const watchUrl = `https://www.youtube.com/watch?v=${id}`;

  if (playing) {
    return (
      <div className={box}>
        <iframe
          className={styles.frame}
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title || 'Video YouTube'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className={box}>
      {thumbFailed ? (
        <div className={styles.thumbFallback} aria-hidden="true"><i className="bi bi-youtube" /></div>
      ) : (
        <img
          className={styles.thumb}
          src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
          alt=""
          loading="lazy"
          onError={() => setThumbFailed(true)}
        />
      )}
      <button type="button" className={styles.play} onClick={() => setPlaying(true)} aria-label={`Phát video: ${title || 'YouTube'}`}>
        <i className="bi bi-play-fill" aria-hidden="true" />
      </button>
      <a className={styles.external} href={watchUrl} target="_blank" rel="noreferrer">
        <i className="bi bi-box-arrow-up-right" aria-hidden="true" /> Mở trên YouTube
      </a>
    </div>
  );
}
