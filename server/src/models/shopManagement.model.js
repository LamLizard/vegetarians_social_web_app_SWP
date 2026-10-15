// Tùng — Sprint 2: owner quản lý identity request, lịch và liên kết menu; catalog chỉ đọc.
const { createShopStorage, MENU_FIELDS } = require('./shopWorkflow.model');
const { parseIdentity } = require('../utils/shopRegistration');
const { createShopImageUpload } = require('../utils/shopImageUpload');
const { parseScheduleUpdate, parseMenu, parseMenuRemoval, parseDishSearch, menuNameKey, DISH_SEARCH_FROM, DISH_SEARCH_TO } = require('../utils/shopManagement');
const { requireActor, parseId, parsePagination, whitelist, conflict, ShopError, pageResult } = require('../utils/shopWorkflow');

// Fields catalog giữ nghĩa cũ; phần riêng/effective chỉ bổ sung DTO Management.
const OWNER_MENU_FIELDS = `${MENU_FIELDS}, sd.display_name AS "displayName", sd.img_url AS "customImageUrl"`;
const menuDTO = row => ({ ...row, price: Number(row.price), dishImageUrl: row.imageUrl,
  effectiveName: row.displayName || row.dishName, effectiveImageUrl: row.customImageUrl || row.imageUrl });

