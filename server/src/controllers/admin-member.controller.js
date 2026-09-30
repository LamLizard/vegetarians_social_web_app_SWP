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
    if (!/^\d+$/.test(accountId) || !['active', 'locked', 'deleted'].includes(status)) { // Duy's code: cho phép xóa mềm bằng trạng thái deleted.
      return res.status(400).json({ message: 'Trạng thái hoặc mã thành viên không hợp lệ.' });
    }
    if (accountId === String(req.account.id)) { // Duy's code: dùng ID do middleware requireAuth gắn vào.
      return res.status(400).json({ message: 'Không thể tự khóa hoặc xóa tài khoản quản trị đang đăng nhập.' }); // Duy's code: từ chối tự khóa/xóa Admin.
    }

    const member = await updateMemberStatus({ adminId: req.account.id, accountId, status }); // Duy's code: ghi audit theo Admin đã xác thực.
    if (!member) return res.status(404).json({ message: 'Không tìm thấy thành viên.' });
    return res.json(member);
  } catch (error) {
    return next(error);
  }
}

module.exports = { listMembers, setMemberStatus };