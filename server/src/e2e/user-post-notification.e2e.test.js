// Fixture giả, chỉ dùng cho test. Không phải tài khoản hay secret thật.
// Duy's Code: Kiểm thử HTTP đầu-cuối cho phiên Member → bài của tôi → Admin duyệt → popup notification.
const assert = require('node:assert/strict');
const { test } = require('node:test');

// Duy's Code: Dùng fixture DB trong bộ nhớ để không ghi/xóa dữ liệu ở database dùng chung.
process.env.JWT_SECRET = 'sprint3-e2e-only-secret';

const pool = require('../config/db');
const originalQuery = pool.query;
const originalConnect = pool.connect;
const stamp = '2026-10-23T03:00:00.000Z';

// Duy's Code: Các bản ghi mô phỏng đúng enum/cột hiện có, không tạo schema mới.
const accounts = new Map([
  ['501', { id: '501', email: 'member@example.test', fullName: 'Member Sprint 3', avatarUrl: null, bio: null, role: 'member', status: 'active' }],
  ['901', { id: '901', email: 'admin@example.test', fullName: 'Admin Sprint 3', avatarUrl: null, bio: null, role: 'admin', status: 'active' }],
]);
const posts = new Map([
  ['801', { id: '801', accountId: '501', postType: 'blog', title: 'Bài chờ duyệt', content: 'Nội dung gốc', thumbnailUrl: null, youtubeUrl: null, status: 'pending', moderationNote: null, moderatedBy: null, moderatedAt: null, publishedAt: null, deletedAt: null, createdAt: stamp, updatedAt: stamp, viewCount: 0, voteCount: 0, commentCount: 0, categories: [{ id: '1', name: 'Món chính' }] }],
  ['802', { id: '802', accountId: '501', postType: 'blog', title: 'Bài công khai', content: 'Có thể xóa mềm', thumbnailUrl: null, youtubeUrl: null, status: 'public', moderationNote: null, moderatedBy: '901', moderatedAt: stamp, publishedAt: stamp, deletedAt: null, createdAt: stamp, updatedAt: stamp, viewCount: 12, voteCount: 3, commentCount: 1, isVoted: true, categories: [{ id: '1', name: 'Món chính' }] }],
  ['803', { id: '803', accountId: '501', postType: 'video', title: 'Bài đang báo cáo', content: 'Đang chờ Admin', thumbnailUrl: null, youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', status: 'reported', moderationNote: null, moderatedBy: null, moderatedAt: null, publishedAt: stamp, deletedAt: null, createdAt: stamp, updatedAt: stamp, viewCount: 4, voteCount: 0, commentCount: 0, categories: [{ id: '1', name: 'Món chính' }] }],
  ['804', { id: '804', accountId: '777', postType: 'blog', title: 'Bài người khác', content: 'Riêng tư', thumbnailUrl: null, youtubeUrl: null, status: 'pending', moderationNote: null, moderatedBy: null, moderatedAt: null, publishedAt: null, deletedAt: null, createdAt: stamp, updatedAt: stamp, viewCount: 0, voteCount: 0, commentCount: 0, categories: [{ id: '1', name: 'Món chính' }] }],
  ['805', { id: '805', accountId: '501', postType: 'blog', title: 'Bài bị từ chối', content: 'Nội dung vẫn còn cho chủ bài', thumbnailUrl: null, youtubeUrl: null, status: 'pending', moderationNote: null, moderatedBy: null, moderatedAt: null, publishedAt: null, deletedAt: null, createdAt: stamp, updatedAt: stamp, viewCount: 0, voteCount: 0, commentCount: 0, categories: [] }],
  ['806', { id: '806', accountId: '501', postType: 'blog', title: 'Bài công khai để sửa', content: 'Nội dung cũ', thumbnailUrl: null, youtubeUrl: null, status: 'public', moderationNote: null, moderatedBy: '901', moderatedAt: stamp, publishedAt: stamp, deletedAt: null, createdAt: stamp, updatedAt: stamp, viewCount: 4, voteCount: 2, commentCount: 1, categories: [{ id: '1', name: 'Món chính' }] }],
  ['807', { id: '807', accountId: '501', postType: 'blog', title: 'Bài đã xóa', content: 'Không sửa', thumbnailUrl: null, youtubeUrl: null, status: 'deleted', moderationNote: null, moderatedBy: null, moderatedAt: null, publishedAt: null, deletedAt: stamp, createdAt: stamp, updatedAt: stamp, viewCount: 0, voteCount: 0, commentCount: 0, categories: [] }],
]);
const notifications = [];
const postModerationActions = new Map();
const comments = [{ id: 'c-1', postId: '802', authorId: '501', content: 'Bình luận fixture', createdAt: stamp }];
const queryLog = [];
let nextNotificationId = 1;
let nextCommentId = 2;
let nextPostId = 900;
let forceEditUpdateMiss = false;

// Duy's Code: FakePg chỉ thực thi các truy vấn do luồng được kiểm thử phát ra.
async function fakeQuery(rawSql, values = []) {
  const sql = String(rawSql).replace(/\s+/g, ' ').trim();
  queryLog.push({ sql, values });
  if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(sql)) return { rows: [], rowCount: 0 };

  if (sql.includes('FROM account a JOIN role r') && sql.includes('WHERE a.account_id = $1')) {
    const account = accounts.get(String(values[0]));
    return { rows: account ? [{ ...account, passwordHash: 'not-used', roleId: account.role === 'admin' ? 2 : 1 }] : [], rowCount: account ? 1 : 0 };
  }
  if (sql.startsWith('SELECT count(*)::int AS total FROM post p WHERE')) {
    const accountId = values[0];
    const statusParam = Number(sql.match(/p\.status = \$(\d+)/)?.[1] || 0);
    const typeParam = Number(sql.match(/p\.post_type = \$(\d+)/)?.[1] || 0);
    const postIdParam = Number(sql.match(/p\.post_id = \$(\d+)/)?.[1] || 0);
    const rows = [...posts.values()].filter((post) => post.accountId === String(accountId)
      && (!statusParam || post.status === values[statusParam - 1])
      && (!typeParam || post.postType === values[typeParam - 1])
      && (!postIdParam || post.id === String(values[postIdParam - 1])));
    return { rows: [{ total: rows.length }], rowCount: 1 };
  }
  if (/^SELECT 1 FROM post p WHERE p\.post_id = \$1 AND p\.status IN/.test(sql)) {
    const post = posts.get(String(values[0]));
    const visible = post && ['public', 'reported'].includes(post.status);
    return { rows: visible ? [{ '?column?': 1 }] : [], rowCount: visible ? 1 : 0 };
  }
  if (sql.includes('FROM comment c JOIN account a')) {
    const list = sql.includes('WHERE c.comment_id = $1')
      ? comments.filter((comment) => comment.id === String(values[0]))
      : comments.filter((comment) => comment.postId === String(values[0]));
    return { rows: list.map((comment) => {
      const author = accounts.get(comment.authorId);
      return { id: comment.id, postId: comment.postId, authorId: comment.authorId, content: comment.content,
        createdAt: comment.createdAt, isOwner: comment.authorId === String(values[1]),
        author: author ? { id: author.id, fullName: author.fullName, avatarUrl: author.avatarUrl } : null };
    }), rowCount: list.length };
  }
  if (sql.startsWith('SELECT keyword FROM banned_keyword')) return { rows: [], rowCount: 0 };
  if (sql.startsWith('INSERT INTO comment')) {
    const [postId, authorId, content] = values;
    const comment = { id: `c-${nextCommentId++}`, postId: String(postId), authorId: String(authorId), content, createdAt: stamp };
    comments.unshift(comment);
    return { rows: [{ comment_id: comment.id }], rowCount: 1 };
  }
  if (sql.startsWith('UPDATE post SET comment_count = comment_count + 1')) {
    const post = posts.get(String(values[0]));
    post.commentCount += 1;
    return { rows: [], rowCount: 1 };
  }
  if (sql.startsWith('DELETE FROM post_vote')) {
    const [postId] = values;
    const post = posts.get(String(postId));
    const hadVote = Boolean(post?.isVoted);
    if (post) post.isVoted = false;
    return { rows: hadVote ? [{ '?column?': 1 }] : [], rowCount: hadVote ? 1 : 0 };
  }
  if (sql.startsWith('INSERT INTO post_vote')) {
    const post = posts.get(String(values[0]));
    if (post) post.isVoted = true;
    return { rows: [], rowCount: 1 };
  }
  if (sql.startsWith('UPDATE post SET vote_count =')) {
    const [postId, amount] = values;
    const post = posts.get(String(postId));
    post.voteCount = Math.max(post.voteCount + amount, 0);
    return { rows: [{ voteCount: post.voteCount }], rowCount: 1 };
  }
  if (sql.includes('FROM post p WHERE p.post_id = $1 AND p.status IN') && sql.endsWith('FOR UPDATE')) {
    const post = posts.get(String(values[0]));
    const visible = post && ['public', 'reported'].includes(post.status);
    return { rows: visible ? [{ post_id: post.id, authorId: post.accountId, status: post.status }] : [], rowCount: visible ? 1 : 0 };
  }
  if (sql.includes('FROM post p WHERE p.account_id = $1 AND p.post_id = $2')) {
    const post = posts.get(String(values[1]));
    const owned = post?.accountId === String(values[0]) ? post : null;
    return { rows: owned ? [postRow(owned)] : [], rowCount: owned ? 1 : 0 };
  }
  if (sql.includes('FROM post p JOIN account a') && sql.includes('ORDER BY p.created_at DESC')) {
    const accountId = values[0];
    const statusParam = Number(sql.match(/p\.status = \$(\d+)/)?.[1] || 0);
    const typeParam = Number(sql.match(/p\.post_type = \$(\d+)/)?.[1] || 0);
    const postIdParam = Number(sql.match(/p\.post_id = \$(\d+)/)?.[1] || 0);
    const limit = values[values.length - 2];
    const offset = values[values.length - 1];
    const matched = [...posts.values()].filter((post) => post.accountId === String(accountId)
      && (!statusParam || post.status === values[statusParam - 1])
      && (!typeParam || post.postType === values[typeParam - 1])
      && (!postIdParam || post.id === String(values[postIdParam - 1])))
      .sort((a, b) => b.id.localeCompare(a.id));
    return { rows: matched.slice(offset, offset + limit).map(myPostRow), rowCount: Math.max(0, Math.min(limit, matched.length - offset)) };
  }
  if (sql.startsWith('SELECT post_id FROM post WHERE post_id = $1 AND account_id = $2 AND status =')) {
    const post = posts.get(String(values[0]));
    return { rows: post?.accountId === String(values[1]) && post.status === 'public' ? [{ post_id: post.id }] : [], rowCount: post?.accountId === String(values[1]) && post.status === 'public' ? 1 : 0 };
  }
  if (sql.startsWith('SELECT 1 FROM post WHERE post_id = $1 AND account_id = $2')) {
    const post = posts.get(String(values[0]));
    return { rows: post?.accountId === String(values[1]) ? [{ '?column?': 1 }] : [], rowCount: 1 };
  }
  if (sql.startsWith('SELECT status FROM post WHERE post_id = $1 AND account_id = $2')) {
    const post = posts.get(String(values[0]));
    return { rows: post?.accountId === String(values[1]) ? [{ status: post.status }] : [], rowCount: 1 };
  }
  if (sql.startsWith('SELECT category_id FROM category WHERE category_id = ANY')) {
    return { rows: values[0].map((id) => ({ category_id: id })), rowCount: values[0].length };
  }
  if (sql.startsWith('INSERT INTO post (account_id, post_type')) {
    const [accountId, postType, title, content, thumbnailUrl, youtubeUrl] = values;
    const id = String(nextPostId++);
    const post = { id, accountId: String(accountId), postType, title, content, thumbnailUrl, youtubeUrl,
      status: 'pending', moderationNote: null, createdAt: stamp, updatedAt: stamp,
      viewCount: 0, voteCount: 0, commentCount: 0, categories: [] };
    posts.set(id, post);
    return { rows: [{ id, status: post.status, createdAt: stamp }], rowCount: 1 };
  }
  if (sql.startsWith('UPDATE post SET post_type =')) {
    const [postType, title, content, thumbnailUrl, youtubeUrl, id, accountId] = values;
    const post = posts.get(String(id));
    if (forceEditUpdateMiss) { forceEditUpdateMiss = false; return { rows: [], rowCount: 0 }; }
    if (!post || post.accountId !== String(accountId) || post.status !== 'public') return { rows: [], rowCount: 0 };
    Object.assign(post, { postType, title, content, thumbnailUrl, youtubeUrl, status: 'pending', moderationNote: null, updatedAt: stamp });
    return { rows: [{ id: post.id, status: post.status, updatedAt: stamp }], rowCount: 1 };
  }
  if (sql.startsWith('DELETE FROM post_category WHERE post_id = $1')) return { rows: [], rowCount: 1 };
  if (sql.startsWith('INSERT INTO post_category')) return { rows: [], rowCount: values[1].length };
  if (sql.startsWith("UPDATE post SET status = 'deleted'")) {
    const [id, accountId] = values;
    const post = posts.get(String(id));
    if (post?.accountId === String(accountId) && ['pending', 'public'].includes(post.status)) {
      Object.assign(post, { status: 'deleted', deletedAt: stamp, updatedAt: stamp });
      return { rows: [{ id: post.id, status: post.status }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }
  if (sql.includes('FROM public.notification') && sql.includes('ORDER BY created_at DESC')) {
    return { rows: notifications.filter((item) => item.accountId === String(values[0])).slice(-30).reverse(), rowCount: notifications.length };
  }
  if (sql.startsWith('SELECT count(*)::int AS count FROM public.notification')) {
    return { rows: [{ count: notifications.filter((item) => item.accountId === String(values[0]) && !item.isRead).length }], rowCount: 1 };
  }
  if (sql.startsWith('UPDATE public.notification SET is_read = true') && sql.includes('RETURNING')) {
    const item = notifications.find((entry) => entry.accountId === String(values[0]) && entry.id === String(values[1]));
    if (item) item.isRead = true;
    return { rows: item ? [{ id: item.id }] : [], rowCount: item ? 1 : 0 };
  }
  if (sql.startsWith('UPDATE public.notification SET is_read = true')) {
    const unread = notifications.filter((entry) => entry.accountId === String(values[0]) && !entry.isRead);
    unread.forEach((entry) => { entry.isRead = true; });
    return { rows: [], rowCount: unread.length };
  }
  if (sql.includes('FROM post p WHERE p.post_id = $1 FOR UPDATE')) {
    const post = posts.get(String(values[0]));
    return { rows: post ? [postRow(post)] : [], rowCount: post ? 1 : 0 };
  }
  if (sql.startsWith('UPDATE post p SET status =')) {
    const [status, note, adminId, id] = values;
    const post = posts.get(String(id));
    if (!post) return { rows: [], rowCount: 0 };
    Object.assign(post, { status, moderationNote: note, moderatedBy: String(adminId), moderatedAt: stamp,
      publishedAt: status === 'public' ? (post.publishedAt || stamp) : post.publishedAt,
      deletedAt: status === 'deleted' ? stamp : post.deletedAt, updatedAt: stamp });
    return { rows: [postRow(post)], rowCount: 1 };
  }
  if (sql.startsWith('INSERT INTO admin_log')) {
    const [, action, targetType, targetId] = values;
    if (targetType === 'post') postModerationActions.set(String(targetId), action);
    return { rows: [], rowCount: 1 };
  }
  if (sql.startsWith('INSERT INTO notification')) {
    const [accountId, type, title, content, refType, refId, rawMetadata] = values;
    const metadata = rawMetadata ? JSON.parse(rawMetadata) : null;
    const item = { id: String(nextNotificationId++), accountId: String(accountId), type, title, content,
      isRead: false, createdAt: stamp, href: metadata?.href ?? null, refType, refId: String(refId) };
    notifications.push(item);
    return { rows: [], rowCount: 1 };
  }
  throw new Error(`Unexpected E2E query: ${sql}`);
}

// Duy's Code: Chỉ trả các field mà model cần cho từng hàng bài viết.
function postRow(post) {
  const author = accounts.get(String(post.accountId));
  return { ...post, author: author ? { id: author.id, fullName: author.fullName, avatarUrl: author.avatarUrl } : null,
    isVoted: Boolean(post.isVoted), moderationAction: postModerationActions.get(String(post.id)) ?? null,
    categories: post.categories ?? [] };
}

// Duy's Code: Fixture chỉ trả field trong SELECT /posts/mine; không làm giả rò field moderation.
function myPostRow(post) {
  const author = accounts.get(String(post.accountId));
  return {
    id: post.id, postType: post.postType, title: post.title, content: post.content,
    thumbnailUrl: post.thumbnailUrl, youtubeUrl: post.youtubeUrl, status: post.status,
    moderationNote: post.moderationNote ?? null, createdAt: post.createdAt, updatedAt: post.updatedAt,
    publishedAt: post.publishedAt ?? null, deletedAt: post.deletedAt ?? null,
    voteCount: post.voteCount, commentCount: post.commentCount, viewCount: post.viewCount,
    author: author ? { id: author.id, fullName: author.fullName, avatarUrl: author.avatarUrl } : null,
    isVoted: Boolean(post.isVoted), moderationAction: postModerationActions.get(String(post.id)) ?? null,
    categories: post.categories ?? [],
  };
}

// Duy's Code: Gắn fake pool trước khi nạp app để HTTP request đi qua Express, auth, route, controller và model thật.
pool.query = fakeQuery;
pool.connect = async () => ({ query: fakeQuery, release() {} });
const { signToken } = require('../utils/jwt');
const app = require('../../app');
const memberToken = signToken({ accountId: '501' });
const adminToken = signToken({ accountId: '901' });

// Duy's Code: Tiến trình HTTP dùng port ngẫu nhiên và luôn đóng sau test.
test('Member manages own posts and receives the Admin decision in the notification popup API', async (t) => {
  const httpServer = app.listen(0);
  t.after(async () => {
    await new Promise((resolve) => httpServer.close(resolve));
    pool.query = originalQuery;
    pool.connect = originalConnect;
  });
  const origin = `http://127.0.0.1:${httpServer.address().port}`;
  const request = async (path, { token, method = 'GET', body } = {}) => {
    const response = await fetch(`${origin}/api${path}`, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };

  // Duy's Code: Kiểm tra quyền phiên và đảm bảo Member chỉ thấy bài có account_id của mình.
  assert.equal((await request('/posts/mine')).status, 401);
  assert.equal((await request('/posts/mine', { token: 'not-a-valid-jwt' })).status, 401);
  const jwt = require('jsonwebtoken');
  const expiredToken = jwt.sign({ accountId: '501', exp: Math.floor(Date.now() / 1000) - 30 }, process.env.JWT_SECRET);
  assert.equal((await request('/posts/mine', { token: expiredToken })).status, 401);
  assert.equal((await request('/posts/mine', { token: adminToken })).status, 403);
  const list = await request('/posts/mine', { token: memberToken });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.items.map((post) => post.id), ['807', '806', '805', '803', '802', '801']);
  assert.equal(list.body.items.some((post) => post.id === '804'), false);
  assert.equal(list.body.items[0].author.fullName, 'Member Sprint 3');
  assert.equal(list.body.items[0].isVoted, false);
  assert.equal(list.body.items.find((post) => post.id === '802').isVoted, true);
  const focusedPost = await request('/posts/mine?postId=802', { token: memberToken });
  assert.deepEqual(focusedPost.body.items.map((post) => post.id), ['802']);
  const foreignPost = await request('/posts/mine?postId=804', { token: memberToken });
  assert.equal(foreignPost.body.totalItems, 0);
  assert.deepEqual(foreignPost.body.items, []);
  for (const row of list.body.items) {
    assert.equal('email' in row, false);
    assert.equal('moderatedBy' in row, false);
    assert.equal('passwordHash' in row, false);
  }
  assert.deepEqual((await request('/posts/mine?status=pending', { token: memberToken })).body.items.map((post) => post.id), ['805', '801']);
  assert.deepEqual((await request('/posts/mine?type=video', { token: memberToken })).body.items.map((post) => post.id), ['803']);
  assert.deepEqual((await request('/posts/mine?status=reported&type=video', { token: memberToken })).body.items.map((post) => post.id), ['803']);
  assert.equal((await request('/posts/mine?status=hidden', { token: memberToken })).status, 400);
  assert.equal((await request('/posts/mine?type=recipe', { token: memberToken })).status, 400);
  assert.equal((await request('/posts/mine?page=0', { token: memberToken })).status, 400);
  assert.equal((await request('/posts/mine?postId=bad', { token: memberToken })).status, 400);

  // Duy's Code: Phân trang qua hơn 20 fixture trong bộ nhớ, không đụng DB thật.
  for (let id = 810; id < 832; id += 1) posts.set(String(id), {
    id: String(id), accountId: '501', postType: 'blog', title: `Fixture ${id}`, content: 'QA pagination',
    thumbnailUrl: null, youtubeUrl: null, status: 'pending', moderationNote: null, createdAt: stamp,
    updatedAt: stamp, viewCount: 0, voteCount: 0, commentCount: 0, categories: [],
  });
  const queryStart = queryLog.length;
  const pageOne = await request('/posts/mine?status=pending&page=1', { token: memberToken });
  const pageTwo = await request('/posts/mine?status=pending&page=2', { token: memberToken });
  assert.equal(pageOne.body.totalItems, 24);
  assert.equal(pageOne.body.items.length, 20);
  assert.equal(pageTwo.body.items.length, 4);
  assert.equal(new Set([...pageOne.body.items, ...pageTwo.body.items].map((post) => post.id)).size, 24);
  const pageQueryCount = queryLog.slice(queryStart).filter(({ sql }) => sql.includes('FROM post p JOIN account a') || sql.startsWith('SELECT count(*)::int AS total FROM post p WHERE')).length;
  assert.equal(pageQueryCount, 4, 'two outer SQL statements per page (count + rows); correlated fields stay within each SELECT');
  for (let id = 810; id < 832; id += 1) posts.delete(String(id));

  // Duy's Code: Chỉ bài public sửa được; UPDATE nguyên tử chuyển status về pending.
  const pendingEditPage = await request('/posts/mine/801', { token: memberToken });
  assert.equal(pendingEditPage.status, 200);
  assert.equal(pendingEditPage.body.post.status, 'pending');
  const update = await request('/posts/mine/806', { token: memberToken, method: 'PUT', body: {
    postType: 'blog', title: 'Bài đã sửa', content: 'Nội dung đã cập nhật', categoryIds: ['1'], status: 'public',
  } });
  assert.equal(update.status, 200);
  assert.equal(posts.get('806').title, 'Bài đã sửa');
  assert.equal(posts.get('806').status, 'pending');
  assert.deepEqual({ voteCount: posts.get('806').voteCount, commentCount: posts.get('806').commentCount, viewCount: posts.get('806').viewCount },
    { voteCount: 2, commentCount: 1, viewCount: 4 });
  for (const id of ['801', '803', '807']) {
    const before = { ...posts.get(id) };
    const blockedUpdate = await request(`/posts/mine/${id}`, { token: memberToken, method: 'PUT', body: {
      postType: 'blog', title: 'Không được sửa', content: 'Không đổi dữ liệu', categoryIds: ['1'],
    } });
    assert.equal(blockedUpdate.status, 409);
    assert.equal(posts.get(id).title, before.title);
    assert.equal(posts.get(id).content, before.content);
    assert.equal(posts.get(id).status, before.status);
  }
  const foreignEdit = await request('/posts/mine/804', { token: memberToken, method: 'PUT', body: {
    postType: 'blog', title: 'Không được sửa', content: 'Không được lộ', categoryIds: ['1'],
  } });
  assert.equal(foreignEdit.status, 404);
  assert.equal(JSON.stringify(foreignEdit.body).includes('Riêng tư'), false);
  const beforeRace = { ...posts.get('802') };
  forceEditUpdateMiss = true;
  const racedEdit = await request('/posts/mine/802', { token: memberToken, method: 'PUT', body: {
    postType: 'blog', title: 'Race', content: 'Không được ghi đè', categoryIds: ['1'],
  } });
  assert.equal(racedEdit.status, 409);
  assert.equal(posts.get('802').title, beforeRace.title);
  assert.equal(posts.get('802').status, beforeRace.status);
  assert.equal(posts.get('802').content, beforeRace.content);

  // Duy's Code: GET/POST comments and vote stay unavailable outside public/reported.
  assert.equal((await request('/posts/801/comments', { token: memberToken })).status, 404);
  assert.equal((await request('/posts/801/vote', { token: memberToken, method: 'POST' })).status, 404);
  assert.equal((await request('/posts/802/comments', { token: memberToken })).body.items[0].content, 'Bình luận fixture');
  const createdComment = await request('/posts/803/comments', { token: memberToken, method: 'POST', body: { content: 'Bình luận trên bài đang bị báo cáo.' } });
  assert.equal(createdComment.status, 201);
  assert.equal(posts.get('803').commentCount, 1);
  assert.equal((await request('/posts/803/vote', { token: memberToken, method: 'POST' })).body.voted, true);
  assert.equal((await request('/posts/803/vote', { token: memberToken, method: 'POST' })).body.voted, false);

  // Duy's Code: Admin duyệt qua route thật, tạo notification có href mà popup đọc được.
  const decision = await request('/admin/moderation/posts/801', { token: adminToken, method: 'PATCH', body: { action: 'approve' } });
  assert.equal(decision.status, 200);
  assert.equal(posts.get('801').status, 'public');
  const inbox = await request('/notifications', { token: memberToken });
  assert.equal(inbox.status, 200);
  assert.equal(inbox.body.unreadCount, 1);
  assert.equal(inbox.body.items[0].type, 'post_approved');
  assert.equal(inbox.body.items[0].href, '/me/posts');
  const read = await request(`/notifications/${inbox.body.items[0].id}/read`, { token: memberToken, method: 'POST' });
  assert.equal(read.status, 200);
  assert.equal((await request('/notifications', { token: memberToken })).body.unreadCount, 0);

  // Duy's Code: Xóa mềm bài công khai thành công; bài đang có report bị chặn để giữ luồng moderation.
  const deleted = await request('/posts/mine/802', { token: memberToken, method: 'DELETE' });
  assert.equal(deleted.status, 200);
  assert.equal(posts.get('802').status, 'deleted');
  const blocked = await request('/posts/mine/803', { token: memberToken, method: 'DELETE' });
  assert.equal(blocked.status, 409);

  // Duy's Code: REJECT được đọc từ admin_log để chủ bài nhận đúng trạng thái và lý do.
  const rejection = await request('/admin/moderation/posts/805', { token: adminToken, method: 'PATCH', body: { action: 'reject', note: 'Thiếu nguồn tham khảo.' } });
  assert.equal(rejection.status, 200);
  const rejectedPost = await request('/posts/mine?postId=805', { token: memberToken });
  assert.equal(rejectedPost.body.items[0].moderationAction, 'REJECT');
  assert.equal(rejectedPost.body.items[0].content, 'Nội dung vẫn còn cho chủ bài');
  assert.equal(rejectedPost.body.items[0].moderationNote, 'Thiếu nguồn tham khảo.');

  // Duy's Code: Hồi quy tạo bài mới — luồng hiện hành vẫn tạo bài pending.
  const created = await request('/posts', { token: memberToken, method: 'POST', body: {
    postType: 'blog', title: 'Bài mới hồi quy', content: 'Nội dung chờ duyệt', categoryIds: ['1'], status: 'public',
  } });
  assert.equal(created.status, 201);
  assert.equal(created.body.post.status, 'pending');
  assert.equal(posts.get(created.body.post.id).status, 'pending');
});