function createShopManagementModel(database, dependencies = {}) {
  const storage = createShopStorage(database);
  const imageUpload = dependencies.imageUpload || createShopImageUpload();
  const verifyImageUpload = dependencies.verifyImageUpload || imageUpload.verifyImageUpload;

  async function verifyMenuImage(url, actor) {
    try { return await verifyImageUpload(url, actor); }
    catch (error) {
      if (!(error instanceof ShopError)) throw error;
      throw new ShopError(error.status, error.code, error.message.replaceAll('Ảnh quán', 'Ảnh món').replaceAll('ảnh quán', 'ảnh món'),
        error.fieldErrors ? { imageUrl: error.fieldErrors.avtShopUrl || error.message } : undefined);
    }
  }

  async function prepareMenuImageUpload(actor) {
    requireActor(actor, 'member');
    return storage.transaction(async client => {
      await storage.ownedShop(client, actor, { lock: true, verified: true, active: true });
      return imageUpload.prepareImageUpload(actor);
    });
  }

  async function checkMenuName(client, shopId, dishId, name, exceptId = null) {
    const { rows } = await client.query(`SELECT sd.shop_dish_id::text AS id,
      COALESCE(sd.display_name, d.name) AS name FROM shop_dish sd JOIN dish d ON d.dish_id = sd.dish_id
      WHERE sd.shop_id = $1 AND sd.dish_id = $2`, [shopId, dishId]);
    if (rows.some(row => row.id !== exceptId && menuNameKey(row.name) === menuNameKey(name))) {
      throw new ShopError(409, 'SHOP_MENU_NAME_EXISTS', 'Tên món đã có trong phân loại này. Bạn có thể sửa hoặc bật lại món đã tắt bán.',
        { displayName: 'Tên này đã có trong cùng phân loại của quán.' });
    }
  }

  async function getMine(actor) {
    requireActor(actor, 'member');
    return storage.transaction(async client => storage.view(client,
      await storage.ownedShop(client, actor, { allowMissing: true })), true);
  }

  async function requestIdentity(raw, actor) {
    requireActor(actor, 'member');
    const proposed = parseIdentity(raw);
    return storage.transaction(async client => {
      const shop = await storage.ownedShop(client, actor, { lock: true, verified: true, active: true });
      if (await storage.pending(client, shop.shopId)) conflict('Đã có yêu cầu sửa đang chờ duyệt.');
      const keys = Object.keys(proposed).filter(key => proposed[key] !== shop[key]);
      if (!keys.length) return { ...await storage.view(client, shop), unchanged: true };
      if (keys.some(key => typeof shop[key] !== 'string')) conflict('Thông tin hiện tại chưa đầy đủ. Cần hoàn thiện dữ liệu trước khi gửi yêu cầu sửa.');
      // Giữ khóa Shop trong lần kiểm tra provider có timeout để mở/khóa không vượt guard.
      if (keys.includes('avtShopUrl')) await verifyImageUpload(proposed.avtShopUrl, actor);
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
      const shop = await storage.ownedShop(client, actor, { lock: true, verified: true, active: true });
      storage.checkVersion(shop.version, update.expectedVersion);
      await storage.replaceSchedule(client, shop.shopId, update.schedule);
      return storage.view(client, await storage.getShop(client, shop.shopId));
    });
  }

  async function listMenu(actor) {
    requireActor(actor, 'member');
    return storage.transaction(async client => {
      const shop = await storage.ownedShop(client, actor);
      const { rows } = await client.query(`SELECT ${OWNER_MENU_FIELDS} FROM shop_dish sd JOIN dish d ON d.dish_id = sd.dish_id
        WHERE sd.shop_id = $1 ORDER BY sd.shop_dish_id`, [shop.shopId]);
      return { items: rows.map(menuDTO) };
    }, true);
  }

  async function getMenuItem(client, id, shopId) {
    const { rows } = await client.query(`SELECT ${OWNER_MENU_FIELDS} FROM shop_dish sd JOIN dish d ON d.dish_id = sd.dish_id
      WHERE sd.shop_dish_id = $1 AND sd.shop_id = $2`, [id, shopId]);
    if (!rows[0]) throw new ShopError(404, 'SHOP_MENU_NOT_FOUND', 'Không tìm thấy món trong menu của bạn.');
    return menuDTO(rows[0]);
  }

  async function addMenu(raw, actor) {
    requireActor(actor, 'member');
    const item = parseMenu(raw, true);
    try {
      return await storage.transaction(async client => {
        await client.query("SET LOCAL lock_timeout = '10s'");
        const shop = await storage.ownedShop(client, actor, { lock: true, verified: true, active: true });
        const dish = await client.query("SELECT dish_id FROM dish WHERE dish_id = $1 AND status = 'active' FOR SHARE", [item.dishId]);
        if (!dish.rows[0]) throw new ShopError(400, 'SHOP_DISH_INELIGIBLE', 'Chỉ món đã được duyệt được thêm vào menu.');
        // Khóa Shop giữ kiểm tra tên và INSERT trong cùng transaction, tránh hai request cùng thêm một tên.
        await checkMenuName(client, shop.shopId, item.dishId, item.displayName);
        if (item.imageUrl) await verifyMenuImage(item.imageUrl, actor);
        const inserted = await client.query(`INSERT INTO shop_dish (shop_id, dish_id, display_name, img_url, price, ingredient_note, is_available, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8) RETURNING shop_dish_id::text AS id`,
          [shop.shopId, item.dishId, item.displayName, item.imageUrl, item.price, item.ingredientNote || null, item.isAvailable ?? true, actor.id]);
        return { item: await getMenuItem(client, inserted.rows[0].id, shop.shopId) };
      });
    } catch (error) {
      if (error.code === '55P03') throw new ShopError(409, 'SHOP_MENU_BUSY', 'Quán đang có thay đổi khác được xử lý. Vui lòng thử lại sau.');
      throw error;
    }
  }

  async function updateMenu(rawId, raw, actor) {
    requireActor(actor, 'member');
    const id = parseId(rawId, 'shopDishId');
    const update = parseMenu(raw);
    return storage.transaction(async client => {
      const shop = await storage.ownedShop(client, actor, { lock: true, verified: true, active: true });
      const locked = await client.query(`SELECT row_version::text AS version FROM shop_dish
        WHERE shop_dish_id = $1 AND shop_id = $2 FOR UPDATE`, [id, shop.shopId]);
      if (!locked.rows[0]) throw new ShopError(404, 'SHOP_MENU_NOT_FOUND', 'Không tìm thấy món trong menu của bạn.');
      storage.checkVersion(locked.rows[0].version, update.expectedVersion);
      const current = await getMenuItem(client, id, shop.shopId);
      if (Object.hasOwn(update, 'displayName')) await checkMenuName(client, shop.shopId, current.dishId, update.displayName, id);
      if (update.imageUrl && update.imageUrl !== current.customImageUrl) await verifyMenuImage(update.imageUrl, actor);
      const columns = { displayName: 'display_name', imageUrl: 'img_url', price: 'price', ingredientNote: 'ingredient_note', isAvailable: 'is_available' };
      const keys = Object.keys(columns).filter(key => Object.hasOwn(update, key));
      const values = keys.map(key => update[key]);
      await client.query(`UPDATE shop_dish SET ${keys.map((key, index) => `${columns[key]} = $${index + 1}`).join(', ')},
        updated_by = $${values.length + 1} WHERE shop_dish_id = $${values.length + 2}
        AND shop_id = $${values.length + 3} AND row_version = $${values.length + 4}`,
      [...values, actor.id, id, shop.shopId, update.expectedVersion]);
      return { item: await getMenuItem(client, id, shop.shopId) };
    });
  }

  async function removeMenu(rawId, raw, actor) {
    requireActor(actor, 'member');
    const id = parseId(rawId, 'shopDishId');
    const removal = parseMenuRemoval(raw);
    return storage.transaction(async client => {
      const shop = await storage.ownedShop(client, actor, { lock: true, verified: true, active: true });
      const locked = await client.query(`SELECT row_version::text AS version FROM shop_dish
        WHERE shop_dish_id = $1 AND shop_id = $2 FOR UPDATE`, [id, shop.shopId]);
      if (!locked.rows[0]) throw new ShopError(404, 'SHOP_MENU_NOT_FOUND', 'Không tìm thấy món trong menu của bạn.');
      storage.checkVersion(locked.rows[0].version, removal.expectedVersion);
      const removed = await client.query(`DELETE FROM shop_dish
        WHERE shop_dish_id = $1 AND shop_id = $2 AND row_version = $3
        RETURNING shop_dish_id::text AS "shopDishId"`, [id, shop.shopId, removal.expectedVersion]);
      if (!removed.rows[0]) conflict();
      return removed.rows[0];
    });
  }

  // Tùng — Sprint 2: lookup owner riêng; pending do người khác/null creator không được trả.
  async function listDishes(rawQuery, actor) {
    const ownerId = requireActor(actor, 'member');
    whitelist(rawQuery, ['page', 'pageSize', 'pendingPage', 'q']);
    const search = parseDishSearch(rawQuery.q);
    const escapeLike = value => value.replace(/[\\%_]/g, character => '\\' + character);
    const query = parsePagination(rawQuery);
    const pendingQuery = parsePagination({ page: rawQuery.pendingPage, pageSize: rawQuery.pageSize });
    return storage.transaction(async client => {
      const shop = await storage.ownedShop(client, actor);
      async function group(pending) {
        const values = [DISH_SEARCH_FROM, DISH_SEARCH_TO];
        const bind = value => { values.push(value); return `$${values.length}`; };
        const key = "lower(btrim(regexp_replace(translate(d.name, $1, $2), '[[:space:]]+', ' ', 'g')))";
        const terms = search ? [...new Set(search.split(' '))] : [''];
        const matches = terms.map(term => `${key} LIKE ${bind('%' + escapeLike(term) + '%')} ESCAPE CHR(92)`);
        const where = [pending ? `d.status = 'pending' AND d.created_by = ${bind(ownerId)}` : "d.status = 'active'", ...matches].join(' AND ');
        const counted = await client.query(`SELECT count(*)::int AS total FROM dish d WHERE ${where}`, values);
        const total = counted.rows[0].total;
        const page = Math.min(pending ? pendingQuery.page : query.page, Math.max(1, Math.ceil(total / query.pageSize)));
        const exact = bind(search);
        const prefix = bind(escapeLike(search) + '%');
        const shopParam = bind(shop.shopId);
        const limit = bind(query.pageSize);
        const offset = bind((page - 1) * query.pageSize);
        const { rows } = await client.query(`SELECT d.dish_id::text AS "dishId", d.name, d.status,
          EXISTS(SELECT 1 FROM shop_dish sd WHERE sd.shop_id = ${shopParam} AND sd.dish_id = d.dish_id) AS "alreadyLinked"
          FROM dish d WHERE ${where}
          ORDER BY CASE WHEN ${key} = ${exact} THEN 0 WHEN ${key} LIKE ${prefix} ESCAPE CHR(92) THEN 1 ELSE 2 END,
            d.name, d.dish_id LIMIT ${limit} OFFSET ${offset}`, values);
        // Tùng — Sprint 2: BRIDGE-03 chỉ trả DTO picker, không lan truyền fields riêng của catalog.
        return pageResult(rows.map(row => ({ dishId: row.dishId, name: row.name, status: row.status,
          alreadyLinked: row.alreadyLinked,
          selectable: shop.status === 'active' && shop.verificationStatus === 'verified' && !pending })), total, page, query.pageSize);
      }
      return { active: await group(false), ownPending: await group(true) };
    }, true);
  }

  return { getMine, requestIdentity, updateSchedule, listMenu, addMenu, updateMenu, removeMenu, listDishes, prepareMenuImageUpload };
}

module.exports = { createShopManagementModel };
