const adminModel = require('../models/admin.model');

async function getDashboard(req, res) {
  try {
    return res.json(await adminModel.getDashboard());
  } catch (error) {
    console.error('[admin.dashboard]', error.code || error.name || 'UnexpectedError');
    return res.status(500).json({ message: 'Không thể tải dữ liệu quản trị. Vui lòng thử lại sau.' });
  }
}

function getPage(req, res) {
  const page = Number(req.query.page ?? 1);
  if (!Number.isSafeInteger(page) || page < 1) {
    res.status(400).json({ message: 'Trang phải là số nguyên lớn hơn hoặc bằng 1.' });
    return null;
  }
  return page;
}

async function getDashboardList(req, res, label, load) {
  const page = getPage(req, res);
  if (page === null) return;
  try {
    return res.json(await load(page));
  } catch (error) {
    console.error(`[admin.dashboard.${label}]`, error.code || error.name || 'UnexpectedError');
    return res.status(500).json({ message: 'Không thể tải dữ liệu quản trị. Vui lòng thử lại sau.' });
  }
}

function getAlerts(req, res) {
  return getDashboardList(req, res, 'alerts', adminModel.getAlerts);
}

function getQueue(req, res) {
  return getDashboardList(req, res, 'queue', adminModel.getQueue);
}

function getAudit(req, res) {
  return getDashboardList(req, res, 'audit', adminModel.getAudit);
}

module.exports = { getDashboard, getAlerts, getQueue, getAudit };