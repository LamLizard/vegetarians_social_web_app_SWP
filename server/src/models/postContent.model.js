// Tùng: writer/reader riêng cho Moderation; không đổi model post/Admin của thành viên khác.
const { createHash } = require('node:crypto');
const pool = require('../config/db');
const { PostError } = require('./post.model');

const COLUMN_CONTRACT = [
  ['post', 'client_request_id', 'uuid'], ['post', 'request_fingerprint', 'character(64)'],
  ['post', 'creation_moderation', 'jsonb'], ['comment', 'client_request_id', 'uuid'],
  ['comment', 'request_fingerprint', 'character(64)'], ['comment', 'creation_moderation', 'jsonb'],
  ['comment', 'moderation_note', 'character varying(255)'],
];
const BASE_COLUMNS = {
  post: ['post_id','account_id','post_type','title','content','thumbnail_url','youtube_url','status',
    'moderation_note','moderated_by','moderated_at','published_at','deleted_at','created_at','comment_count'],
  comment: ['comment_id','post_id','author_id','content','status','created_at'],
  banned_keyword: ['keyword_id','keyword','normalized_keyword','category'],
  account: ['account_id','full_name','avatar_url'], category: ['category_id','is_active'],
  post_category: ['post_id','category_id'], notification: ['account_id','type','title','content','ref_type','ref_id'],
};
const INDEX_CONTRACT = [
  { name: 'uq_post_content_request', table: 'post', columns: ['account_id', 'client_request_id'],
    options: '0 0', unique: true, predicate: 'client_request_idisnotnull' },
  { name: 'uq_comment_content_request', table: 'comment', columns: ['author_id', 'client_request_id'],
    options: '0 0', unique: true, predicate: 'client_request_idisnotnull' },
  { name: 'idx_comment_own_rejection', table: 'comment', columns: ['post_id', 'author_id', 'created_at', 'comment_id'],
    options: '0 0 3 3', unique: false, predicate: "status='hidden'andcreation_moderation->>'outcome'='rejected'" },
];
const ANIMAL_WARNING = { code: 'animal', message: 'Nội dung có nhắc đến món từ động vật.' };

function failure(status, code, message) {
  return Object.assign(new PostError(status, message), { code });
}
function schemaNotReady() {
  return failure(503, 'SCHEMA_NOT_READY', 'Cấu trúc dữ liệu kiểm duyệt chưa sẵn sàng. Vui lòng liên hệ quản trị viên.');
}

/** Chỉ kiểm tra catalog; không tự DDL và không coi lỗi DB là provider unavailable. */
async function ensureSchema(db) {
  const { rows: columns } = await db.query(`
    SELECT c.relname AS table_name, a.attname AS column_name,
      format_type(a.atttypid, a.atttypmod) AS sql_type, a.attnotnull,
      a.atthasdef, a.attgenerated, a.attidentity, t.typcategory, t.typname,
      ARRAY(SELECT enumlabel::text FROM pg_enum WHERE enumtypid = t.oid) AS labels
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_type t ON t.oid = a.atttypid
    WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
      AND a.attnum > 0 AND NOT a.attisdropped
  `, [Object.keys(BASE_COLUMNS)]);
  for (const [table, names] of Object.entries(BASE_COLUMNS)) {
    if (names.some((name) => !columns.some((column) => column.table_name === table && column.column_name === name))) {
      throw schemaNotReady();
    }
  }
  for (const [table, name, type, labels] of [
    ['post','status','post_status_enum',['public','reported','pending','deleted']],
    ['comment','status','comment_status_enum',['public','hidden','deleted']],
    ['notification','type','notification_type_enum',['post_approved','post_rejected']],
    ['notification','ref_type','notification_ref_type_enum',['post']],
  ]) {
    const column = columns.find((item) => item.table_name === table && item.column_name === name);
    if (column.typname !== type || !labels.every((label) => column.labels.includes(label))) throw schemaNotReady();
  }
  for (const [table, name, type] of COLUMN_CONTRACT) {
    const column = columns.find((c) => c.table_name === table && c.column_name === name);
    if (!column || column.sql_type !== type || column.attnotnull || column.atthasdef
        || column.attgenerated || column.attidentity) throw schemaNotReady();
  }
  const category = columns.find((c) => c.table_name === 'banned_keyword' && c.column_name === 'category');
  if (!category || !['S', 'E'].includes(category.typcategory)
      || (category.typcategory === 'E' && !['spam', 'animal'].every((label) => category.labels.includes(label)))) {
    throw schemaNotReady();
  }
  const { rows: indexes } = await db.query(`
    SELECT c.relname AS name, tbl.relname AS table_name, i.indisunique AS is_unique,
      i.indisvalid, i.indisready, i.indnatts, i.indoption::text AS options, am.amname,
      ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY AS k(num, ord)
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.num ORDER BY k.ord) AS columns,
      pg_get_expr(i.indpred, i.indrelid) AS predicate
    FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_class tbl ON tbl.oid = i.indrelid
    JOIN pg_am am ON am.oid = c.relam
    WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
  `, [INDEX_CONTRACT.map((index) => index.name)]);
  for (const expected of INDEX_CONTRACT) {
    const index = indexes.find((item) => item.name === expected.name);
    const predicate = index?.predicate?.toLowerCase()
      .replace(/::(?:public\.)?(?:text|comment_status_enum)/g, '').replace(/[\s()]/g, '');
    if (!index || index.table_name !== expected.table || index.amname !== 'btree'
        || !index.indisvalid || !index.indisready || index.is_unique !== expected.unique
        || index.indnatts !== expected.columns.length || index.options !== expected.options
        || JSON.stringify(index.columns) !== JSON.stringify(expected.columns) || predicate !== expected.predicate) {
      throw schemaNotReady();
    }
  }
}

