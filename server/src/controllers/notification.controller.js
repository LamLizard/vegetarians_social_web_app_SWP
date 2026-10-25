const model = require('../models/notification.model');

function handle(fn) {
  return async (req, res) => {
    try { return res.json(await fn(req)); }
    catch (error) {
      if (error.status) return res.status(error.status).json({ message: error.message });
      console.error(`[notification.${fn.name}]`, error);
      return res.status(500).json({ message: 'Không thể tải thông báo lúc này.' });
    }
  };
}

module.exports = {
  listMine: handle((req) => model.listForAccount(req.account.id)),
  markRead: handle((req) => model.markRead(req.account.id, req.params.notificationId)),
  markAllRead: handle((req) => model.markAllRead(req.account.id)),
};
