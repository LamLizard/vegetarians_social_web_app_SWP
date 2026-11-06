const accountReportModel = require('../models/account-report.model');

const REASON_CODES = [
  'account_spam',
  'account_avatar_inappropriate',
  'account_impersonation',
  'account_harassment',
  'account_fraud',
  'account_inappropriate_content',
];
const MAX_REASON_TEXT = 500;

async function createAccountReport(req, res, next) {
  const accountId = String(req.params.accountId ?? '');
  if (!/^[1-9]\d{0,17}$/.test(accountId)) {
    return res.status(400).json({ message: 'Mã tài khoản không hợp lệ.' });
  }

  const { reasonCode } = req.body ?? {};
  if (!REASON_CODES.includes(reasonCode)) {
    return res.status(400).json({ message: 'Chọn lý do báo cáo hợp lệ.' });
  }
  const reasonText = String(req.body?.reasonText ?? '').trim() || null;
  if (reasonText && [...reasonText].length > MAX_REASON_TEXT) {
    return res.status(400).json({ message: `Mô tả tối đa ${MAX_REASON_TEXT} ký tự.` });
  }

  try {
    const created = await accountReportModel.createAccountReport({
      reporterId: req.account.id,
      accountId,
      reasonCode,
      reasonText,
    });
    return res.status(201).json(created);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

module.exports = { createAccountReport };
