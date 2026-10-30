// Khoi's code 28/10/2026: tìm bài trên Bảng tin theo phạm vi (Tất cả · Tiêu đề · Tác giả · Chủ đề), KHÔNG phân biệt dấu.
// 29/10: bỏ tìm hashtag (DB chưa có hashtag) → tìm theo CHỦ ĐỀ = tên danh mục gắn cho bài (bảng category qua post_category).
// Bỏ dấu bằng translate() có sẵn của PostgreSQL → không cần extension unaccent trên DB chung (Neon) của nhóm.
// Hàm thuần (không gọi DB) → test được ở postSearch.test.js.

/** Các phạm vi hợp lệ cho ?in= (mặc định 'all') */
const SEARCH_SCOPES = ['all', 'title', 'author', 'topic'];

// 67 chữ cái tiếng Việt có dấu (thường) → chữ không dấu. Thêm bản HOA để không phụ thuộc collation của lower() trên DB.
const VI_LOWER = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
const VI_PLAIN = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';
const VI_FROM = VI_LOWER + VI_LOWER.toUpperCase();
const VI_TO = VI_PLAIN + VI_PLAIN;
if ([...VI_FROM].length !== [...VI_TO].length) throw new Error('postSearch: bảng bỏ dấu lệch độ dài');

/** Biểu thức SQL: chữ thường + bỏ dấu. fold('p.title') → translate(lower(p.title), 'àá…', 'aa…') */
const fold = (sqlExpr) => `translate(lower(${sqlExpr}), '${VI_FROM}', '${VI_TO}')`;

/** "%" và "_" người dùng gõ không bị hiểu là ký tự đại diện của LIKE */
const likeOf = (q) => `%${q.replace(/[\\%_]/g, '\\$&')}%`;

/**
 * Từ khoá + phạm vi → 3 tham số SQL (null = bỏ điều kiện đó). Các điều kiện nối bằng OR.
 *  - title  : tiêu đề chứa từ khoá
 *  - author : tên tác giả chứa từ khoá
 *  - topic  : bài có gắn chủ đề (danh mục đang bật) mà tên chứa từ khoá
 *  - all    : cả 3. Gõ "#Món chính" (thẻ bài đang hiện chủ đề dạng #tên) → chỉ tìm chủ đề, bỏ dấu # ở đầu.
 * @param {string} q       đã trim, ≤ 100 ký tự
 * @param {string} scope   1 trong SEARCH_SCOPES
 * @returns {{ titleLike: string|null, authorLike: string|null, topicLike: string|null }}
 */
function buildSearch(q, scope = 'all') {
  const raw = String(q ?? '').normalize('NFC').trim();
  const none = { titleLike: null, authorLike: null, topicLike: null };
  const text = raw.replace(/^#+/, '').trim();
  if (!text) return none;
  const like = likeOf(text);
  if (scope === 'topic' || (scope === 'all' && raw.startsWith('#'))) return { ...none, topicLike: like };
  return {
    titleLike: scope === 'all' || scope === 'title' ? like : null,
    authorLike: scope === 'all' || scope === 'author' ? like : null,
    topicLike: scope === 'all' ? like : null,
  };
}

/**
 * Điều kiện WHERE dùng với buildSearch(). Truyền số thứ tự tham số của titleLike, authorLike, topicLike.
 * Cả 3 tham số null → không lọc. Chủ đề: chỉ danh mục đang bật (giống hàng nút lọc và thẻ bài).
 */
const searchWhere = (pTitle, pAuthor, pTopic) => `(
      ($${pTitle}::text IS NULL AND $${pAuthor}::text IS NULL AND $${pTopic}::text IS NULL)
      OR ${fold('p.title')} LIKE ${fold(`$${pTitle}::text`)}
      OR ${fold('a.full_name')} LIKE ${fold(`$${pAuthor}::text`)}
      OR ($${pTopic}::text IS NOT NULL AND EXISTS (
        SELECT 1 FROM post_category spc JOIN category sc ON sc.category_id = spc.category_id AND sc.is_active
        WHERE spc.post_id = p.post_id AND ${fold('sc.name')} LIKE ${fold(`$${pTopic}::text`)}
      ))
    )`;

module.exports = { SEARCH_SCOPES, VI_FROM, VI_TO, fold, buildSearch, searchWhere };
