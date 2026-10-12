// Khoi's code: Trang Tạo công thức: đọc request → KIỂM TRA dữ liệu → gọi recipe.model → trả JSON.
// Controller không viết SQL. Câu lỗi tiếng Việt vì FE hiện nguyên văn lên UI.
const recipeModel = require('../models/recipe.model');
const { parseRecipeInput, parseCheckNames, RecipeInputError } = require('../utils/recipeInput');

const { RecipeError } = recipeModel;

/** Bọc mọi handler: lỗi dữ liệu → 400, lỗi nghiệp vụ → đúng mã, lỗi lạ → 500 + ghi log */
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof RecipeInputError) return res.status(400).json({ message: error.message });
    if (error instanceof RecipeError) return res.status(error.status).json({ message: error.message });
    console.error(`[recipe.${fn.name}]`, error);
    return res.status(500).json({ message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
  }
};

/** GET /api/recipes/dishes → { items: [{ id, name }] } — món đang hiện cho ô chọn món */
async function getDishes(req, res) {
  res.json({ items: await recipeModel.findActiveDishes() });
}

/** GET /api/recipes/ingredients → { items: ["Đậu hũ", ...] } — tên trong kho để gợi ý */
async function getIngredients(req, res) {
  res.json({ items: await recipeModel.findIngredientNames() });
}

/**
 * POST /api/recipes/ingredients/check { names: string[] }
 * → { items: [{ name, known, isAnimalDerived, keyword }] } — form dùng để báo "chưa có trong kho" và tô đỏ.
 */
async function checkIngredients(req, res) {
  const names = parseCheckNames(req.body?.names);
  res.json({ items: await recipeModel.checkIngredients(names) });
}

/** GET /api/recipes/mine → { items: MyRecipe[] } */
async function getMine(req, res) {
  res.json({ items: await recipeModel.findMine(req.account.id) });
}

/**
 * POST /api/recipes
 * { dishId? | proposedDishName?, title, thumbnailUrl?, servings?, prepTimeMinutes?, cookTimeMinutes?,
 *   ingredients: [{ name, amount?, unit? }], instructions }
 * → 201 { message, recipe, ingredients }  (công thức 'pending')
 */
async function createRecipe(req, res) {
  const input = parseRecipeInput(req.body, { cloudName: process.env.CLOUDINARY_CLOUD_NAME });
  const { recipe, ingredients } = await recipeModel.createRecipe(req.account.id, input);
  res.status(201).json({ message: 'Công thức đã được gửi và đang chờ duyệt.', recipe, ingredients });
}

async function getPendingAdmin(req, res) {
  res.json(await recipeModel.listPendingForAdmin());
}

async function decideAdmin(req, res) {
  const recipeId = Number(req.params.recipeId);
  if (!Number.isSafeInteger(recipeId) || recipeId < 1) throw new RecipeInputError('Mã công thức không hợp lệ.');
  const action = req.body?.action;
  const note = String(req.body?.note ?? '').normalize('NFC').trim();
  if (note.length > 255) throw new RecipeInputError('Lý do không được vượt quá 255 ký tự.');
  if (action === 'reject' && !note) throw new RecipeInputError('Cần nhập lý do từ chối công thức.');
  res.json(await recipeModel.decideRecipe(recipeId, action, note, { id: req.account.id, ip: req.ip }));
}

async function searchAdminDishes(req, res) {
  const query = String(req.query.q || '').normalize('NFC').trim();
  if (!query || [...query].length > 200) throw new RecipeInputError('Nhập từ khóa từ 1 đến 200 ký tự.');
  res.json(await recipeModel.searchAdminDishes(query));
}

async function renameRecipeDish(req, res) {
  const recipeId = Number(req.params.recipeId);
  const name = String(req.body?.name || '').normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!Number.isSafeInteger(recipeId) || recipeId < 1 || !name || [...name].length > 200) throw new RecipeInputError('Mã công thức hoặc tên món không hợp lệ.');
  res.json(await recipeModel.renameRecipeDish(recipeId, name, { id: req.account.id, ip: req.ip }));
}

async function linkRecipeDish(req, res) {
  const recipeId = Number(req.params.recipeId);
  const dishId = Number(req.body?.dishId);
  if (!Number.isSafeInteger(recipeId) || recipeId < 1 || !Number.isSafeInteger(dishId) || dishId < 1) throw new RecipeInputError('Mã công thức hoặc món ăn không hợp lệ.');
  res.json(await recipeModel.linkRecipeDish(recipeId, dishId, { id: req.account.id, ip: req.ip }, {
    createdFromRecipe: req.body?.createdFromRecipe === true,
  }));
}

module.exports = {
  getDishes: handle(getDishes),
  getIngredients: handle(getIngredients),
  checkIngredients: handle(checkIngredients),
  getMine: handle(getMine),
  createRecipe: handle(createRecipe),
  getPendingAdmin: handle(getPendingAdmin),
  decideAdmin: handle(decideAdmin),
  searchAdminDishes: handle(searchAdminDishes),
  renameRecipeDish: handle(renameRecipeDish),
  linkRecipeDish: handle(linkRecipeDish),
};