async function transaction(work) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const result = await work(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    try { await db.query('ROLLBACK'); } catch { /* preserve the original error */ }
    throw error;
  } finally {
    db.release();
  }
}

async function validateCategories(db, input, lock = false) {
  const { rows } = await db.query(`SELECT category_id FROM public.category
    WHERE category_id = ANY($1::bigint[]) AND is_active ${lock ? 'FOR SHARE' : ''}`, [input.categoryIds]);
  if (rows.length !== input.categoryIds.length) {
    throw failure(400, 'INVALID_CATEGORY', 'Có tag không tồn tại hoặc đã bị tắt, vui lòng chọn lại.');
  }
}

async function visibleParent(db, postId, lock = '') {
  const { rows } = await db.query(`SELECT post_id, comment_count AS "publicCommentCount"
    FROM public.post WHERE post_id = $1 AND status IN ('public','reported') ${lock}`, [postId]);
  if (!rows[0]) throw failure(404, 'POST_NOT_VISIBLE', 'Bài viết không tồn tại hoặc đã bị gỡ.');
  return rows[0];
}

async function precheck({ kind, input }) {
  await ensureSchema(pool);
  if (kind === 'post') await validateCategories(pool, input);
  else if (kind === 'comment') await visibleParent(pool, input.postId);
  else throw new TypeError('Unknown submission kind.');
}

async function lockSubmission(db, kind, actorId, requestId) {
  if (!requestId) return;
  const hash = createHash('sha256').update(`${kind}|${actorId}|${requestId}`).digest();
  await db.query('SELECT pg_advisory_xact_lock($1::integer, $2::integer)', [hash.readInt32BE(0), hash.readInt32BE(4)]);
}

async function lookup(db, kind, actorId, requestId, fingerprint) {
  if (!requestId) return null;
  const table = kind === 'post' ? 'post' : 'comment';
  const author = kind === 'post' ? 'account_id' : 'author_id';
  // Table/author come only from the two internal branches, never client strings.
  const { rows } = await db.query(`SELECT ${table}_id::text AS id,
    request_fingerprint AS fingerprint FROM public.${table}
    WHERE ${author} = $1 AND client_request_id = $2::uuid FOR UPDATE`, [actorId, requestId]);
  if (!rows[0]) return null;
  if (rows[0].fingerprint !== fingerprint) {
    throw failure(409, 'REQUEST_ID_REUSED', 'Mã gửi đã được dùng cho nội dung khác. Vui lòng gửi bản nháp mới.');
  }
  return rows[0].id;
}

