const pool = require('../config/db');
const postModel = require('./post.model');
const { randomInt } = require('node:crypto');
// Khoi's code (05/11/2026): dùng bộ lọc không dấu của postSearch thay cho việc lọc bằng JS.
const { buildSearch, searchWhere, fold } = require('../utils/postSearch');

// Use the feed's own preview so a guest can open only a currently visible post.
async function findPostForModal(postId, account) {
  if (!account) {
    const preview = await postModel.findPreview();
    return preview.find((post) => post.id === postId) ?? null;
  }

  const { rows: [post] } = await pool.query(`
    SELECT p.post_id::text AS id, p.post_type AS type, p.title, p.content,
      p.thumbnail_url AS "thumbnailUrl", p.youtube_url AS "youtubeUrl", p.status,
      p.vote_count AS "voteCount", p.comment_count AS "commentCount",
      p.created_at AS "createdAt", COALESCE(p.published_at, p.created_at) AS "publishedAt",
      json_build_object('id', a.account_id::text, 'fullName', a.full_name, 'avatarUrl', a.avatar_url) AS author,
      COALESCE((SELECT json_agg(json_build_object('id', c.category_id::text, 'name', c.name) ORDER BY c.name)
        FROM post_category pc JOIN category c ON c.category_id = pc.category_id
        WHERE pc.post_id = p.post_id AND c.is_active), '[]'::json) AS categories,
      EXISTS (SELECT 1 FROM post_vote v WHERE v.post_id = p.post_id AND v.account_id = $2::bigint) AS "isVoted",
      EXISTS (SELECT 1 FROM report r WHERE r.target_type = 'post' AND r.target_id = p.post_id
        AND r.reporter_id = $2::bigint AND r.status = 'pending') AS "hasReported"
    FROM post p JOIN account a ON a.account_id = p.account_id
    WHERE p.post_id = $1::bigint AND p.status IN ('public', 'reported')
  `, [postId, String(account.id)]);
  return post ?? null;
}

// Tùng: detail riêng cho member có view thật và quyền tương tác, không đổi preview guest.
async function findPostForMemberDetail(postId, account) {
  if (account?.role !== 'member' || !account.id) throw Object.assign(new Error('FORBIDDEN'), { code: 'FORBIDDEN' });
  const { rows: [post] } = await pool.query(`
    SELECT p.post_id::text AS id, p.post_type AS type, p.title, p.content,
      p.thumbnail_url AS "thumbnailUrl", p.youtube_url AS "youtubeUrl", p.status,
      p.vote_count AS "voteCount", p.comment_count AS "commentCount", p.view_count AS "viewCount",
      p.created_at AS "createdAt", COALESCE(p.published_at, p.created_at) AS "publishedAt",
      json_build_object('id', a.account_id::text, 'fullName', a.full_name, 'avatarUrl', a.avatar_url) AS author,
      COALESCE((SELECT json_agg(json_build_object('id', c.category_id::text, 'name', c.name) ORDER BY c.name)
        FROM public.post_category pc JOIN public.category c ON c.category_id = pc.category_id
        WHERE pc.post_id = p.post_id AND c.is_active), '[]'::json) AS categories,
      EXISTS (SELECT 1 FROM public.post_vote v WHERE v.post_id = p.post_id AND v.account_id = $2::bigint) AS "isVoted",
      EXISTS (SELECT 1 FROM public.report r WHERE r.target_type = 'post' AND r.target_id = p.post_id
        AND r.reporter_id = $2::bigint AND r.status = 'pending') AS "hasReported"
    FROM public.post p JOIN public.account a ON a.account_id = p.account_id
    WHERE p.post_id = $1::bigint AND p.status IN ('public', 'reported')
  `, [postId, String(account.id)]);
  return post ?? null;
}

// Normalize in JavaScript so both precomposed and decomposed Vietnamese text
// are compared consistently without requiring a database extension.
function normalizeSearch(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd').toLowerCase();
}

