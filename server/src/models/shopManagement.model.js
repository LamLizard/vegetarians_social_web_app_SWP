// Tùng — Sprint 2: owner quản lý identity request, lịch và liên kết menu; catalog chỉ đọc.
const { createShopStorage, MENU_FIELDS } = require('./shopWorkflow.model');
const { parseIdentity } = require('../utils/shopRegistration');
const { parseScheduleUpdate, parseMenu } = require('../utils/shopManagement');
const { requireActor, parseId, parsePagination, whitelist, conflict, ShopError, pageResult } = require('../utils/shopWorkflow');

function createShopManagementModel(database) {
  const storage = createShopStorage(database);

  async function getMine(actor) {
    requireActor(actor, 'member');
    return storage.transaction(async client => storage.view(client,
      await storage.ownedShop(client, actor, { allowMissing: true })), true);
  }

  async function requestIdentity(raw, actor) {
    requireActor(actor, 'member');
    const proposed = parseIdentity(raw);
    return storage.transaction(async client => {
      const shop = await storage.ownedShop(client, actor, { lock: true, verified: true });
      if (await storage.pending(client, shop.shopId)) conflict('Đã có yêu cầu sửa đang chờ duyệt.');
      const keys = Object.keys(proposed).filter(key => proposed[key] !== shop[key]);
      if (!keys.length) return { ...await storage.view(client, shop), unchanged: true };
      if (keys.some(key => typeof shop[key] !== 'string')) conflict('Thông tin hiện tại chưa đầy đủ. Cần hoàn thiện dữ liệu trước khi gửi yêu cầu sửa.');
      const before = Object.fromEntries(keys.map(key => [key, shop[key]]));
      const after = Object.fromEntries(keys.map(key => [key, proposed[key]]));
      const submission = await storage.insertSubmission(client, shop.shopId, 'identity_edit', before, after, actor);
      await storage.notifyAdmins(client, submission, shop.name);
      return { ...await storage.view(client, shop), submission };
    });
  }

  async function updateSchedule(raw, actor) {
    requireActor(actor, 'member');
    const update = parseScheduleUpdate(raw);
    return storage.transaction(async client => {
      const shop = await storage.ownedShop(client, actor, { lock: true, verified: true });
      storage.checkVersion(shop.version, update.expectedVersion);
      await storage.replaceSchedule(client, shop.shopId, update.schedule);
      return storage.view(client, await storage.getShop(client, shop.shopId));
    });
  }

  async function listMenu(actor) {
    requireActor(actor, 'member');
    return storage.transaction(async client => {
      const shop = await storage.ownedShop(client, actor);
      const { rows } = await client.query(`SELECT ${MENU_FIELDS} FROM shop_dish sd JOIN dish d ON d.dish_id = sd.dish_id
        WHERE sd.shop_id = $1 ORDER BY sd.shop_dish_id`, [shop.shopId]);
      return { items: rows.map(row => ({ ...row, price: Number(row.price) })) };
    }, true);
  }

  async function getMenuItem(client, id, shopId) {
    const { rows } = await client.query(`SELECT ${MENU_FIELDS} FROM shop_dish sd JOIN dish d ON d.dish_id = sd.dish_id
      WHERE sd.shop_dish_id = $1 AND sd.shop_id = $2`, [id, shopId]);
    if (!rows[0]) throw new ShopError(404, 'SHOP_MENU_NOT_FOUND', 'Không tìm thấy món trong menu của bạn.');
    return { ...rows[0], price: Number(rows[0].price) };
  }

  async function addMenu(raw, actor) {
    requireActor(actor, 'member');
    const item = parseMenu(raw, true);
    return storage.transaction(async client => {
      const shop = await storage.ownedShop(client, actor, { lock: true, verified: true });
      const dish = await client.query("SELECT dish_id FROM dish WHERE dish_id = $1 AND status = 'active' FOR SHARE", [item.dishId]);
      if (!dish.rows[0]) throw new ShopError(400, 'SHOP_DISH_INELIGIBLE', 'Chỉ món đã được duyệt được thêm vào menu.');
      const duplicate = await client.query('SELECT shop_dish_id FROM shop_dish WHERE shop_id = $1 AND dish_id = $2', [shop.shopId, item.dishId]);
      if (duplicate.rows[0]) conflict('Món đã có trong menu. Bạn có thể bật lại đang bán.');
      const inserted = await client.query(`INSERT INTO shop_dish (shop_id, dish_id, price, ingredient_note, is_available, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING shop_dish_id::text AS id`,
      [shop.shopId, item.dishId, item.price, item.ingredientNote || null, item.isAvailable ?? true, actor.id]);
      return { item: await getMenuItem(client, inserted.rows[0].id, shop.shopId) };
    });
  }

  async function updateMenu(rawId, raw, actor) {
    requireActor(actor, 'member');
    const id = parseId(rawId, 'shopDishId');
    const update = parseMenu(raw);
    return storage.transaction(async client => {
      const shop = await storage.ownedShop(client, actor, { lock: true, verified: true });
      const locked = await client.query(`SELECT row_version::text AS version FROM shop_dish
        WHERE shop_dish_id = $1 AND shop_id = $2 FOR UPDATE`, [id, shop.shopId]);
      if (!locked.rows[0]) throw new ShopError(404, 'SHOP_MENU_NOT_FOUND', 'Không tìm thấy món trong menu của bạn.');
      storage.checkVersion(locked.rows[0].version, update.expectedVersion);
      const columns = { price: 'price', ingredientNote: 'ingredient_note', isAvailable: 'is_available' };
      const keys = Object.keys(columns).filter(key => Object.hasOwn(update, key));
      const values = keys.map(key => update[key]);
      await client.query(`UPDATE shop_dish SET ${keys.map((key, index) => `${columns[key]} = $${index + 1}`).join(', ')},
        updated_by = $${values.length + 1} WHERE shop_dish_id = $${values.length + 2}
        AND shop_id = $${values.length + 3} AND row_version = $${values.length + 4}`,
      [...values, actor.id, id, shop.shopId, update.expectedVersion]);
      return { item: await getMenuItem(client, id, shop.shopId) };
    });
  }

  // Tùng — Sprint 2: lookup owner riêng; pending do người khác/null creator không được trả.
  async function listDishes(rawQuery, actor) {
    const ownerId = requireActor(actor, 'member');
    whitelist(rawQuery, ['page', 'pageSize', 'pendingPage']);
    const query = parsePagination(rawQuery);
    const pendingQuery = parsePagination({ page: rawQuery.pendingPage, pageSize: rawQuery.pageSize });
    return storage.transaction(async client => {
      const shop = await storage.ownedShop(client, actor, { verified: true });
      async function group(pending) {
        const where = pending ? "d.status = 'pending' AND d.created_by = $1" : "d.status = 'active'";
        const values = pending ? [ownerId] : [];
        const counted = await client.query(`SELECT count(*)::int AS total FROM dish d WHERE ${where}`, values);
        const total = counted.rows[0].total;
        const page = Math.min(pending ? pendingQuery.page : query.page, Math.max(1, Math.ceil(total / query.pageSize)));
        const { rows } = await client.query(`SELECT d.dish_id::text AS "dishId", d.name, d.status,
          EXISTS(SELECT 1 FROM shop_dish sd WHERE sd.shop_id = $${values.length + 1} AND sd.dish_id = d.dish_id) AS "alreadyLinked"
          FROM dish d WHERE ${where} ORDER BY d.name, d.dish_id
          LIMIT $${values.length + 2} OFFSET $${values.length + 3}`,
        [...values, shop.shopId, query.pageSize, (page - 1) * query.pageSize]);
        // Tùng — Sprint 2: BRIDGE-03 chỉ trả DTO picker, không lan truyền fields riêng của catalog.
        return pageResult(rows.map(row => ({ dishId: row.dishId, name: row.name, status: row.status,
          alreadyLinked: row.alreadyLinked, selectable: !pending && !row.alreadyLinked })), total, page, query.pageSize);
      }
      return { active: await group(false), ownPending: await group(true) };
    }, true);
  }

  return { getMine, requestIdentity, updateSchedule, listMenu, addMenu, updateMenu, listDishes };
}

module.exports = { createShopManagementModel };
