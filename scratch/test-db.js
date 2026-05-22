import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('Connecting to database:', process.env.DATABASE_URL);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const resUsers = await pool.query('SELECT count(*) FROM users');
    console.log('Total users in DB:', resUsers.rows[0].count);

    const resOrders = await pool.query('SELECT count(*) FROM orders');
    console.log('Total orders in DB:', resOrders.rows[0].count);

    const offeredOrders = await pool.query("SELECT * FROM orders WHERE status = 'offered'");
    console.log('Offered orders:', offeredOrders.rows);
  } catch (err) {
    console.error('Database query error:', err);
  } finally {
    await pool.end();
  }
}

run();