// This helper is not routed yet. The caller must also use requireMember.
async function findBestMatch(account, kind, phrase) {
  if (account?.role !== 'member' || !account.id) {
    const error = new Error('FORBIDDEN');
    error.code = 'FORBIDDEN';
    throw error;
  }
  if (!['post', 'recipe'].includes(kind) || typeof phrase !== 'string'
    || !phrase.trim() || Array.from(phrase).length > 10000
    || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(phrase)) {
    const error = new Error('INVALID_INPUT');
    error.code = 'INVALID_INPUT';
    throw error;
  }
  const term = normalizeSearch(phrase.trim());
  if (!term.trim()) {
    const error = new Error('INVALID_INPUT');
    error.code = 'INVALID_INPUT';
    throw error;
  }
  const sql = kind === 'post' ? `
    SELECT p.post_id::text AS id, p.post_type AS type, p.title, p.content,
      p.thumbnail_url AS "thumbnailUrl", COALESCE(p.vote_count, 0)::int AS "voteCount",
      COALESCE(p.comment_count, 0)::int AS "commentCount",
      COALESCE(p.published_at, p.created_at) AS "publishedAt",
      json_build_object('fullName', a.full_name, 'avatarUrl', a.avatar_url) AS author
    FROM public.post p JOIN public.account a ON a.account_id = p.account_id
    WHERE p.status IN ('public', 'reported') ORDER BY "voteCount" DESC
  ` : `
    SELECT r.recipe_id::text AS id, r.title, r.description,
      r.thumbnail_url AS "thumbnailUrl", d.name AS "dishName",
      a.full_name AS "authorName", a.avatar_url AS "authorAvatarUrl",
      (SELECT count(*)::int FROM public.recipe_like l WHERE l.recipe_id = r.recipe_id) AS "likeCount"
    FROM public.recipe r JOIN public.dish d ON d.dish_id = r.dish_id AND d.status = 'active'
    JOIN public.account a ON a.account_id = r.author_id
    WHERE r.status = 'approved' ORDER BY "likeCount" DESC
  `;
  const { rows } = await pool.query(sql);
  let best = null;
  let bestScore = -1;
  let ties = 0;
  for (const row of rows) {
    const score = kind === 'post' ? row.voteCount : row.likeCount;
    if (best && score < bestScore) break;
    const fields = kind === 'post' ? [row.title, row.content] : [row.title, row.dishName];
    if (!fields.some((value) => normalizeSearch(value).includes(term))) continue;
    if (!best) { best = row; bestScore = score; ties = 1; }
    else if (randomInt(++ties) === 0) best = row;
  }
  if (!best) return null;
  if (kind === 'post') {
    const { content, ...item } = best;
    return { kind, item: { ...item, excerpt: Array.from(content ?? '').slice(0, 240).join('') } };
  }
  return { kind, item: best };
}

// Khoi's code (08/11/2026): bài chỉ khớp khi TIÊU ĐỀ hoặc NỘI DUNG chứa đúng cụm chủ đề (bỏ dấu bằng fold);
// xếp hạng: khớp tiêu đề > khớp nội dung > số lượt thích/bình luận > mới hơn.
function buildPhraseFilter(phrases, startIndex = 1) {
  const values = [];
  const titleParts = [];
  const contentParts = [];
  let position = 0;
  for (const phrase of Array.isArray(phrases) ? phrases : [phrases]) {
    const { titleLike } = buildSearch(phrase);
    if (!titleLike) continue;
    const base = startIndex + position * 2;
    position += 1;
    titleParts.push(`${fold('p.title')} LIKE ${fold(`$${base}::text`)}`);
    contentParts.push(`${fold('p.content')} LIKE ${fold(`$${base + 1}::text`)}`);
    values.push(titleLike, titleLike);
  }
  if (!values.length) return { sql: '', rank: '', values };
  return {
    sql: `(${[...titleParts, ...contentParts].join(' OR ')})`,
    rank: `(CASE WHEN (${titleParts.join(' OR ')}) THEN 2 WHEN (${contentParts.join(' OR ')}) THEN 1 ELSE 0 END)`,
    values,
  };
}

