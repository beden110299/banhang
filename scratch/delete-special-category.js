import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('Connecting to database to remove "Đặc Biệt 70%" category and its products...');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    // 1. Delete products in 'Đặc Biệt 70%' category
    const deleteProductsRes = await pool.query(
      "DELETE FROM products WHERE category = 'Đặc Biệt 70%'"
    );
    console.log(`✅ Deleted ${deleteProductsRes.rowCount} products belonging to 'Đặc Biệt 70%'`);

    // 2. Delete the category itself
    const deleteCategoryRes = await pool.query(
      "DELETE FROM categories WHERE name = 'Đặc Biệt 70%'"
    );
    console.log(`✅ Deleted category 'Đặc Biệt 70%'. Success: ${deleteCategoryRes.rowCount > 0}`);

    console.log('🎉 DB update completed successfully! "Đặc Biệt 70%" has been permanently removed.');
  } catch (err) {
    console.error('Database update error:', err);
  } finally {
    await pool.end();
  }
}

run();
