const model = require('../models/ingredientProposal.model');

// Duy's Code : Trả lỗi nghiệp vụ đề cử nguyên liệu qua API thân thiện với giao diện.
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof model.IngredientProposalError) return res.status(error.status).json({ message: error.message });
    console.error(`[ingredientProposal.${fn.name}]`, error);
    return res.status(500).json({ message: 'Không thể xử lý đề xuất nguyên liệu lúc này.' });
  }
};

const submit = handle(async (req, res) => {
  const proposal = await model.submit(req.account.id, req.body?.name);
  res.status(201).json({ message: 'Đã gửi nguyên liệu cho Admin duyệt.', proposal });
});

const listMine = handle(async (req, res) => {
  res.json({ items: await model.listMine(req.account.id) });
});

const listPending = handle(async (_req, res) => {
  res.json({ items: await model.listPending() });
});

// Duy's Code: Cấp dữ liệu Banned Keyword đang được dùng, chỉ đọc bảng có sẵn.
const listBannedKeywords = handle(async (_req, res) => {
  res.json({ items: await model.listBannedKeywords() });
});

// Duy's Code: Lấy lịch sử quyết định nguyên liệu từ admin_log theo trang.
const listHistory = handle(async (req, res) => {
  const requestedPage = Number.parseInt(req.query.page, 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  res.json(await model.listHistory(page, 20));
});

const decide = handle(async (req, res) => {
  const note = String(req.body?.note ?? '').normalize('NFC').trim();
  if (note.length > 255) return res.status(400).json({ message: 'Ghi chú không được vượt quá 255 ký tự.' });
  const sourceType = String(req.body?.sourceType ?? '');
  if (req.body?.action === 'approve'
    && (typeof req.body?.isAnimalDerived !== 'boolean' || typeof req.body?.isNguViTan !== 'boolean')) {
    return res.status(400).json({ message: 'Cần xác nhận phân loại đồ chay và ngũ vị tân trước khi thêm nguyên liệu.' });
  }
  const classification = {
    isAnimalDerived: req.body?.isAnimalDerived,
    isNguViTan: req.body?.isNguViTan,
    isCommonAllergen: req.body?.isCommonAllergen === true,
  };
  const proposal = await model.decide(req.body?.name, sourceType, req.account.id, req.body?.action, note, classification, req.ip);
  res.json({ message: 'Đã cập nhật đề xuất nguyên liệu.', proposal });
});

module.exports = { submit, listMine, listPending, listBannedKeywords, listHistory, decide };
