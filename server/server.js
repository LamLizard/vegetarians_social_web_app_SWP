require('dotenv').config();
const cors = require('cors');
const express = require('express');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'replace_with_your_secret') {
  throw new Error('Set a private JWT_SECRET in server/.env before starting the API.');
}

const app = express();
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((value) => value.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/users', require('./src/routes/user.routes'));
app.use('/api/admin/members', require('./src/routes/admin-member.routes'));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Đã xảy ra lỗi máy chủ.' });
});

const port = Number(process.env.PORT || 5000);
if (require.main === module) {
  app.listen(port, () => console.log(`API listening on port ${port}`));
}

module.exports = app;