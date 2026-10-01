import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);

// Route không tồn tại
app.use((req, res) => res.status(404).json({ message: 'Không tìm thấy API.' }));

// Lỗi chưa bắt → 500 (log ở server, không lộ chi tiết cho FE)
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ message: 'Máy chủ gặp lỗi, vui lòng thử lại sau.' });
});

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => console.log(`API chạy tại http://localhost:${PORT}`));
