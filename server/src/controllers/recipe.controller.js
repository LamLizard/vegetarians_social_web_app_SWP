// Khoi's code: Trang Tạo công thức: đọc request → KIỂM TRA dữ liệu → gọi recipe.model → trả JSON.
// Controller không viết SQL. Câu lỗi tiếng Việt vì FE hiện nguyên văn lên UI.
const recipeModel = require('../models/recipe.model');
const { parseRecipeInput, parseCheckNames, RecipeInputError } = require('../utils/recipeInput');
// Khoi's code: Cloud lưu ảnh bìa (bộ CLOUDINARY_POST_*), khớp với nơi API upload đẩy ảnh lên.
const { POST_CLOUD_NAME } = require('../config/cloudinary');

const { RecipeError } = recipeModel;
// Khoi's code: chặn video YouTube chủ kênh tắt nhúng / đã xoá (YouTube trục trặc thì vẫn cho gửi)
const { youTubeRejectMessage } = require('../utils/youtubeCheck');
async function assertPlayableVideo(input) {
  if (!input.youtubeUrl) return;
  const rejected = await youTubeRejectMessage(input.youtubeUrl);
  if (rejected) throw new RecipeError(400, rejected);
}

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
  // Duy's Code : Chuyển từ khóa ô dị ứng xuống truy vấn nguyên liệu hiện hữu.
  res.json({ items: await recipeModel.findIngredientNames(req.query.q ?? '') });
}

/** GET /api/recipes/animal-words → { items: ["nước mắm", "cá", ...] } — Khoi's code: từ động vật để FE tô đỏ khi gõ */
async function getAnimalWords(req, res) {
  res.json({ items: await recipeModel.findAnimalWords() });
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
  const input = parseRecipeInput(req.body, { cloudName: POST_CLOUD_NAME, requireMeta: true, strictUnits: true });
  await assertPlayableVideo(input);
  const { recipe, ingredients } = await recipeModel.createRecipe(req.account.id, input);
  res.status(201).json({ message: 'Công thức đã được gửi và đang chờ duyệt.', recipe, ingredients });
}

/** Khoi's code: mã công thức trên URL → số nguyên dương, sai → 400 */
function parseRecipeId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new RecipeInputError('Mã công thức không hợp lệ.');
  return id;
}

/** GET /api/recipes/mine/:recipeId → MyRecipe + { instructions, ingredients: [{ name, amount, unit, proposed }] } */
async function getMineDetail(req, res) {
  const recipe = await recipeModel.findMineDetail(req.account.id, parseRecipeId(req.params.recipeId));
  if (!recipe) throw new RecipeError(404, 'Không tìm thấy công thức của bạn.');
  res.json(recipe);
}

/** GET /api/recipes/:recipeId — Khoi's code: xem công thức đã duyệt, ai cũng gọi được (kể cả khách) */
/** GET /api/recipes — Khoi's code: trang Công thức, ai cũng xem được → { items, categories } (có token → likedByMe) */
async function getPublicList(req, res) {
  res.json(await recipeModel.findPublicList(req.account?.id ?? null));
}

/** POST / DELETE /api/recipes/:recipeId/like — Khoi's code: thích / bỏ thích → { liked, likeCount } */
const setLike = (liked) => async (req, res) => {
  res.json(await recipeModel.setRecipeLike(parseRecipeId(req.params.recipeId), req.account.id, liked));
};

async function getPublicDetail(req, res) {
  const recipe = await recipeModel.findPublicDetail(parseRecipeId(req.params.recipeId), req.account?.id ?? null);
  if (!recipe) throw new RecipeError(404, 'Không tìm thấy công thức, hoặc công thức chưa được duyệt.');
  res.json(recipe);
}

async function getAvailable(req, res) {
  const query = String(req.query.q ?? '').normalize('NFC').trim();
  if ([...query].length > 200) throw new RecipeInputError('Từ khóa tìm kiếm không được vượt quá 200 ký tự.');
  res.json({ items: await recipeModel.findAvailableRecipes(query) });
}

/**
 * PUT /api/recipes/:recipeId — Khoi's code: "Sửa và gửi lại" công thức bị từ chối.
 * Body giống POST /api/recipes. → 200 { message, recipe, ingredients } (công thức quay về 'pending')
 */
async function resubmitRecipe(req, res) {
  const recipeId = parseRecipeId(req.params.recipeId);
  const input = parseRecipeInput(req.body, { cloudName: POST_CLOUD_NAME, requireMeta: true, strictUnits: true });
  await assertPlayableVideo(input);
  const { recipe, ingredients } = await recipeModel.resubmitRecipe(req.account.id, recipeId, input);
  res.json({ message: 'Đã gửi lại công thức, đang chờ duyệt.', recipe, ingredients });
}

async function getPendingAdmin(req, res) {
  res.json(await recipeModel.listPendingForAdmin());
}

// Duy's Code : Cấp dữ liệu mọi trạng thái cho trang lịch sử duyệt công thức Admin.
async function getAllAdmin(req, res) {
  res.json(await recipeModel.listAllAdminRecipes());
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
  getAnimalWords: handle(getAnimalWords),
  checkIngredients: handle(checkIngredients),
  getMine: handle(getMine),
  createRecipe: handle(createRecipe),
  getMineDetail: handle(getMineDetail),
  getPublicDetail: handle(getPublicDetail),
  getPublicList: handle(getPublicList),
  getAvailable: handle(getAvailable),
  likeRecipe: handle(setLike(true)),
  unlikeRecipe: handle(setLike(false)),
  resubmitRecipe: handle(resubmitRecipe),
  getPendingAdmin: handle(getPendingAdmin),
  getAllAdmin: handle(getAllAdmin),
  decideAdmin: handle(decideAdmin),
  searchAdminDishes: handle(searchAdminDishes),
  renameRecipeDish: handle(renameRecipeDish),
  linkRecipeDish: handle(linkRecipeDish),
};