const warningsFor = (receipt) => Array.isArray(receipt?.warnings) && receipt.warnings.includes('animal')
  ? [{ ...ANIMAL_WARNING }] : [];

async function postResult(db, id, actorId, replayed) {
  const { rows: [row] } = await db.query(`SELECT post_id::text AS id, status,
    created_at AS "createdAt", published_at AS "publishedAt", moderation_note AS "moderationNote",
    creation_moderation AS receipt FROM public.post WHERE post_id = $1 AND account_id = $2 FOR UPDATE`, [id, actorId]);
  if (!row) throw failure(404, 'SUBMISSION_NOT_FOUND', 'Không tìm thấy bài viết đã gửi.');
  const outcome = ['public', 'reported'].includes(row.status) ? 'approved'
    : row.status === 'pending' ? 'manual_pending' : 'rejected';
  const messages = { approved: 'Bài viết đã được duyệt và công khai.',
    manual_pending: 'Bài viết đã được gửi và đang chờ Admin duyệt.', rejected: 'Bài viết đã bị từ chối.' };
  return {
    message: messages[outcome],
    post: { id: row.id, status: row.status, createdAt: row.createdAt,
      publishedAt: row.publishedAt, moderationNote: row.moderationNote },
    outcome, warnings: warningsFor(row.receipt), replayed,
  };
}

const COMMENT_FIELDS = `c.comment_id::text AS id, c.author_id::text AS "authorId",
  c.content, c.status, c.created_at AS "createdAt", c.moderation_note AS "moderationNote",
  c.creation_moderation AS receipt,
  json_build_object('id',a.account_id::text,'fullName',a.full_name,'avatarUrl',a.avatar_url) AS author`;

function commentDto(row, viewerId) {
  const isOwner = viewerId != null && row.authorId === String(viewerId);
  const displayable = row.status === 'public';
  const outcome = row.status === 'public'
    ? (isOwner && row.receipt?.outcome === 'accepted_unfiltered' ? 'accepted_unfiltered' : 'accepted')
    : 'not_visible';
  const result = { id: row.id, status: row.status, isOwner, displayable,
    moderation: { outcome, reason: null,
      warnings: isOwner && displayable ? warningsFor(row.receipt) : [] } };
  if (displayable) Object.assign(result, { content: row.content, createdAt: row.createdAt, author: row.author });
  return result;
}

async function commentResult(db, id, actorId, parent, replayed) {
  const { rows: [row] } = await db.query(`SELECT ${COMMENT_FIELDS}
    FROM public.comment c JOIN public.account a ON a.account_id = c.author_id
    WHERE c.comment_id = $1 AND c.author_id = $2 FOR UPDATE OF c`, [id, actorId]);
  if (!row) throw failure(404, 'SUBMISSION_NOT_FOUND', 'Không tìm thấy bình luận đã gửi.');
  return { ...commentDto(row, actorId), publicCommentCount: parent.publicCommentCount, replayed };
}

async function findSubmission({ kind, actorId, requestId, fingerprint, input }) {
  if (!requestId) return null;
  return transaction(async (db) => {
    await ensureSchema(db);
    const parent = kind === 'comment' ? await visibleParent(db, input.postId, 'FOR UPDATE') : null;
    const id = await lookup(db, kind, actorId, requestId, fingerprint);
    if (!id) return null;
    return kind === 'post' ? postResult(db, id, actorId, true) : commentResult(db, id, actorId, parent, true);
  });
}

