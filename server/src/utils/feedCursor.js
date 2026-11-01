// Khoi's code (01/11/2026): cursor phân trang Bảng tin cho 2 cách sắp xếp.
//   new (Mới nhất, mặc định): "<micro giây>_<post_id>"                — như cũ
//   top (Nhiều tim):          "<vote_count>_<micro giây>_<post_id>"
// Cursor do chính BE trả ở trang trước; FE chỉ gửi lại nguyên văn.

const FEED_SORTS = ['new', 'top'];

const PATTERNS = {
  new: /^(\d{1,19})_([1-9]\d{0,17})$/,
  top: /^(\d{1,10})_(\d{1,19})_([1-9]\d{0,17})$/,
};

/** @returns {{ votes?: string, time: string, id: string } | null}  null = cursor sai định dạng (hoặc không khớp cách sắp xếp) */
function parseFeedCursor(value, sort = 'new') {
  const m = PATTERNS[sort]?.exec(String(value));
  if (!m) return null;
  return sort === 'top' ? { votes: m[1], time: m[2], id: m[3] } : { time: m[1], id: m[2] };
}

/** Cursor của bài cuối trang (row có voteCount, sortKey, id) */
function buildFeedCursor(row, sort = 'new') {
  return sort === 'top' ? `${row.voteCount}_${row.sortKey}_${row.id}` : `${row.sortKey}_${row.id}`;
}

module.exports = { FEED_SORTS, parseFeedCursor, buildFeedCursor };
