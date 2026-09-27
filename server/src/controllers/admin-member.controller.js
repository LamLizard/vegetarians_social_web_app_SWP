const { findMembers, updateMemberStatus } = require('../models/admin-member.model');

async function listMembers(req, res, next) {
  try {
    const showOnlyReported = req.query.reported === 'true';
    const keyword = String(req.query.search ?? '').trim();
    return res.json(await findMembers({ showOnlyReported, keyword }));
  } catch (error) {
    return next(error);
  }
}

async function setMemberStatus(req, res, next) {
  try {
    const { status } = req.body;
    const accountId = String(req.params.accountId);
    if (!/^\d+$/.test(accountId) || !['active', 'locked'].includes(status)) {
      return res.status(400).json({ message: 'Trạng thái hoặc mã thành viên không hợp lệ.' });
    }
    if (accountId === req.auth.accountId) {
      return res.status(400).json({ message: 'Không thể tự khóa tài khoản admin đang đăng nhập.' });
    }

    const member = await updateMemberStatus({ adminId: req.auth.accountId, accountId, status });
    if (!member) return res.status(404).json({ message: 'Không tìm thấy thành viên.' });
    return res.json(member);
  } catch (error) {
    return next(error);
  }
}

module.exports = { listMembers, setMemberStatus };