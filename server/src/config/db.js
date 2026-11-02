require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  throw new Error(
    'Thiếu DATABASE_URL trong server/.env. Sao chép từ server/.env.example và dán connection string Neon/Postgres trước khi chạy server.'
  );
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('neon.tech') || connectionString.includes('azure')
    ? { rejectUnauthorized: false }
    : undefined,
});

module.exports = pool;