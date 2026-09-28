// Ghép tên class, bỏ qua giá trị rỗng/false.
// cx('btn', isActive && 'active', undefined) → "btn active"
export default function cx(...names) {
  return names.filter(Boolean).join(' ');
}
