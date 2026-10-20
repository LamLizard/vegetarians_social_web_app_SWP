// Tùng — Sprint 2: Admin duyệt hồ sơ riêng; không reject Shop khi reject identity.
const { createShopStorage, SHOP_FIELDS, SUBMISSION_FIELDS } = require('./shopWorkflow.model');
const { requireActor, parseId, conflict, ShopError, pageResult } = require('../utils/shopWorkflow');
const { parseDecision, parseQueue, parseShopList, parseHistory, parseStatusUpdate } = require('../utils/shopVerification');
const { parseIdentity, parseRegistration } = require('../utils/shopRegistration');

// Review events come only from immutable submissions; AdminLog contributes status changes only.
const HISTORY_EVENTS = `WITH events AS (
  SELECT 'submission:' || ss.shop_submission_id::text AS "eventId", 'submitted'::text AS "eventType",
    ss.submitted_at AS "occurredAt", a.full_name AS "actorName",
    ss.shop_submission_id::text AS "submissionId", ss.submission_type::text AS "submissionType",
    NULL::text AS note, NULL::text AS "fromStatus", NULL::text AS "toStatus",
    1 AS event_order, ss.shop_submission_id AS source_id
  FROM shop_submission ss LEFT JOIN account a ON a.account_id = ss.submitted_by WHERE ss.shop_id = $1
  UNION ALL
  SELECT 'review:' || ss.shop_submission_id::text, ss.status::text, ss.reviewed_at, a.full_name,
    ss.shop_submission_id::text, ss.submission_type::text, ss.review_note, NULL::text, NULL::text,
    2, ss.shop_submission_id
  FROM shop_submission ss LEFT JOIN account a ON a.account_id = ss.reviewed_by
  WHERE ss.shop_id = $1 AND ss.status IN ('accepted', 'rejected') AND ss.reviewed_at IS NOT NULL
  UNION ALL
  SELECT 'status:' || al.admin_log_id::text,
    CASE al.action WHEN 'SHOP_STATUS_LOCKED' THEN 'locked' ELSE 'unlocked' END,
    al.created_at, a.full_name, NULL::text, NULL::text, al.reason,
    al.before_value->>'status', al.after_value->>'status', 3, al.admin_log_id
  FROM admin_log al LEFT JOIN account a ON a.account_id = al.admin_id
  WHERE al.target_type = 'shop' AND al.target_id = $1
    AND ((al.action = 'SHOP_STATUS_LOCKED' AND al.before_value->>'status' = 'active' AND al.after_value->>'status' = 'inactive')
      OR (al.action = 'SHOP_STATUS_UNLOCKED' AND al.before_value->>'status' = 'inactive' AND al.after_value->>'status' = 'active'))
)`;

function listFilters(query, queue = false) {
  const values = [];
  const predicates = queue ? ["ss.status = 'pending'"] : [];
  function bind(value) { values.push(value); return `$${values.length}`; }
  if (query.operatingStatus) predicates.push(`s.status = ${bind(query.operatingStatus)}`);
  if (query.submissionType) predicates.push(`ss.submission_type = ${bind(query.submissionType)}`);
  if (query.verificationStatus) predicates.push(`s.verification_status = ${bind(query.verificationStatus)}`);
  if (query.q) {
    // Từ khóa được xem là text literal, không cho %/_/backslash trở thành wildcard.
    const escaped = query.q.replace(/[\\%_]/g, character => '\\' + character);
    const parameter = bind(`%${escaped}%`);
    const fields = ['s.name', 's.address', 'a.full_name', 'a.email',
      ...(queue ? ["ss.after_value->>'name'", "ss.after_value->>'address'"] : [])];
    predicates.push(`(${fields.map(field => `${field} ILIKE ${parameter} ESCAPE CHR(92)`).join(' OR ')})`);
  }
  return { values, where: predicates.length ? predicates.join(' AND ') : 'TRUE' };
}