// Tùng: tìm ứng viên post cho chat mà không thay các caller tìm kiếm hiện hữu.
// Kết quả chưa xác nhận tính phù hợp với chế độ ăn; caller v3 phải nêu mức chưa chắc.
// Khoi's code (05/11/2026): lọc + xếp hạng + LIMIT 3 trong SQL, bỏ randomInt; nearTerms chỉ là dự phòng.
const CHAT_POST_LIMIT = 3;


async function findChatPosts(account, { subject, seenIds, order, nearTerms }) {
  if (account?.role !== 'member' || !account.id) {
    throw Object.assign(new Error('FORBIDDEN'), { code: 'FORBIDDEN' });
  }
  const validTerm = (value) => typeof value === 'string' && value.trim()
    && Array.from(value).length <= 10000
    && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value);
  if (!validTerm(subject) || !['votes', 'comments'].includes(order)
    || !Array.isArray(seenIds) || !seenIds.every((id) => typeof id === 'string' && /^[1-9]\d{0,17}$/.test(id))
    || !Array.isArray(nearTerms) || nearTerms.length > 8 || !nearTerms.every(validTerm)) {
    throw Object.assign(new Error('INVALID_INPUT'), { code: 'INVALID_INPUT' });
  }
  const field = order === 'comments' ? 'p.comment_count' : 'p.vote_count';
  const run = async ({ sql, rank, values }) => {
    const { rows } = await pool.query(`
      SELECT p.post_id::text AS id, p.post_type AS type, p.title, p.content,
        p.thumbnail_url AS "thumbnailUrl", COALESCE(p.vote_count, 0)::int AS "voteCount",
        COALESCE(p.comment_count, 0)::int AS "commentCount",
        COALESCE(p.published_at, p.created_at) AS "publishedAt",
        json_build_object('fullName', a.full_name, 'avatarUrl', a.avatar_url) AS author
      FROM public.post p JOIN public.account a ON a.account_id = p.account_id
      WHERE p.status IN ('public', 'reported')
        AND NOT (p.post_id::text = ANY($1::text[]))
        AND (${sql})
      ORDER BY ${rank} DESC, COALESCE(${field}, 0) DESC, COALESCE(p.published_at, p.created_at) DESC, p.post_id DESC
      LIMIT ${CHAT_POST_LIMIT}
    `, [seenIds, ...values]);
    return rows;
  };

  const primary = buildPhraseFilter([subject], 2);
  if (!primary.sql) throw Object.assign(new Error('INVALID_INPUT'), { code: 'INVALID_INPUT' });
  let rows = await run(primary);
  let matchKind = 'exact';
  // Khoi's code (08/11/2026): không có bài chứa cụm chủ đề → thử cụm gần nghĩa, vẫn phải chứa ĐÚNG cụm đó.
  if (!rows.length && nearTerms.length) {
    const near = buildPhraseFilter(nearTerms, 2);
    if (near.sql) { rows = await run(near); matchKind = 'near'; }
  }

  const items = rows
    .filter((row) => /^[1-9]\d{0,17}$/.test(row.id) && typeof row.title === 'string' && row.title.trim())
    .map((row) => {
      const { content, ...item } = row;
      return { ...item, excerpt: Array.from(content ?? '').slice(0, 240).join('') };
    });
  if (!items.length) return { kind: 'post', items: [], matchKind };
  // Tùng: thiếu counter của một ứng viên thì không thể xác định thứ hạng.
  const rankField = order === 'comments' ? 'commentCount' : 'voteCount';
  if (items.some((item) => !Number.isInteger(item[rankField]) || item[rankField] < 0)) {
    return { kind: 'post', status: 'rank_unknown' };
  }
  return { kind: 'post', items, matchKind };
}

module.exports = { findPostForModal, findPostForMemberDetail, findBestMatch, findChatPosts,
  buildPhraseFilter };
