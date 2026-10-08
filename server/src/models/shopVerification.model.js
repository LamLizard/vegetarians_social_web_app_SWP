// Tùng — Sprint 2: Admin duyệt hồ sơ riêng; không reject Shop khi reject identity.
const { createShopStorage, SUBMISSION_FIELDS } = require('./shopWorkflow.model');
const { requireActor, parseId, conflict, ShopError, pageResult } = require('../utils/shopWorkflow');
const { parseDecision, parseQueue } = require('../utils/shopVerification');
const { parseIdentity, parseRegistration } = require('../utils/shopRegistration');

function createShopVerificationModel(database) {
  const storage = createShopStorage(database);

  async function list(rawQuery, actor) {
    requireActor(actor, 'admin');
    const query = parseQueue(rawQuery);
    return storage.transaction(async client => {
      const counted = await client.query("SELECT count(*)::int AS total FROM shop_submission WHERE status = 'pending'");
      const total = counted.rows[0].total;
      const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.pageSize)));
      const { rows } = await client.query(`SELECT ${SUBMISSION_FIELDS}, s.name AS "shopName",
        s.verification_status AS "verificationStatus", a.full_name AS "ownerName", a.email AS "ownerEmail"
        FROM shop_submission ss JOIN shop s ON s.shop_id = ss.shop_id
        JOIN account a ON a.account_id = s.owner_account_id WHERE ss.status = 'pending'
        ORDER BY ss.submitted_at ASC, ss.shop_submission_id ASC LIMIT $1 OFFSET $2`,
      [query.pageSize, (page - 1) * query.pageSize]);
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
      return { submission: rows[0], shop: { ...shop, schedule: await storage.schedule(client, shop.shopId) } };
    }, true);
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
        // Các key đã whitelist là name/address/phone; không có lịch/menu/verification.
        await client.query(`UPDATE shop SET ${keys.map((key, index) => `${key} = $${index + 1}`).join(', ')}
          WHERE shop_id = $${values.length + 1}`, [...values, beforeShop.shopId]);
      } else if (!identity) {
        // Accept phải đúng snapshot. Reject không apply form nên vẫn đóng được
        // hồ sơ pending khi dữ liệu đã bị chỉnh ngoài workflow.
        if (decision.action === 'accept') {
          let form;
          try { form = parseRegistration(beforeSubmission.afterValue); }
          catch { conflict('Snapshot đăng ký không hợp lệ. Cần kiểm tra lại hồ sơ.'); }
          const currentSchedule = await storage.schedule(client, beforeShop.shopId);
          if (['name', 'address', 'phone'].some(key => form[key] !== beforeShop[key])
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
      return { shop: { ...afterShop, schedule: await storage.schedule(client, beforeShop.shopId) }, submission };
    });
  }

  return { list, detail, decide };
}

module.exports = { createShopVerificationModel };
