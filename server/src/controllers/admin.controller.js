const adminModel = require('../models/admin.model');

async function getDashboard(req, res) {
  try {
    return res.json(await adminModel.getDashboard());
  } catch (error) {
    console.error('[admin.dashboard]', error.code || error.name || 'UnexpectedError');
    return res.status(500).json({ message: 'Không thể tải dữ liệu quản trị. Vui lòng thử lại sau.' });
  }
}

module.exports = { getDashboard };