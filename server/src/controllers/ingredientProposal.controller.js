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

const listPending = handle(async (_req, res) => {
  res.json({ items: await model.listPending() });
});

const decide = handle(async (req, res) => {
  const note = String(req.body?.note ?? '').normalize('NFC').trim();
  if (note.length > 255) return res.status(400).json({ message: 'Ghi chú không được vượt quá 255 ký tự.' });
  const classification = {
    isAnimalDerived: req.body?.isAnimalDerived === true,
    isNguViTan: req.body?.isNguViTan === true,
    isCommonAllergen: req.body?.isCommonAllergen === true,
  };
  const proposal = await model.decide(req.body?.name, req.account.id, req.body?.action, note, classification, req.ip);
  res.json({ message: 'Đã cập nhật đề xuất nguyên liệu.', proposal });
});

module.exports = { submit, listPending, decide };
