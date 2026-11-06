import styles from './ChatBubble.module.css';

// Khoi's code (05/11/2026): một bộ hiển thị câu trả lời dùng chung cho ChatBubble và ChatbotPage —
// **đậm**, `code`, tiêu đề, danh sách, bảng GFM; KHÔNG dùng dangerouslySetInnerHTML.
const BULLET = /^\s*[-•*]\s+/;
const NUMBER = /^\s*(\d+)[.)]\s+/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;
const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;

const inline = (text, keyBase) => String(text).split(INLINE).map((part, i) => {
  if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
    return <b key={`${keyBase}-${i}`}>{part.slice(2, -2)}</b>;
  }
  if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
    return <code key={`${keyBase}-${i}`} className={styles.inlineCode}>{part.slice(1, -1)}</code>;
  }
  return part;
});

const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());

function parseBlocks(text) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  const blocks = [];
  let para = [];
  let list = null;
  const flushPara = () => { if (para.length) blocks.push({ type: 'p', lines: para }); para = []; };
  const flushList = () => { if (list) blocks.push(list); list = null; };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trimEnd();
    if (!line.trim()) { flushPara(); flushList(); continue; }
    // Khoi's code: bảng GFM = dòng tiêu đề "| a | b |" + dòng phân cách "|---|---|".
    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      flushPara();
      flushList();
      const head = splitRow(line);
      const rows = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i])) { rows.push(splitRow(lines[i])); i += 1; }
      i -= 1;
      blocks.push({ type: 'table', head, rows });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) { flushPara(); flushList(); blocks.push({ type: 'h', text: heading[1] }); continue; }
    const type = BULLET.test(line) ? 'ul' : NUMBER.test(line) ? 'ol' : null;
    if (type) {
      flushPara();
      if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
      if (type === 'ol' && list.start === undefined) list.start = Number(NUMBER.exec(line)[1]);
      list.items.push(line.replace(type === 'ul' ? BULLET : NUMBER, ''));
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

export default function RichText({ text = '' }) {
  return parseBlocks(text).map((block, bi) => {
    if (block.type === 'h') return <h3 key={bi}>{inline(block.text, `${bi}-h`)}</h3>;
    if (block.type === 'p') {
      return <p key={bi}>{block.lines.map((line, li) => (
        <span key={li}>{li > 0 && <br />}{inline(line, `${bi}-${li}`)}</span>
      ))}</p>;
    }
    if (block.type === 'table') {
      return (
        <div key={bi} className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr>{block.head.map((cell, ci) => <th key={ci}>{inline(cell, `${bi}-h${ci}`)}</th>)}</tr></thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>{block.head.map((_, ci) => <td key={ci}>{inline(row[ci] ?? '', `${bi}-${ri}-${ci}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    const List = block.type;
    return <List key={bi} start={block.type === 'ol' ? block.start : undefined}>{block.items.map((item, li) => (
      <li key={li}>{inline(item, `${bi}-${li}`)}</li>
    ))}</List>;
  });
}

export { RichText };
