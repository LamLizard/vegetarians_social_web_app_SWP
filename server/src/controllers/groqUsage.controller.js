const usage = require('../utils/groqUsage');

function read(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  const keys = Object.keys(req.query);
  const date = req.query.date === undefined ? usage.vietnamDate() : req.query.date;
  if (keys.some((key) => key !== 'date') || typeof date !== 'string' || !usage.allowedDate(date)) {
    return res.status(400).json({ code: 'INVALID_USAGE_DATE', message: 'Ngày thống kê không hợp lệ.' });
  }
  try {
    return res.json(usage.getUsage(date));
  } catch {
    return res.status(503).json({ code: 'USAGE_UNAVAILABLE', message: 'Không thể tải thống kê Groq.' });
  }
}

module.exports = { read };
