// Khoi's code: Hiện nội dung bài viết có **đậm** và *nghiêng* (D-11) mà KHÔNG dùng dangerouslySetInnerHTML
// → người dùng gõ <script> cũng chỉ hiện thành chữ, không chạy được.
//   Dòng trống = sang đoạn mới · xuống dòng thường giữ nguyên (CSS white-space: pre-line ở chỗ dùng).

// Tách theo cặp dấu: **chữ** trước, *chữ* sau (không vắt qua dòng)
const TOKEN = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;

function inline(text, keyBase) {
  return text.split(TOKEN).map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>;
    return part;
  });
}

/** Bỏ dấu ** và * — dùng cho đoạn trích ngắn trên thẻ bài */
export const stripMarks = (text = '') => String(text).replace(TOKEN, (m) => (m.startsWith('**') ? m.slice(2, -2) : m.slice(1, -1)));

/** @param {string} text  post.content (Markdown rút gọn) */
export default function PostRichText({ text = '' }) {
  const paragraphs = String(text).replace(/\r/g, '').split(/\n{2,}/).filter((p) => p.trim());
  return paragraphs.map((p, i) => <p key={i}>{inline(p, i)}</p>);
}
