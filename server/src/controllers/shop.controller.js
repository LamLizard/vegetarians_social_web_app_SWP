const shopModel = require('../models/shop.model');

const PAGE_SIZE = 9;

class ShopError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ShopError';
    this.status = status;
  }
}

function escapeLikeText(value) {
  return String(value ?? '').replace(/[\\%_]/g, '\\$&');
}

function parseOptionalText(value, maxLength = 100) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if ([...text].length > maxLength) {
    throw new ShopError(400, `Từ khoá tối đa ${maxLength} ký tự.`);
  }
  return `%${escapeLikeText(text)}%`;
}

function parsePage(value) {
  const n = Number(value ?? 1);
  if (!Number.isInteger(n) || n < 1) {
    throw new ShopError(400, 'Trang không hợp lệ.');
  }
  return n;
}

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof ShopError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error(`[shop.${fn.name}]`, error);
    return res.status(500).json({ message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
  }
};

async function getShops(req, res) {
  const q = parseOptionalText(req.query.q, 100);
  const page = parsePage(req.query.page ?? 1);

  const { items, total } = await shopModel.findVerifiedShops({
    q,
    page,
    pageSize: PAGE_SIZE,
  });

  res.json({
    items: items.map((r) => ({
      id: String(r.shop_id),
      name: r.name,
      address: r.address,
      phone: r.phone ?? null,
      operatingStatus: r.status,
      openDays: r.open_days ?? null,
      imageUrl: r.avt_shop_url,
      dishCount: r.dish_count,
      schedule: r.schedule ?? [],
      matchedDishes: r.matchedDishes ?? [],
    })),
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    totalItems: total,
  });
}

async function getCategories(req, res) {
  const rows = await shopModel.findFilterCategories();
  res.json({
    items: rows.map((row) => ({
      id: String(row.category_id),
      name: row.name,
    })),
  });
}

async function getShop(req, res) {
  const shopId = Number(req.params.id);
  if (!Number.isInteger(shopId) || shopId <= 0) {
    throw new ShopError(400, 'Quán không hợp lệ.');
  }

  const detail = await shopModel.findShopDetail(shopId);
  if (!detail || !detail.shop) {
    throw new ShopError(404, 'Không tìm thấy quán.');
  }

  res.json({
    shop: {
      id: String(detail.shop.shop_id),
      name: detail.shop.name,
      address: detail.shop.address,
      phone: detail.shop.phone ?? null,
      operatingStatus: detail.shop.status,
      openDays: detail.shop.open_days ?? null,
      imageUrl: detail.shop.avt_shop_url,
      dishCount: detail.shop.dish_count,
    },
    schedule: detail.schedule ?? [],
    menu: detail.menu.map((m) => ({
      id: String(m.shop_dish_id),
      dishId: String(m.dish_id),
      name: m.name,
      price: m.price,
      ingredientNote: m.ingredient_note ?? null,
      imageUrl: m.img_url ?? null,
      isAvailable: m.is_available,
      category: m.dish_category ?? null,
    })),
  });
}

module.exports = {
  getShops: handle(getShops),
  getCategories: handle(getCategories),
  getShop: handle(getShop),
  PAGE_SIZE,
};
