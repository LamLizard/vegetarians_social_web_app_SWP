const pool = require('./db');

(async () => {
  try {
    const r = await pool.query('SELECT NOW() AS now, current_database() AS db');
    console.log('✅ Kết nối Neon thành công!');
    console.log('   Database :', r.rows[0].db);
    console.log('   Giờ DB   :', r.rows[0].now);
  } catch (err) {
    console.error('❌ Kết nối thất bại:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();