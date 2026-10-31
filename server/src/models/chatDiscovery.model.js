const pool = require('../config/db');
const postModel = require('./post.model');
const { randomInt } = require('node:crypto');

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

// Tùng: tìm ứng viên post cho chat mà không thay các caller tìm kiếm hiện hữu.
// Kết quả chưa xác nhận tính phù hợp với chế độ ăn; caller v3 phải nêu mức chưa chắc.
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

  const exact = normalizeSearch(subject.trim());
  if (!exact.trim()) throw Object.assign(new Error('INVALID_INPUT'), { code: 'INVALID_INPUT' });
  const alternatives = [...new Set(nearTerms.map((term) => normalizeSearch(term.trim())))]
    .filter((term) => term.trim() && term !== exact);
  const excluded = new Set(seenIds);
  const { rows } = await pool.query(`
    SELECT p.post_id::text AS id, p.post_type AS type, p.title, p.content,
      p.thumbnail_url AS "thumbnailUrl", p.vote_count AS "voteCount",
      p.comment_count AS "commentCount", COALESCE(p.published_at, p.created_at) AS "publishedAt",
      json_build_object('fullName', a.full_name, 'avatarUrl', a.avatar_url) AS author
    FROM public.post p JOIN public.account a ON a.account_id = p.account_id
    WHERE p.status IN ('public', 'reported')
  `);
  const eligible = rows.filter((row) => /^[1-9]\d{0,17}$/.test(row.id)
    && typeof row.title === 'string' && row.title.trim() && !excluded.has(row.id));
  const matches = (row, term) => [row.title, row.content].some((value) => normalizeSearch(value).includes(term));
  const exactMatches = eligible.filter((row) => matches(row, exact));
  const candidates = exactMatches.length ? exactMatches
    : eligible.filter((row) => alternatives.some((term) => matches(row, term)));
  const field = order === 'comments' ? 'commentCount' : 'voteCount';
  // Tùng: thiếu counter của một ứng viên thì không thể xác định thứ hạng.
  if (candidates.some((row) => !Number.isInteger(row[field]) || row[field] < 0)) {
    return { kind: 'post', status: 'rank_unknown' };
  }
  let best = null;
  let bestScore = -1;
  let ties = 0;
  for (const row of candidates) {
    const score = row[field];
    if (!best || score > bestScore) { best = row; bestScore = score; ties = 1; }
    else if (score === bestScore && randomInt(++ties) === 0) best = row;
  }
  if (!best) return null;
  const { content, ...item } = best;
  return { kind: 'post', item: { ...item, excerpt: Array.from(content ?? '').slice(0, 240).join(''),
    matchKind: exactMatches.length ? 'exact' : 'near' } };
}

module.exports = { findPostForModal, findPostForMemberDetail, findBestMatch, findChatPosts };
