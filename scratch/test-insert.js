import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    // 1. Get a user from DB
    const userRes = await pool.query('SELECT phone FROM users LIMIT 1');
    if (userRes.rows.length === 0) {
      console.log('No users in DB, please seed or register a user first.');
      return;
    }
    const phone = userRes.rows[0].phone;
    console.log('Using user phone:', phone);

    // 2. Perform INSERT
    const orderCode = 'TEST-' + Date.now().toString().slice(-6);
    const orderStatus = 'offered';
    const totalAmount = 1000000;
    const commissionPercent = 10;
    const commissionAmount = 100000;
    const firstCategory = 'Mỹ Phẩm 10%';
    const statusNote = 'Test offered order';
    const note = 'Test push order';

    const orderRes = await pool.query(
      `INSERT INTO orders (
         order_code, phone, status, total_amount, principal_amount,
         commission_percent, commission_amount, category_name,
         status_note, note, created_by
       ) VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, 'admin')
       RETURNING id`,
      [
        orderCode,
        phone,
        orderStatus,
        totalAmount,
        commissionPercent,
        commissionAmount,
        firstCategory,
        statusNote,
        note,
      ]
    );

    console.log('Order inserted successfully, ID:', orderRes.rows[0].id);

    // Delete the test order afterwards
    await pool.query('DELETE FROM orders WHERE id = $1', [orderRes.rows[0].id]);
    console.log('Test order cleaned up.');
  } catch (err) {
    console.error('Database query error:', err);
  } finally {
    await pool.end();
  }
}

run();
