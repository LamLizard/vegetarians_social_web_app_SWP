// Tùng — Sprint 2: đăng ký/nộp lại giữ cùng Shop, lịch sử và menu; lưu atomically.
const { createShopStorage } = require('./shopWorkflow.model');
const { requireActor, conflict, ShopError } = require('../utils/shopWorkflow');
const { parseRegistration } = require('../utils/shopRegistration');

function createShopRegistrationModel(database) {
  const storage = createShopStorage(database);

  async function getContext(actor) {
    requireActor(actor, 'member');
    return storage.transaction(async client => {
      const shop = await storage.ownedShop(client, actor, { allowMissing: true });
      return { ...await storage.view(client, shop), canRegister: !shop,
        canResubmit: shop?.verificationStatus === 'rejected' };
    }, true);
  }

  async function submit(raw, actor, resubmitting = false) {
    const accountId = requireActor(actor, 'member');
    const form = parseRegistration(raw);
    return storage.transaction(async client => {
      // Khóa Account trước Shop: hai lần đăng ký cùng Account không cùng tạo Shop mới.
      const locked = await client.query(`SELECT a.account_id FROM account a JOIN role r ON r.role_id = a.role_id
        WHERE a.account_id = $1 AND r.name = 'member' AND a.status IN ('active','reported') FOR UPDATE OF a`, [accountId]);
      if (!locked.rows[0]) throw new ShopError(403, 'SHOP_FORBIDDEN', 'Tài khoản không được phép đăng ký quán.');
      const old = await storage.ownedShop(client, actor, { lock: true, allowMissing: true });
      let before = null;
      let shopId;
      if (resubmitting) {
        if (!old || old.verificationStatus !== 'rejected') conflict('Chỉ quán bị từ chối được đăng ký lại.');
        if (await storage.pending(client, old.shopId)) conflict('Quán đã có hồ sơ đang chờ.');
        before = { name: old.name, address: old.address, phone: old.phone,
          schedule: await storage.schedule(client, old.shopId) };
        // Không tự dựng snapshot cho legacy data thiếu phone/lịch theo contract.
        if (!old.phone) conflict('Thông tin cũ thiếu số điện thoại. Cần hoàn thiện dữ liệu trước khi nộp lại.');
        shopId = old.shopId;
        await client.query(`UPDATE shop SET name = $1, address = $2, phone = $3,
          verification_status = 'pending', verification_note = NULL, verified_at = NULL, verified_by = NULL
          WHERE shop_id = $4 AND owner_account_id = $5`, [form.name, form.address, form.phone, shopId, accountId]);
      } else {
        if (old) conflict('Mỗi tài khoản chỉ đăng ký một quán.');
        const { rows } = await client.query(`INSERT INTO shop (name, address, phone, owner_account_id, created_by, verification_status)
          VALUES ($1, $2, $3, $4, $4, 'pending') RETURNING shop_id::text AS "shopId"`,
        [form.name, form.address, form.phone, accountId]);
        shopId = rows[0].shopId;
      }
      await storage.replaceSchedule(client, shopId, form.schedule);
      const submission = await storage.insertSubmission(client, shopId, resubmitting ? 'resubmission' : 'registration', before, form, actor);
      await storage.notifyAdmins(client, submission, form.name);
      return { ...await storage.view(client, await storage.getShop(client, shopId)), submission };
    });
  }

  return { getContext, register: (form, actor) => submit(form, actor),
    resubmit: (form, actor) => submit(form, actor, true) };
}

module.exports = { createShopRegistrationModel };
