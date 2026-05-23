import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('Connecting to database for CSKH config update...');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    // 1. Check current settings
    const currentType = await pool.query("SELECT * FROM settings WHERE key = 'cskh_type'");
    const currentScript = await pool.query("SELECT * FROM settings WHERE key = 'cskh_script'");
    console.log('--- BEFORE UPDATE ---');
    console.log('Current cskh_type:', currentType.rows[0]?.value);
    console.log('Current cskh_script:', currentScript.rows[0]?.value);

    // 2. Perform updates
    const targetType = 'crisp';
    const targetScript = '67dded78-d7a6-4835-90e3-e8c9d58db3b6';

    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('cskh_type', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [targetType]
    );

    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('cskh_script', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [targetScript]
    );

    console.log('--- AFTER UPDATE ---');
    const updatedType = await pool.query("SELECT * FROM settings WHERE key = 'cskh_type'");
    const updatedScript = await pool.query("SELECT * FROM settings WHERE key = 'cskh_script'");
    console.log('Updated cskh_type:', updatedType.rows[0]?.value);
    console.log('Updated cskh_script:', updatedScript.rows[0]?.value);
    console.log('CSKH Config successfully updated in PostgreSQL database!');

  } catch (err) {
    console.error('Database update error:', err);
  } finally {
    await pool.end();
  }
}

run();
