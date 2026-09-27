// server/app.js

const express = require('express');
const cors = require('cors');

const shopRoutes = require('./src/routes/shop.routes');
const errorHandler = require('./src/middlewares/error');

const app = express();

// Không gửi header tiết lộ Express cho client.
app.disable('x-powered-by');

// Đây là origin mặc định khi chạy React bằng Vite ở local.
// Khi deploy, cấu hình CLIENT_ORIGIN bằng origin frontend thực tế.
const clientOrigin =
  process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// CORS cho phép frontend gọi API từ origin đã cấu hình.
// Xác thực và phân quyền vẫn do middleware auth đảm nhiệm.
app.use(
  cors({
    origin: clientOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Đọc body JSON trước khi request đi vào routes.
app.use(
  express.json({
    limit: '100kb',
  })
);

// Endpoint này chỉ kiểm tra ứng dụng Express có đang chạy.
// Không thực hiện truy vấn kiểm tra database.
app.get('/api/health', (request, response) => {
  return response.status(200).json({
    success: true,
    message: 'Backend đang hoạt động.',
  });
});

// Mount routes của chức năng xác minh quán.
// Các feature khác của team sẽ được mount tại khu vực này.
app.use('/api/admin/shops', shopRoutes);

// Request không khớp route nào sẽ nhận lỗi 404.
// Phải đặt sau tất cả routes.
app.use((request, response) => {
  return response.status(404).json({
    success: false,
    message: 'Không tìm thấy API.',
    error: {
      code: 'ROUTE_NOT_FOUND',
    },
  });
});

// Error handler luôn nằm cuối cùng.
app.use(errorHandler);

module.exports = app;