async function createModeratedPost({ actorId, requestId, fingerprint, input, result }) {
  return transaction(async (db) => {
    await ensureSchema(db);
    await lockSubmission(db, 'post', actorId, requestId);
    const existing = await lookup(db, 'post', actorId, requestId, fingerprint);
    if (existing) return postResult(db, existing, actorId, true);
    await validateCategories(db, input, true);
    const status = result.decision === 'approve' ? 'public' : result.decision === 'reject' ? 'deleted' : 'pending';
    const { rows } = await db.query(`INSERT INTO public.post
      (account_id,post_type,title,content,thumbnail_url,youtube_url,status,moderation_note,
       moderated_by,moderated_at,published_at,deleted_at,client_request_id,request_fingerprint,creation_moderation)
      VALUES ($1,$2,$3,$4,$5,$6,$7::post_status_enum,$8,NULL,
        CASE WHEN $7::text <> 'pending' THEN now() END,
        CASE WHEN $7::text = 'public' THEN now() END,
        CASE WHEN $7::text = 'deleted' THEN now() END,$9::uuid,$10,$11::jsonb)
      ON CONFLICT (account_id,client_request_id) WHERE client_request_id IS NOT NULL DO NOTHING
      RETURNING post_id::text AS id`, [actorId, input.postType, input.title, input.content,
      input.thumbnailUrl, input.youtubeUrl, status, result.reason, requestId, fingerprint, JSON.stringify(result.receipt)]);
    if (!rows[0]) {
      const id = await lookup(db, 'post', actorId, requestId, fingerprint);
      if (!id) throw new Error('Submission conflict without receipt.');
      return postResult(db, id, actorId, true);
    }
    const id = rows[0].id;
    await db.query('INSERT INTO public.post_category (post_id,category_id) SELECT $1,unnest($2::bigint[])', [id, input.categoryIds]);
    if (status !== 'pending') {
      await db.query(`INSERT INTO public.notification (account_id,type,title,content,ref_type,ref_id)
        VALUES ($1,$2::notification_type_enum,$3,$4,'post',$5)`, [actorId,
        status === 'public' ? 'post_approved' : 'post_rejected',
        status === 'public' ? 'Bài viết đã được duyệt' : 'Bài viết bị từ chối',
        result.reason || `Bài “${input.title}” đã được công khai.`, id]);
    }
    return postResult(db, id, actorId, false);
  });
}

async function createModeratedComment({ actorId, requestId, fingerprint, input, result }) {
  return transaction(async (db) => {
    await ensureSchema(db);
    await lockSubmission(db, 'comment', actorId, requestId);
    const parent = await visibleParent(db, input.postId, 'FOR UPDATE');
    const existing = await lookup(db, 'comment', actorId, requestId, fingerprint);
    if (existing) return commentResult(db, existing, actorId, parent, true);
    const status = result.decision === 'reject' ? 'hidden' : 'public';
    const { rows } = await db.query(`INSERT INTO public.comment
      (post_id,author_id,content,status,moderation_note,client_request_id,request_fingerprint,creation_moderation)
      VALUES ($1,$2,$3,$4::comment_status_enum,$5,$6::uuid,$7,$8::jsonb)
      ON CONFLICT (author_id,client_request_id) WHERE client_request_id IS NOT NULL DO NOTHING
      RETURNING comment_id::text AS id`, [input.postId, actorId, input.content, status, result.reason,
      requestId, fingerprint, JSON.stringify(result.receipt)]);
    if (!rows[0]) {
      const id = await lookup(db, 'comment', actorId, requestId, fingerprint);
      if (!id) throw new Error('Submission conflict without receipt.');
      return commentResult(db, id, actorId, parent, true);
    }
    if (status === 'public') {
      const updated = await db.query(`UPDATE public.post SET comment_count = comment_count + 1
        WHERE post_id = $1 RETURNING comment_count AS "publicCommentCount"`, [input.postId]);
      parent.publicCommentCount = updated.rows[0].publicCommentCount;
    }
    return commentResult(db, rows[0].id, actorId, parent, false);
  });
}

async function findVisibleComments(postId, viewerId) {
  return transaction(async (db) => {
    await ensureSchema(db);
    const parent = await visibleParent(db, postId, 'FOR SHARE');
    const { rows } = await db.query(`SELECT ${COMMENT_FIELDS}
      FROM public.comment c JOIN public.account a ON a.account_id = c.author_id
      WHERE c.post_id = $1 AND c.status = 'public'
      ORDER BY c.created_at DESC,c.comment_id DESC LIMIT 200`, [postId]);
    return { items: rows.map((row) => commentDto(row, viewerId)), publicCommentCount: parent.publicCommentCount };
  });
}

module.exports = { precheck, findSubmission, createModeratedPost, createModeratedComment, findVisibleComments };
