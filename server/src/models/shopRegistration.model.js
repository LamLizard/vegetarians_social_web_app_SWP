// Tùng — Sprint 2: đăng ký/nộp lại giữ cùng Shop, lịch sử và menu; lưu atomically.
const { createShopStorage } = require('./shopWorkflow.model');
const { requireActor, parseId, conflict, ShopError } = require('../utils/shopWorkflow');
const { parseRegistration } = require('../utils/shopRegistration');
const { createShopImageUpload } = require('../utils/shopImageUpload');

// Join metadata bằng text với ID thật, không cast metadata không tin cậy sang bigint.
const REVIEW_NOTIFICATION_MATCH = `n.account_id = $1 AND s.owner_account_id = $1 AND ss.submitted_by = $1
  AND n.ref_type = 'shop' AND n.ref_id = ss.shop_id
  AND n.metadata->>'submissionId' = ss.shop_submission_id::text
  AND n.metadata->>'submissionType' = ss.submission_type::text
  AND ss.submission_type IN ('registration', 'resubmission', 'identity_edit') AND ss.reviewed_at IS NOT NULL
  AND ((ss.status = 'accepted' AND ((ss.submission_type = 'identity_edit' AND n.type = 'shop_identity_edit_accepted')
      OR (ss.submission_type <> 'identity_edit' AND n.type = 'shop_verified')))
    OR (ss.status = 'rejected' AND ((ss.submission_type = 'identity_edit' AND n.type = 'shop_identity_edit_rejected')
      OR (ss.submission_type <> 'identity_edit' AND n.type = 'shop_rejected'))))`;

