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
    const tables = ['users', 'categories', 'products', 'settings', 'wallets', 'wallet_transactions', 'orders', 'order_items'];
    for (const t of tables) {
      const res = await pool.query(`SELECT count(*) FROM ${t}`);
      console.log(`Table ${t}: ${res.rows[0].count} rows`);
    }
  } catch (err) {
    console.error('Database query error:', err);
  } finally {
    await pool.end();
  }
}

run();