function createShopVerificationModel(database) {
  const storage = createShopStorage(database);

  async function list(rawQuery, actor) {
    requireActor(actor, 'admin');
    const query = parseQueue(rawQuery);
    const filters = listFilters(query, true);
    const source = `FROM shop_submission ss JOIN shop s ON s.shop_id = ss.shop_id
      JOIN account a ON a.account_id = s.owner_account_id WHERE ${filters.where}`;
    return storage.transaction(async client => {
      const counted = await client.query(`SELECT count(*)::int AS total ${source}`, filters.values);
      const total = counted.rows[0].total;
      const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.pageSize)));
      const { rows } = await client.query(`SELECT ${SUBMISSION_FIELDS}, s.name AS "shopName",
        s.status AS "shopStatus", s.verification_status AS "verificationStatus",
        a.full_name AS "ownerName", a.email AS "ownerEmail"
        ${source} ORDER BY ss.submitted_at DESC, ss.shop_submission_id DESC
        LIMIT $${filters.values.length + 1} OFFSET $${filters.values.length + 2}`,
      [...filters.values, query.pageSize, (page - 1) * query.pageSize]);
      return pageResult(rows, total, page, query.pageSize);
    }, true);
  }

  async function detail(rawId, actor) {
    requireActor(actor, 'admin');
    const id = parseId(rawId, 'submissionId');
    return storage.transaction(async client => {
      const { rows } = await client.query(`SELECT ${SUBMISSION_FIELDS}, a.full_name AS "ownerName", a.email AS "ownerEmail"
        FROM shop_submission ss JOIN shop s ON s.shop_id = ss.shop_id
        JOIN account a ON a.account_id = s.owner_account_id WHERE ss.shop_submission_id = $1`, [id]);
      if (!rows[0]) throw new ShopError(404, 'SHOP_SUBMISSION_NOT_FOUND', 'Không tìm thấy hồ sơ.');
      const shop = await storage.getShop(client, rows[0].shopId);
      return { submission: rows[0], shop: { ...shop, ...await storage.readableSchedule(client, shop.shopId) },
        operatingDecision: await storage.operatingDecision(client, shop.shopId) };
    }, true);
  }

  async function adminView(client, shop) {
    const owner = await client.query('SELECT full_name AS "ownerName", email AS "ownerEmail" FROM account WHERE account_id = $1',
      [shop.ownerAccountId]);
    return storage.view(client, { ...shop, ...owner.rows[0] });
  }

  async function listShops(rawQuery, actor) {
    requireActor(actor, 'admin');
    const query = parseShopList(rawQuery);
    const filters = listFilters(query);
    const source = `FROM shop s JOIN account a ON a.account_id = s.owner_account_id
      LEFT JOIN shop_submission ss ON ss.shop_id = s.shop_id AND ss.status = 'pending'
      WHERE ${filters.where}`;
    return storage.transaction(async client => {
      const counted = await client.query(`SELECT count(*)::int AS total ${source}`, filters.values);
      const total = counted.rows[0].total;
      const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.pageSize)));
      const { rows } = await client.query(`SELECT ${SHOP_FIELDS},
        a.full_name AS "ownerName", a.email AS "ownerEmail", ss.shop_submission_id::text AS "pendingSubmissionId"
        ${source} ORDER BY s.created_at DESC, s.shop_id DESC
        LIMIT $${filters.values.length + 1} OFFSET $${filters.values.length + 2}`,
      [...filters.values, query.pageSize, (page - 1) * query.pageSize]);
      return pageResult(rows, total, page, query.pageSize);
    }, true);
  }

  async function shopDetail(rawId, actor) {
    requireActor(actor, 'admin');
    const id = parseId(rawId, 'shopId');
    return storage.transaction(async client => adminView(client, await storage.getShop(client, id)), true);
  }

  async function history(rawId, rawQuery, actor) {
    requireActor(actor, 'admin');
    const id = parseId(rawId, 'shopId');
    const query = parseHistory(rawQuery);
    return storage.transaction(async client => {
      await storage.getShop(client, id);
      const counted = await client.query(`${HISTORY_EVENTS} SELECT count(*)::int AS total FROM events`, [id]);
      const total = counted.rows[0].total;
      const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.pageSize)));
      const { rows } = await client.query(`${HISTORY_EVENTS}
        SELECT "eventId", "eventType", "occurredAt", "actorName", "submissionId", "submissionType", note,
          "fromStatus", "toStatus" FROM events
        ORDER BY "occurredAt" DESC, event_order DESC, source_id DESC LIMIT $2 OFFSET $3`,
      [id, query.pageSize, (page - 1) * query.pageSize]);
      return pageResult(rows, total, page, query.pageSize);
    }, true);
  }

  async function updateStatus(rawId, raw, actor) {
    requireActor(actor, 'admin');
    const id = parseId(rawId, 'shopId');
    const update = parseStatusUpdate(raw);
    return storage.transaction(async client => {
      const beforeShop = await storage.getShop(client, id, true);
      storage.checkVersion(beforeShop.version, update.expectedVersion);
      if (beforeShop.status === update.status) return { ...await adminView(client, beforeShop), unchanged: true };
      const updated = await client.query(`UPDATE shop SET status = $1::shop_status_enum
        WHERE shop_id = $2 AND row_version = $3 RETURNING shop_id::text AS "shopId"`,
      [update.status, id, update.expectedVersion]);
      if (!updated.rows[0]) conflict();
      const afterShop = await storage.getShop(client, id);
      await client.query(`INSERT INTO admin_log (admin_id, action, target_type, target_id,
        before_value, after_value, reason, ip_address) VALUES ($1, $2, 'shop', $3, $4::jsonb, $5::jsonb, $6, $7)`,
      [actor.id, update.status === 'inactive' ? 'SHOP_STATUS_LOCKED' : 'SHOP_STATUS_UNLOCKED', id,
        JSON.stringify({ status: beforeShop.status, version: beforeShop.version }),
        JSON.stringify({ status: afterShop.status, version: afterShop.version }), update.reason, actor.ip || null]);
      return adminView(client, afterShop);
    });
  }

  async function decide(rawId, rawDecision, actor) {
    requireActor(actor, 'admin');
    const id = parseId(rawId, 'submissionId');
    const decision = parseDecision(rawDecision);
    if (decision.expectedSubmissionId !== id) conflict('Mã hồ sơ đang xem không khớp quyết định.');
    return storage.transaction(async client => {
      const located = await client.query('SELECT shop_id::text AS "shopId" FROM shop_submission WHERE shop_submission_id = $1', [id]);
      if (!located.rows[0]) throw new ShopError(404, 'SHOP_SUBMISSION_NOT_FOUND', 'Không tìm thấy hồ sơ.');
      // Mọi writer cùng thứ tự Shop -> hồ sơ; Admin tới sau nhận pending=false.
      const beforeShop = await storage.getShop(client, located.rows[0].shopId, true);
      const locked = await client.query(`SELECT ${SUBMISSION_FIELDS} FROM shop_submission ss
        WHERE ss.shop_submission_id = $1 AND ss.shop_id = $2 FOR UPDATE`, [id, beforeShop.shopId]);
      const beforeSubmission = locked.rows[0];
      if (!beforeSubmission || beforeSubmission.status !== 'pending') conflict('Hồ sơ đã được xử lý. Vui lòng tải lại.');
      const type = beforeSubmission.submissionType;
      const identity = type === 'identity_edit';
      if (!['registration', 'resubmission', 'identity_edit'].includes(type)
        || beforeShop.verificationStatus !== (identity ? 'verified' : 'pending')) conflict('Hồ sơ không phù hợp trạng thái quán hiện tại.');

      if (identity && decision.action === 'accept') {
        let patch;
        try { patch = parseIdentity(beforeSubmission.afterValue); }
        catch { conflict('Dữ liệu hồ sơ sửa không hợp lệ. Cần kiểm tra lại hồ sơ.'); }
        const keys = Object.keys(patch);
        if (!beforeSubmission.beforeValue || keys.length !== Object.keys(beforeSubmission.beforeValue).length
          || keys.some(key => !Object.hasOwn(beforeSubmission.beforeValue, key)
            || beforeShop[key] !== beforeSubmission.beforeValue[key] || patch[key] === beforeShop[key])) conflict();
        const values = keys.map(key => patch[key]);
        const columns = { name: 'name', address: 'address', phone: 'phone', avtShopUrl: 'avt_shop_url' };
        // Chỉ áp dụng các field identity đã đổi, không có lịch/menu/verification.
        await client.query(`UPDATE shop SET ${keys.map((key, index) => `${columns[key]} = $${index + 1}`).join(', ')}
          WHERE shop_id = $${values.length + 1}`, [...values, beforeShop.shopId]);
      } else if (!identity) {
        // Accept phải đúng snapshot. Reject không apply form nên vẫn đóng được
        // hồ sơ pending khi dữ liệu đã bị chỉnh ngoài workflow.
        if (decision.action === 'accept') {
          let form;
          try { form = parseRegistration(beforeSubmission.afterValue); }
          catch { conflict('Snapshot đăng ký không hợp lệ. Cần kiểm tra lại hồ sơ.'); }
          const currentSchedule = await storage.schedule(client, beforeShop.shopId);
          if (['name', 'address', 'phone', 'avtShopUrl'].some(key => form[key] !== beforeShop[key])
            || JSON.stringify(form.schedule) !== JSON.stringify(currentSchedule)) conflict();
        }
        await client.query(`UPDATE shop SET verification_status = $1::shop_verification_status_enum,
          verification_note = $2, verified_by = $3, verified_at = now() WHERE shop_id = $4`,
        [decision.action === 'accept' ? 'verified' : 'rejected', decision.reason, actor.id, beforeShop.shopId]);
      }

      const status = decision.action === 'accept' ? 'accepted' : 'rejected';
      const updated = await client.query(`UPDATE shop_submission ss SET status = $1,
        reviewed_by = $2, reviewed_at = now(), review_note = $3
        WHERE ss.shop_submission_id = $4 AND ss.status = 'pending' RETURNING ${SUBMISSION_FIELDS}`,
      [status, actor.id, decision.reason, id]);
      if (!updated.rows[0]) conflict();
      const afterShop = await storage.getShop(client, beforeShop.shopId);
      const submission = updated.rows[0];
      await client.query(`INSERT INTO admin_log (admin_id, action, target_type, target_id,
        before_value, after_value, reason, ip_address) VALUES ($1, $2, 'shop', $3, $4::jsonb, $5::jsonb, $6, $7)`,
      [actor.id, `SHOP_${type.toUpperCase()}_${status.toUpperCase()}`, beforeShop.shopId,
        JSON.stringify({ shop: beforeShop, submission: beforeSubmission }),
        JSON.stringify({ shop: afterShop, submission }), decision.reason, actor.ip || null]);
      await client.query(`INSERT INTO notification (account_id, type, title, content, ref_type, ref_id, metadata)
        VALUES ($1, $2::notification_type_enum, $3, $4, 'shop', $5, $6::jsonb)`,
      [beforeShop.ownerAccountId, identity ? `shop_identity_edit_${status}`
        : decision.action === 'accept' ? 'shop_verified' : 'shop_rejected',
        identity ? `Yêu cầu sửa quán ${status === 'accepted' ? 'được duyệt' : 'bị từ chối'}`
          : status === 'accepted' ? 'Quán đã được xác minh' : 'Đăng ký quán bị từ chối',
        decision.reason || (identity ? 'Thông tin đề xuất đã được áp dụng. Quán vẫn được xác minh.' : 'Hồ sơ quán đã được duyệt.'),
        beforeShop.shopId, JSON.stringify({ submissionId: id, submissionType: type })]);
      return { shop: { ...afterShop, ...await storage.readableSchedule(client, beforeShop.shopId) }, submission,
        operatingDecision: await storage.operatingDecision(client, beforeShop.shopId) };
    });
  }

  return { list, detail, decide, listShops, shopDetail, history, updateStatus };
}

module.exports = { createShopVerificationModel };
