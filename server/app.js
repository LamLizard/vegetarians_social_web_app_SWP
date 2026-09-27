const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());          // dev cho thoáng; sau siết origin từ client/.env (CLIENT_URL)
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---- Mỗi tính năng của nhóm thêm 2 dòng ở đây ----
// const authRoutes = require('./src/routes/auth.routes');
// app.use('/api/auth', authRoutes);

module.exports = app;