function createShopRegistrationModel(database, dependencies = {}) {
  const storage = createShopStorage(database);
  const imageUpload = createShopImageUpload();
  const verifyImageUpload = dependencies.verifyImageUpload || imageUpload.verifyImageUpload;
  const signImageUpload = dependencies.prepareImageUpload || imageUpload.prepareImageUpload;

  async function getContext(actor) {
    const accountId = requireActor(actor, 'member');
    return storage.transaction(async client => {
      const shop = await storage.ownedShop(client, actor, { allowMissing: true });
      const context = await storage.view(client, shop);
      let reviewNotification = null;
      const latest = context.latestSubmission;
      if (shop && !context.pendingSubmission && latest && ['accepted', 'rejected'].includes(latest.status)
        && ['registration', 'resubmission', 'identity_edit'].includes(latest.submissionType)) {
        const notices = await client.query(`SELECT n.notification_id::text AS "notificationId",
          ss.shop_submission_id::text AS "submissionId", ss.submission_type AS "submissionType",
          ss.status, ss.review_note AS "reviewNote", ss.reviewed_at AS "reviewedAt",
          NULLIF(n.metadata->>'popupSeenAt', '') AS "popupSeenAt"
          FROM notification n JOIN shop_submission ss ON ss.shop_id = n.ref_id
          JOIN shop s ON s.shop_id = ss.shop_id WHERE ${REVIEW_NOTIFICATION_MATCH}
          AND ss.shop_submission_id = $2
          AND (ss.submission_type = 'identity_edit' OR ss.status = 'rejected' OR NOT EXISTS (
            SELECT 1 FROM shop_submission earlier WHERE earlier.shop_id = ss.shop_id
              AND earlier.submission_type IN ('registration', 'resubmission') AND earlier.status = 'accepted'
              AND (earlier.submitted_at, earlier.shop_submission_id) < (ss.submitted_at, ss.shop_submission_id)))
          ORDER BY n.created_at DESC, n.notification_id DESC LIMIT 1`, [accountId, latest.submissionId]);
        reviewNotification = notices.rows[0] || null;
      }
      return { ...context, reviewNotification, canRegister: !shop,
        canResubmit: shop?.status === 'active' && shop.verificationStatus === 'rejected' };
    }, true);
  }

  async function markReviewNotificationSeen(rawId, actor) {
    const accountId = requireActor(actor, 'member');
    const id = parseId(rawId, 'notificationId');
    return storage.transaction(async client => {
      const result = await client.query(`UPDATE notification n SET metadata =
        CASE WHEN NULLIF(n.metadata->>'popupSeenAt', '') IS NOT NULL THEN n.metadata
          ELSE jsonb_set(COALESCE(n.metadata, '{}'::jsonb), '{popupSeenAt}', to_jsonb(now()), true) END
        FROM shop_submission ss JOIN shop s ON s.shop_id = ss.shop_id
        WHERE n.notification_id = $2 AND ${REVIEW_NOTIFICATION_MATCH}
        RETURNING n.notification_id::text AS "notificationId", n.metadata->>'popupSeenAt' AS "popupSeenAt"`,
      [accountId, id]);
      if (!result.rows[0]) throw new ShopError(404, 'SHOP_REVIEW_NOTIFICATION_NOT_FOUND', 'Không tìm thấy thông báo kết quả hồ sơ quán.');
      return result.rows[0];
    });
  }

  async function prepareImageUpload(actor) {
    requireActor(actor, 'member');
    return storage.transaction(async client => {
      const shop = await storage.ownedShop(client, actor, { lock: true, active: true, allowMissing: true });
      if (shop && (shop.verificationStatus === 'pending' || await storage.pending(client, shop.shopId))) {
        conflict('Quán đang có hồ sơ chờ duyệt. Vui lòng chờ kết quả trước khi tải ảnh mới.');
      }
      if (shop && !['rejected', 'verified'].includes(shop.verificationStatus)) conflict();
      return signImageUpload(actor);
    });
  }

  async function submit(raw, actor, resubmitting = false) {
    const accountId = requireActor(actor, 'member');
    const form = parseRegistration(raw);
    return storage.transaction(async client => {
      // Shop đã tồn tại được khóa trước mọi owner write; Account tuần tự hóa đăng ký mới.
      let old = await storage.ownedShop(client, actor, { lock: true, active: true, allowMissing: true });
      // NO KEY UPDATE tuần tự hóa đăng ký nhưng không chặn KEY SHARE của FK hồ sơ/thông báo.
      const locked = await client.query(`SELECT a.account_id FROM account a JOIN role r ON r.role_id = a.role_id
        WHERE a.account_id = $1 AND r.name = 'member' AND a.status IN ('active','reported') FOR NO KEY UPDATE OF a`, [accountId]);
      if (!locked.rows[0]) throw new ShopError(403, 'SHOP_FORBIDDEN', 'Tài khoản không được phép đăng ký quán.');
      // Nếu lần đọc đầu chưa có Shop, đọc lại sau khóa Account để thấy lần đăng ký cạnh tranh.
      if (!old) old = await storage.ownedShop(client, actor, { lock: true, active: true, allowMissing: true });
      if (resubmitting) {
        if (!old || old.verificationStatus !== 'rejected') conflict('Chỉ quán bị từ chối được đăng ký lại.');
        if (await storage.pending(client, old.shopId)) conflict('Quán đã có hồ sơ đang chờ.');
      } else if (old) conflict('Mỗi tài khoản chỉ đăng ký một quán.');
      // URL không đổi lấy từ Shop của owner đã khóa là dữ liệu tin cậy; asset mới vẫn qua provider.
      if (!resubmitting || form.avtShopUrl !== old.avtShopUrl) await verifyImageUpload(form.avtShopUrl, actor);
      let before = null;
      let shopId;
      if (resubmitting) {
        before = { name: old.name, address: old.address, phone: old.phone, avtShopUrl: old.avtShopUrl,
          schedule: await storage.schedule(client, old.shopId) };
        // Không tự dựng snapshot cho legacy data thiếu phone/lịch theo contract.
        try { parseRegistration(before); }
        catch { conflict('Thông tin cũ chưa đầy đủ. Cần hoàn thiện dữ liệu trước khi nộp lại.'); }
        shopId = old.shopId;
        await client.query(`UPDATE shop SET name = $1, address = $2, phone = $3, avt_shop_url = $4,
          verification_status = 'pending', verification_note = NULL, verified_at = NULL, verified_by = NULL
          WHERE shop_id = $5 AND owner_account_id = $6`, [form.name, form.address, form.phone, form.avtShopUrl, shopId, accountId]);
      } else {
        const { rows } = await client.query(`INSERT INTO shop (name, address, phone, avt_shop_url, owner_account_id, created_by, status, verification_status)
          VALUES ($1, $2, $3, $4, $5, $5, 'active', 'pending') RETURNING shop_id::text AS "shopId"`,
        [form.name, form.address, form.phone, form.avtShopUrl, accountId]);
        shopId = rows[0].shopId;
      }
      await storage.replaceSchedule(client, shopId, form.schedule);
      const submission = await storage.insertSubmission(client, shopId, resubmitting ? 'resubmission' : 'registration', before, form, actor);
      await storage.notifyAdmins(client, submission, form.name);
      return { ...await storage.view(client, await storage.getShop(client, shopId)), submission };
    });
  }

  return { getContext, prepareImageUpload, markReviewNotificationSeen, register: (form, actor) => submit(form, actor),
    resubmit: (form, actor) => submit(form, actor, true) };
}

module.exports = { createShopRegistrationModel };
