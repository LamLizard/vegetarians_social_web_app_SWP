// server/server.js

const path = require('node:path');
const dotenv = require('dotenv');

// Load biến môi trường từ server/.env.
dotenv.config({
  path: path.join(__dirname, '.env'),
});

// Import app sau khi đã load biến môi trường.
const app = require('./app');

// Nếu chưa cấu hình PORT, sử dụng cổng 4000.
const portText = process.env.PORT || '4000';
const port = Number(portText);

if (
  !/^[0-9]+$/.test(portText) ||
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
) {
  throw new Error('PORT phải là số nguyên từ 1 đến 65535.');
}

// Khởi động server.
app.listen(port, () => {
  console.log(`Backend đang chạy tại http://localhost:${port}`);
});