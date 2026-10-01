// Avatar có màu nền riêng theo tên (Avatar của kit tô cùng 1 màu cho mọi người → bảng tin nhìn đều đều).
// Màu lấy trong họ đất – lá cho hợp theme; pha với màu thẻ / màu chữ bằng color-mix
// → tự hợp cả nền Sáng lẫn Tối. Theo prototype UI v2.1 (ProtoAvatar).
const TONES = ['#3D7A3D', '#A0582A', '#2F7E8E', '#8B55A8', '#A87A00', '#C0502F'];

// "Lâm Anh Khôi" → "K" (người Việt gọi theo tên)
const initialOf = (name = '') => name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() ?? '?';
// Cùng 1 tên luôn ra cùng 1 màu
const hash = (s = '') => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * @param {string} name
 * @param {string} [src]   có ảnh → hiện ảnh
 * @param {number} [size=40]  px
 */
export default function ColorAvatar({ name = '', src, size = 40 }) {
  const style = { width: size, height: size, flex: 'none', borderRadius: '50%', fontSize: size * 0.4 };
  if (src) return <img src={src} alt={name} style={{ ...style, objectFit: 'cover' }} />;

  const tone = TONES[hash(name) % TONES.length];
  return (
    <span
      role="img"
      aria-label={name}
      style={{
        ...style,
        display: 'inline-grid',
        placeItems: 'center',
        background: `color-mix(in srgb, ${tone} 20%, var(--ac-card))`,
        color: `color-mix(in srgb, ${tone} 72%, var(--ac-ink))`,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {initialOf(name)}
    </span>
  );
}
