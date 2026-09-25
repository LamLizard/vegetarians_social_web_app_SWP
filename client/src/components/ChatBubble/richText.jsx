// Hiện câu trả lời của AI có định dạng đơn giản mà KHÔNG dùng dangerouslySetInnerHTML:
//   **đậm** · dòng bắt đầu "- ", "• ", "* " → danh sách chấm · "1. " → danh sách số · dòng trống → đoạn mới
const inline = (text, keyBase) => text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
  part.startsWith('**') && part.endsWith('**') && part.length > 4
    ? <b key={`${keyBase}-${i}`}>{part.slice(2, -2)}</b>
    : part);

const BULLET = /^\s*[-•*]\s+/;
const NUMBER = /^\s*\d+[.)]\s+/;

export default function RichText({ text = '' }) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  const out = [];
  let para = [];
  let list = null; // { type: 'ul'|'ol', items: [] }

  const flushPara = () => {
    if (para.length) out.push({ type: 'p', items: para });
    para = [];
  };
  const flushList = () => {
    if (list) out.push(list);
    list = null;
  };

  lines.forEach((raw) => {
    const line = raw.trimEnd();
    const type = BULLET.test(line) ? 'ul' : NUMBER.test(line) ? 'ol' : null;
    if (!line.trim()) { flushPara(); flushList(); return; }
    if (type) {
      flushPara();
      if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
      list.items.push(line.replace(type === 'ul' ? BULLET : NUMBER, ''));
      return;
    }
    flushList();
    para.push(line);
  });
  flushPara();
  flushList();

  return out.map((block, bi) => {
    if (block.type === 'p') {
      return <p key={bi}>{block.items.map((l, li) => <span key={li}>{li > 0 && <br />}{inline(l, `${bi}-${li}`)}</span>)}</p>;
    }
    const List = block.type;
    return <List key={bi}>{block.items.map((l, li) => <li key={li}>{inline(l, `${bi}-${li}`)}</li>)}</List>;
  });
}
