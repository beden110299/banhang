import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import 'dotenv/config';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB file limit
});

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const port = process.env.PORT || 5000;

// Setup Neon Postgres Connection Pool
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
};

const pool = new Pool(poolConfig);

// Database queries wrapper
const db = {
  query: (text, params) => pool.query(text, params),
};

// Global System Cache to save Vercel serverless compute and Neon DB costs
const systemCache = {
  categories: null,
  products: null,
  storeName: null,
  sponsorCode: null,
  banners: null,
  cskh: null
};


// -------------------------------------------------------------
// DATABASE INITIALIZATION & SEEDING
// -------------------------------------------------------------
const initDatabase = async () => {
  // If DATABASE_URL is not set or has default placeholder, skip DB operations
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('YOUR_USER')) {
    console.warn('\n⚠️ DATABASE_URL is not configured yet! Please update the .env file with your Neon connection string.');
    console.warn('The API server will run, but database queries will be bypassed or return placeholders.\n');
    return;
  }

  try {
    console.log('⏳ Connecting to Neon Postgres and initializing database schemas...');

    // 1. Create Tables
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        phone VARCHAR(20) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    try {
      await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT FALSE');
      await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_categories TEXT DEFAULT 'Mỹ Phẩm 10%'");
      console.log('✅ users columns is_frozen and allowed_categories ready.');
    } catch (alterErr) {
      console.log('ℹ️ users column alteration skipped.', alterErr);
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        icon TEXT DEFAULT ''
      );
    `);

    try {
      await db.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT \'\'');
      console.log('✅ categories.icon column ready.');
    } catch (alterErr) {
      console.log('ℹ️ categories.icon column alteration skipped.');
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        category VARCHAR(100) NOT NULL,
        price BIGINT NOT NULL,
        description TEXT,
        icon TEXT DEFAULT '📦'
      );
    `);

    // Alter column to TEXT if it was VARCHAR(50) in an existing database
    try {
      await db.query('ALTER TABLE products ALTER COLUMN icon TYPE TEXT');
      console.log('✅ Migrated products.icon column type to TEXT.');
    } catch (alterErr) {
      console.log('ℹ️ products.icon column alteration skipped or already TEXT.');
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        phone VARCHAR(20) PRIMARY KEY REFERENCES users(phone) ON DELETE CASCADE,
        balance BIGINT NOT NULL DEFAULT 0
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdraw')),
        amount BIGINT NOT NULL CHECK (amount > 0),
        status VARCHAR(20) NOT NULL DEFAULT 'completed'
          CHECK (status IN ('pending', 'completed', 'rejected')),
        bank_name VARCHAR(100),
        account_number VARCHAR(50),
        account_holder VARCHAR(100),
        note TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_code VARCHAR(32) UNIQUE NOT NULL,
        phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'processing', 'shipping', 'completed', 'cancelled', 'rejected', 'offered')),
        total_amount BIGINT NOT NULL DEFAULT 0,
        principal_amount BIGINT NOT NULL DEFAULT 0,
        commission_percent INTEGER NOT NULL DEFAULT 0,
        commission_amount BIGINT NOT NULL DEFAULT 0,
        category_name VARCHAR(100) DEFAULT '',
        status_note TEXT DEFAULT '',
        note TEXT DEFAULT '',
        created_by VARCHAR(20) NOT NULL DEFAULT 'customer',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    try {
      await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS principal_amount BIGINT NOT NULL DEFAULT 0');
      await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission_percent INTEGER NOT NULL DEFAULT 0');
      await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission_amount BIGINT NOT NULL DEFAULT 0');
      await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS category_name VARCHAR(100) DEFAULT \'\'');
      await db.query('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check');
      await db.query(`
        ALTER TABLE orders ADD CONSTRAINT orders_status_check
        CHECK (status IN ('pending', 'processing', 'shipping', 'completed', 'cancelled', 'rejected', 'offered'))
      `);
      console.log('✅ orders commission columns ready.');
    } catch (alterErr) {
      console.log('ℹ️ orders schema migration skipped.');
    }

    try {
      await db.query('ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check');
      await db.query(`
        ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
        CHECK (type IN ('deposit', 'withdraw', 'purchase', 'order_refund', 'commission'))
      `);
      console.log('✅ wallet_transactions types extended.');
    } catch (alterErr) {
      console.log('ℹ️ wallet_transactions type migration skipped.');
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
        unit_price BIGINT NOT NULL CHECK (unit_price >= 0),
        product_icon TEXT DEFAULT '📦'
      );
    `);

    await db.query(`
      INSERT INTO wallets (phone, balance)
      SELECT phone, 0 FROM users
      ON CONFLICT (phone) DO NOTHING
    `);

    console.log('✅ Tables checked/created successfully.');

    // 2. Seed Default Settings (Sponsor Code)
    const sponsorCheck = await db.query("SELECT * FROM settings WHERE key = 'sponsor_code'");
    if (sponsorCheck.rows.length === 0) {
      await db.query("INSERT INTO settings (key, value) VALUES ('sponsor_code', 'CTV123')");
      console.log("🌱 Seeded default sponsor code: 'CTV123'");
    }

    const storeNameCheck = await db.query("SELECT * FROM settings WHERE key = 'store_name'");
    if (storeNameCheck.rows.length === 0) {
      await db.query("INSERT INTO settings (key, value) VALUES ('store_name', 'Miinto')");
      console.log("🌱 Seeded default store name: 'Miinto'");
    }

    const bannersCheck = await db.query("SELECT * FROM settings WHERE key = 'banners'");
    if (bannersCheck.rows.length === 0) {
      const defaultBanners = [
        {
          id: 1,
          imageUrl: "/banners/banner1.png",
          title: "Chào mừng đến Miinto",
          subtitle: "Khám phá bộ sưu tập sản phẩm nổi bật đa dạng - mua sắm tiện lợi!"
        },
        {
          id: 2,
          imageUrl: "/banners/banner2.png",
          title: "Ưu Đãi Đặc Biệt Hôm Nay",
          subtitle: "Giao hàng nhanh chóng, hoàn tiền chiết khấu hoa hồng cực cao!"
        }
      ];
      await db.query("INSERT INTO settings (key, value) VALUES ('banners', $1)", [JSON.stringify(defaultBanners)]);
      console.log("🌱 Seeded default banners slide list.");
    }

    const cskhTypeCheck = await db.query("SELECT * FROM settings WHERE key = 'cskh_type'");
    if (cskhTypeCheck.rows.length === 0) {
      await db.query("INSERT INTO settings (key, value) VALUES ('cskh_type', 'built_in')");
      console.log("🌱 Seeded default CSKH type: 'built_in'");
    }

    const cskhScriptCheck = await db.query("SELECT * FROM settings WHERE key = 'cskh_script'");
    if (cskhScriptCheck.rows.length === 0) {
      await db.query("INSERT INTO settings (key, value) VALUES ('cskh_script', '')");
      console.log("🌱 Seeded default CSKH script: ''");
    }

    // 3. Seed Default Admin User
    const adminCheck = await db.query("SELECT * FROM users WHERE phone = '0999999999'");
    if (adminCheck.rows.length === 0) {
      await db.query("INSERT INTO users (name, phone, password, role) VALUES ('Miinto Admin', '0999999999', 'admin123', 'admin')");
      console.log('🌱 Seeded master Admin account: 0999999999 / admin123');
    }

    // 4. Seed Categories (Only if the table is completely empty to prevent wiping products)
    const catCheck = await db.query("SELECT COUNT(*)::int AS count FROM categories");
    if (catCheck.rows[0].count === 0) {
      // Clear old categories and products to avoid reference mismatch
      await db.query('TRUNCATE products RESTART IDENTITY CASCADE');
      await db.query('TRUNCATE categories RESTART IDENTITY CASCADE');
      
      const defaultCats = ['Mỹ Phẩm 10%', 'Điện Tử 20%', 'Điện Lạnh 30%', 'VIP 50%'];
      for (const cat of defaultCats) {
        await db.query('INSERT INTO categories (name) VALUES ($1)', [cat]);
      }
      console.log('🌱 Re-seeded categories list to: Mỹ Phẩm 10%, Điện Tử 20%, Điện Lạnh 30%, VIP 50%.');
      
      // Reseed products with matching categories
      const defaultProducts = [
        {
          name: 'Son Môi Aura Premium Velvet',
          category: 'Mỹ Phẩm 10%',
          price: 1200000,
          desc: 'Son môi siêu mịn lì vỏ mạ vàng tinh tế, giữ màu lâu trôi, chiết xuất dưỡng chất tự nhiên.',
          icon: '💄'
        },
        {
          name: 'Serum Dưỡng Da Aura Collagen Gold',
          category: 'Mỹ Phẩm 10%',
          price: 2400000,
          desc: 'Tinh chất dưỡng trắng ngọc trai, phục hồi tế bào gốc và nâng cơ trẻ hóa da hiệu quả.',
          icon: '🧴'
        },
        {
          name: 'SoundAura Premium ANC Headphones',
          category: 'Điện Tử 20%',
          price: 6200000,
          desc: 'Tai nghe chống ồn chủ động cao cấp, chất lượng âm thanh studio chân thực, pin 40 giờ liên tục.',
          icon: '🎧'
        },
        {
          name: 'Ocular Horizon Smart Specs',
          category: 'Điện Tử 20%',
          price: 12500000,
          desc: 'Kính thực tế ảo tăng cường micro-OLED thông minh hiển thị dữ liệu thời gian thực đỉnh cao.',
          icon: '🕶️'
        },
        {
          name: 'Tủ Lạnh Aura Inverter Mirror Door',
          category: 'Điện Lạnh 30%',
          price: 34500000,
          desc: 'Tủ lạnh mặt kính gương đen sang trọng, công suất inverter tiết kiệm điện 5 sao, kháng khuẩn nano.',
          icon: '❄️'
        },
        {
          name: 'Điều Hòa Không Khí Aura WindFree',
          category: 'Điện Lạnh 30%',
          price: 18900000,
          desc: 'Điều hòa lọc bụi mịn siêu vi, làm lạnh êm dịu không gió buốt, điều khiển từ xa qua smartphone.',
          icon: '💨'
        },
        {
          name: 'Royal Oak Chronograph Gold Edition',
          category: 'VIP 50%',
          price: 425000000,
          desc: 'Siêu phẩm đồng hồ chế tác giới hạn, vỏ vàng nguyên khối 18K, tuyệt tác nghệ thuật Haute Horlogerie.',
          icon: '👑'
        },
        {
          name: 'Aura VIP Privilege Membership Card',
          category: 'VIP 50%',
          price: 50000000,
          desc: 'Thẻ thành viên VIP độc quyền Aura Store, đặc quyền hưởng ưu đãi giảm giá 30% và chăm sóc đặc biệt.',
          icon: '💳'
        }
      ];

      for (const p of defaultProducts) {
        await db.query(
          'INSERT INTO products (name, category, price, description, icon) VALUES ($1, $2, $3, $4, $5)',
          [p.name, p.category, p.price, p.desc, p.icon]
        );
      }
      console.log('🌱 Re-seeded luxury products for new categories.');
    }

    console.log('🚀 Neon Database is fully initialized and operational!');
  } catch (err) {
    console.error('❌ Failed to initialize Neon database:', err);
  }
};

// Test connection and run setup
initDatabase();

// Helper middleware to verify Neon connection string before operations
const checkDbConnection = (req, res, next) => {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('YOUR_USER')) {
    return res.status(503).json({
      error: 'Database not configured',
      message: 'Vui lòng cấu hình URL Neon Postgres của bạn trong tệp .env tại thư mục gốc của dự án.'
    });
  }
  next();
};

// -------------------------------------------------------------
// API ENDPOINTS
// -------------------------------------------------------------

// 1. AUTHENTICATION ROUTES

// Log in
app.post('/api/auth/login', checkDbConnection, async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: 'Nhập liệu', message: 'Vui lòng cung cấp số điện thoại và mật khẩu.' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Xác thực', message: 'Số điện thoại này chưa được đăng ký.' });
    }

    const user = result.rows[0];
    if (user.password !== password) {
      return res.status(401).json({ error: 'Xác thực', message: 'Mật khẩu đăng nhập không chính xác.' });
    }

    // Return user object (excluding password for security)
    res.json({
      name: user.name,
      phone: user.phone,
      role: user.role,
      is_frozen: user.is_frozen ?? false,
      allowed_categories: user.allowed_categories ?? 'Mỹ Phẩm 10%',
      created_at: user.created_at,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ', message: 'Đã xảy ra lỗi trong quá trình xác thực.' });
  }
});

// Register new account
app.post('/api/auth/register', checkDbConnection, async (req, res) => {
  const { name, phone, password, sponsorCode } = req.body;

  if (!name || !phone || !password || !sponsorCode) {
    return res.status(400).json({ error: 'Nhập liệu', message: 'Vui lòng cung cấp đầy đủ thông tin bắt buộc.' });
  }

  try {
    // 1. Verify active sponsor code
    const sponsorResult = await db.query("SELECT value FROM settings WHERE key = 'sponsor_code'");
    const activeSponsorCode = sponsorResult.rows[0]?.value || 'CTV123';

    if (sponsorCode !== activeSponsorCode) {
      return res.status(400).json({ error: 'Mã bảo lãnh', message: 'Mã bảo lãnh đăng ký không chính xác!' });
    }

    // 2. Check for duplicate phone
    const userCheck = await db.query('SELECT phone FROM users WHERE phone = $1', [phone]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Trùng số điện thoại', message: 'Số điện thoại này đã được đăng ký hệ thống.' });
    }

    // 3. Register user
    await db.query(
      "INSERT INTO users (name, phone, password, role, is_frozen, allowed_categories) VALUES ($1, $2, $3, $4, FALSE, 'Mỹ Phẩm 10%')",
      [name, phone, password, 'user']
    );
    await db.query(
      'INSERT INTO wallets (phone, balance) VALUES ($1, 0) ON CONFLICT (phone) DO NOTHING',
      [phone]
    );

    res.status(201).json({ success: true, message: 'Đăng ký tài khoản thành công.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ', message: 'Đã xảy ra lỗi trong quá trình đăng ký.' });
  }
});

// 2. SYSTEM SETTINGS ROUTES (Sponsor Code)

// Get active sponsor code
app.get('/api/settings/sponsor-code', checkDbConnection, async (req, res) => {
  try {
    if (systemCache.sponsorCode !== null) {
      return res.json({ sponsorCode: systemCache.sponsorCode });
    }
    const result = await db.query("SELECT value FROM settings WHERE key = 'sponsor_code'");
    const code = result.rows[0]?.value || 'CTV123';
    systemCache.sponsorCode = code;
    res.json({ sponsorCode: code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể đọc cấu hình mã bảo lãnh.' });
  }
});

// Update sponsor code (Admin only)
app.get('/api/settings/store-name', checkDbConnection, async (req, res) => {
  try {
    if (systemCache.storeName !== null) {
      return res.json({ storeName: systemCache.storeName });
    }
    const result = await db.query("SELECT value FROM settings WHERE key = 'store_name'");
    const name = result.rows[0]?.value || 'Miinto';
    systemCache.storeName = name;
    res.json({ storeName: name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể tải tên cửa hàng.' });
  }
});

app.post('/api/settings/store-name', checkDbConnection, async (req, res) => {
  const { storeName } = req.body;
  if (!storeName || !String(storeName).trim()) {
    return res.status(400).json({ error: 'Nhập liệu', message: 'Tên cửa hàng không được để trống.' });
  }
  const trimmed = String(storeName).trim().slice(0, 50);
  try {
    await db.query(
      `INSERT INTO settings (key, value) VALUES ('store_name', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [trimmed]
    );
    systemCache.storeName = trimmed; // Update cache
    res.json({ success: true, storeName: trimmed, message: 'Đã cập nhật tên cửa hàng.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể lưu tên cửa hàng.' });
  }
});

app.post('/api/settings/sponsor-code', checkDbConnection, async (req, res) => {
  const { newSponsorCode } = req.body;
  if (!newSponsorCode || !newSponsorCode.trim()) {
    return res.status(400).json({ error: 'Nhập liệu', message: 'Mã bảo lãnh mới không được bỏ trống.' });
  }

  try {
    await db.query("UPDATE settings SET value = $1 WHERE key = 'sponsor_code'", [newSponsorCode.trim()]);
    systemCache.sponsorCode = newSponsorCode.trim(); // Update cache
    res.json({ success: true, message: 'Đã cập nhật mã bảo lãnh thành công.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể cập nhật cấu hình mã bảo lãnh.' });
  }
});

// Get all banners
app.get('/api/settings/banners', checkDbConnection, async (req, res) => {
  try {
    if (systemCache.banners !== null) {
      return res.json(systemCache.banners);
    }
    const result = await db.query("SELECT value FROM settings WHERE key = 'banners'");
    let banners = [];
    if (result.rows.length > 0) {
      try {
        banners = JSON.parse(result.rows[0].value);
      } catch (e) {
        banners = [];
      }
    } else {
      banners = [
        {
          id: 1,
          imageUrl: "/banners/banner1.png",
          title: "Chào mừng đến Miinto",
          subtitle: "Khám phá bộ sưu tập sản phẩm nổi bật đa dạng - mua sắm tiện lợi!"
        },
        {
          id: 2,
          imageUrl: "/banners/banner2.png",
          title: "Ưu Đãi Đặc Biệt Hôm Nay",
          subtitle: "Giao hàng nhanh chóng, hoàn tiền chiết khấu hoa hồng cực cao!"
        }
      ];
    }
    systemCache.banners = banners;
    res.json(banners);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể tải danh sách banners.' });
  }
});

// Update banners (Admin only)
app.post('/api/settings/banners', checkDbConnection, async (req, res) => {
  const { banners } = req.body;
  if (!Array.isArray(banners)) {
    return res.status(400).json({ error: 'Nhập liệu', message: 'Danh sách banner phải là một mảng.' });
  }
  try {
    await db.query(
      `INSERT INTO settings (key, value) VALUES ('banners', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(banners)]
    );
    systemCache.banners = banners; // Update cache
    res.json({ success: true, banners, message: 'Đã cập nhật danh sách slide banner thành công.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể lưu danh sách banner.' });
  }
});

// Get CSKH Settings
app.get('/api/settings/cskh', checkDbConnection, async (req, res) => {
  try {
    if (systemCache.cskh !== null) {
      return res.json(systemCache.cskh);
    }
    const typeRes = await db.query("SELECT value FROM settings WHERE key = 'cskh_type'");
    const scriptRes = await db.query("SELECT value FROM settings WHERE key = 'cskh_script'");
    
    const cskh_type = typeRes.rows.length > 0 ? typeRes.rows[0].value : 'built_in';
    const cskh_script = scriptRes.rows.length > 0 ? scriptRes.rows[0].value : '';
    
    const settings = { cskh_type, cskh_script };
    systemCache.cskh = settings;
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể tải cấu hình CSKH.' });
  }
});

// Update CSKH Settings (Admin only)
app.post('/api/settings/cskh', checkDbConnection, async (req, res) => {
  const { cskh_type, cskh_script } = req.body;
  if (!cskh_type) {
    return res.status(400).json({ error: 'Nhập liệu', message: 'Loại CSKH không được bỏ trống.' });
  }
  try {
    await db.query(
      `INSERT INTO settings (key, value) VALUES ('cskh_type', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [cskh_type]
    );
    await db.query(
      `INSERT INTO settings (key, value) VALUES ('cskh_script', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [cskh_script || '']
    );
    
    const updatedSettings = { cskh_type, cskh_script: cskh_script || '' };
    systemCache.cskh = updatedSettings; // Update cache
    res.json({ success: true, settings: updatedSettings, message: 'Đã lưu cấu hình kênh chat CSKH thành công.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể lưu cấu hình CSKH.' });
  }
});

// 3. MEMBER MANAGEMENT ROUTES

// Fetch all members
app.get('/api/members', checkDbConnection, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT u.name, u.phone, u.role, u.is_frozen, u.allowed_categories, u.created_at,
             COALESCE(w.balance, 0)::bigint AS balance
      FROM users u
      LEFT JOIN wallets w ON w.phone = u.phone
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể tải danh sách thành viên.' });
  }
});

// Add member directly (Admin only)
app.post('/api/members', checkDbConnection, async (req, res) => {
  const { name, phone, password, role } = req.body;
  if (!name || !phone || !password || !role) {
    return res.status(400).json({ error: 'Nhập liệu', message: 'Vui lòng cung cấp đầy đủ thông tin thành viên.' });
  }

  try {
    const check = await db.query('SELECT phone FROM users WHERE phone = $1', [phone]);
    if (check.rows.length > 0) {
      return res.status(409).json({ error: 'Trùng lặp', message: 'Số điện thoại này đã đăng ký.' });
    }

    await db.query(
      "INSERT INTO users (name, phone, password, role, is_frozen, allowed_categories) VALUES ($1, $2, $3, $4, FALSE, 'Mỹ Phẩm 10%')",
      [name.trim(), phone.trim(), password, role]
    );
    await db.query(
      'INSERT INTO wallets (phone, balance) VALUES ($1, 0) ON CONFLICT (phone) DO NOTHING',
      [phone.trim()]
    );
    res.status(201).json({ success: true, message: 'Đã thêm thành viên mới.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể thêm thành viên mới.' });
  }
});

// Update member (Admin only)
app.put('/api/members/:phone', checkDbConnection, async (req, res) => {
  const originalPhone = req.params.phone;
  const { name, phone, password, role, balance, is_frozen, allowed_categories } = req.body;

  try {
    // Fetch existing user to support partial updates
    const userRes = await db.query('SELECT * FROM users WHERE phone = $1', [originalPhone]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy', message: 'Thành viên không tồn tại.' });
    }
    const user = userRes.rows[0];

    // Resolve fields (merge request payload with DB record)
    const finalName = name !== undefined ? name : user.name;
    const finalPhone = phone !== undefined ? phone : user.phone;
    const finalRole = role !== undefined ? role : user.role;

    if (!finalName || !finalPhone || !finalRole) {
      return res.status(400).json({ error: 'Nhập liệu', message: 'Thiếu thông tin cập nhật.' });
    }

    // If phone is changing, check duplicate
    if (finalPhone.trim() !== originalPhone) {
      const check = await db.query('SELECT phone FROM users WHERE phone = $1', [finalPhone.trim()]);
      if (check.rows.length > 0) {
        return res.status(409).json({ error: 'Trùng lặp', message: 'Số điện thoại mới đã được sử dụng.' });
      }
    }

    if (password) {
      await db.query(
        `UPDATE users 
         SET name = $1, phone = $2, password = $3, role = $4,
             is_frozen = COALESCE($5, is_frozen),
             allowed_categories = COALESCE($6, allowed_categories)
         WHERE phone = $7`,
        [
          finalName.trim(),
          finalPhone.trim(),
          password,
          finalRole,
          is_frozen !== undefined ? is_frozen : null,
          allowed_categories !== undefined ? allowed_categories : null,
          originalPhone
        ]
      );
    } else {
      await db.query(
        `UPDATE users 
         SET name = $1, phone = $2, role = $3,
             is_frozen = COALESCE($4, is_frozen),
             allowed_categories = COALESCE($5, allowed_categories)
         WHERE phone = $6`,
        [
          finalName.trim(),
          finalPhone.trim(),
          finalRole,
          is_frozen !== undefined ? is_frozen : null,
          allowed_categories !== undefined ? allowed_categories : null,
          originalPhone
        ]
      );
    }

    if (balance !== undefined && balance !== null && balance !== '') {
      const newBalance = Math.max(0, Math.floor(Number(balance)) || 0);
      const targetPhone = finalPhone.trim();
      await db.query(
        `INSERT INTO wallets (phone, balance) VALUES ($1, $2)
         ON CONFLICT (phone) DO UPDATE SET balance = EXCLUDED.balance`,
        [targetPhone, newBalance]
      );
    }

    res.json({ success: true, message: 'Đã cập nhật thông tin thành viên.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể chỉnh sửa thành viên.' });
  }
});

// Delete member (Admin only)
app.delete('/api/members/:phone', checkDbConnection, async (req, res) => {
  const phone = req.params.phone;
  if (phone === '0999999999') {
    return res.status(403).json({ error: 'Bảo mật', message: 'Không thể xóa tài khoản Quản trị hệ thống tối cao!' });
  }

  try {
    await db.query('DELETE FROM users WHERE phone = $1', [phone]);
    res.json({ success: true, message: 'Đã xóa thành viên khỏi hệ thống.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể xóa thành viên.' });
  }
});

// 4. CATEGORY MANAGEMENT ROUTES

// Fetch categories
app.get('/api/categories', checkDbConnection, async (req, res) => {
  try {
    if (systemCache.categories !== null) {
      return res.json(systemCache.categories);
    }
    const result = await db.query('SELECT name, icon FROM categories ORDER BY id ASC');
    const cats = result.rows.map((r) => ({
      name: r.name,
      icon: r.icon || '',
    }));
    systemCache.categories = cats;
    res.json(cats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể tải danh mục.' });
  }
});

// Add category
app.post('/api/categories', checkDbConnection, async (req, res) => {
  const { name, icon } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nhập liệu', message: 'Tên danh mục không được để trống.' });
  }

  try {
    const check = await db.query('SELECT name FROM categories WHERE LOWER(name) = LOWER($1)', [name.trim()]);
    if (check.rows.length > 0) {
      return res.status(409).json({ error: 'Trùng lặp', message: 'Tên danh mục này đã tồn tại.' });
    }

    await db.query('INSERT INTO categories (name, icon) VALUES ($1, $2)', [
      name.trim(),
      icon ? String(icon).trim() : '',
    ]);
    systemCache.categories = null; // Invalidate cache
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể thêm danh mục.' });
  }
});

// Update category and its dependencies in products
app.put('/api/categories', checkDbConnection, async (req, res) => {
  const { name, originalName, icon } = req.body;
  if (!name || !name.trim() || !originalName) {
    return res.status(400).json({ error: 'Nhập liệu', message: 'Thông tin thay đổi không hợp lệ.' });
  }

  try {
    if (name.trim().toLowerCase() !== originalName.toLowerCase()) {
      const check = await db.query('SELECT name FROM categories WHERE LOWER(name) = LOWER($1)', [name.trim()]);
      if (check.rows.length > 0) {
        return res.status(409).json({ error: 'Trùng lặp', message: 'Tên danh mục mới này đã tồn tại.' });
      }
    }

    await db.query('BEGIN');

    await db.query('UPDATE categories SET name = $1, icon = $2 WHERE name = $3', [
      name.trim(),
      icon !== undefined && icon !== null ? String(icon).trim() : '',
      originalName,
    ]);

    await db.query('UPDATE products SET category = $1 WHERE category = $2', [name.trim(), originalName]);

    await db.query('COMMIT');

    systemCache.categories = null; // Invalidate cache
    systemCache.products = null; // Invalidate products cache too as category changed
    res.json({ success: true });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể sửa đổi danh mục.' });
  }
});

// Delete category (if empty of products)
app.delete('/api/categories/:name', checkDbConnection, async (req, res) => {
  const name = req.params.name;
  try {
    // Check if category contains active products
    const check = await db.query('SELECT id FROM products WHERE category = $1 LIMIT 1', [name]);
    if (check.rows.length > 0) {
      return res.status(409).json({ error: 'Phụ thuộc', message: `Không thể xóa danh mục '${name}' vì đang chứa sản phẩm active.` });
    }

    await db.query('DELETE FROM categories WHERE name = $1', [name]);
    systemCache.categories = null; // Invalidate cache
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể xóa danh mục.' });
  }
});

// 5. PRODUCT MANAGEMENT ROUTES

// Fetch products
app.get('/api/products', checkDbConnection, async (req, res) => {
  try {
    if (systemCache.products !== null) {
      return res.json(systemCache.products);
    }
    const result = await db.query('SELECT id, name, category, price, description as desc, icon FROM products ORDER BY id DESC');
    const prods = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      price: Number(r.price),
      desc: r.desc || '',
      icon: r.icon
    }));
    systemCache.products = prods;
    res.json(prods);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể tải danh sách sản phẩm.' });
  }
});

// Add product
app.post('/api/products', checkDbConnection, async (req, res) => {
  const { name, category, price, desc, icon } = req.body;
  if (!name || !category || !price) {
    return res.status(400).json({ error: 'Nhập liệu', message: 'Vui lòng cung cấp đầy đủ tên, nhóm, và giá sản phẩm.' });
  }

  try {
    const check = await db.query('SELECT id FROM products WHERE LOWER(name) = LOWER($1)', [name.trim()]);
    if (check.rows.length > 0) {
      return res.status(409).json({ error: 'Trùng lặp', message: 'Tên sản phẩm này đã được sử dụng.' });
    }

    await db.query(
      'INSERT INTO products (name, category, price, description, icon) VALUES ($1, $2, $3, $4, $5)',
      [name.trim(), category, Number(price), desc ? desc.trim() : '', icon ? icon.trim() : '📦']
    );
    systemCache.products = null; // Invalidate cache
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể thêm sản phẩm.' });
  }
});

// Edit product
app.put('/api/products/:id', checkDbConnection, async (req, res) => {
  const id = Number(req.params.id);
  const { name, category, price, desc, icon } = req.body;

  if (!name || !category || !price) {
    return res.status(400).json({ error: 'Nhập liệu', message: 'Cung cấp thiếu thông tin cập nhật.' });
  }

  try {
    // Check duplicate name on other products
    const check = await db.query('SELECT id FROM products WHERE LOWER(name) = LOWER($1) AND id != $2', [name.trim(), id]);
    if (check.rows.length > 0) {
      return res.status(409).json({ error: 'Trùng lặp', message: 'Tên sản phẩm mới đã được sử dụng cho kệ hàng khác.' });
    }

    await db.query(
      'UPDATE products SET name = $1, category = $2, price = $3, description = $4, icon = $5 WHERE id = $6',
      [name.trim(), category, Number(price), desc ? desc.trim() : '', icon ? icon.trim() : '📦', id]
    );

    systemCache.products = null; // Invalidate cache
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể sửa đổi thông tin sản phẩm.' });
  }
});

// Delete product
app.delete('/api/products/:id', checkDbConnection, async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.query('DELETE FROM products WHERE id = $1', [id]);
    systemCache.products = null; // Invalidate cache
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể xóa sản phẩm.' });
  }
});

// 5b. WALLET ROUTES

const ensureWallet = async (phone) => {
  await db.query(
    'INSERT INTO wallets (phone, balance) VALUES ($1, 0) ON CONFLICT (phone) DO NOTHING',
    [phone]
  );
};

app.get('/api/wallet/:phone', checkDbConnection, async (req, res) => {
  const phone = req.params.phone;
  try {
    await ensureWallet(phone);
    const walletRes = await db.query('SELECT balance FROM wallets WHERE phone = $1', [phone]);
    const txRes = await db.query(
      `SELECT id, type, amount, status, bank_name, account_number, account_holder, note, created_at
       FROM wallet_transactions
       WHERE phone = $1
       ORDER BY created_at DESC
       LIMIT 80`,
      [phone]
    );
    const userRes = await db.query(
      'SELECT name, phone, role, is_frozen, allowed_categories, created_at FROM users WHERE phone = $1',
      [phone]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({
        error: 'Không tìm thấy',
        message: 'Tài khoản không tồn tại trên hệ thống.',
        code: 'USER_NOT_FOUND',
      });
    }
    res.json({
      user: userRes.rows[0],
      balance: Number(walletRes.rows[0]?.balance || 0),
      transactions: txRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể tải thông tin ví.' });
  }
});

app.post('/api/wallet/withdraw', checkDbConnection, async (req, res) => {
  const { phone, amount, bankName, accountNumber, accountHolder } = req.body;
  const withdrawAmount = Math.floor(Number(amount));

  if (!phone || !bankName?.trim() || !accountNumber?.trim() || !accountHolder?.trim()) {
    return res.status(400).json({
      error: 'Nhập liệu',
      message: 'Vui lòng nhập đầy đủ thông tin ngân hàng và số tiền rút.',
    });
  }
  if (!withdrawAmount || withdrawAmount < 10000) {
    return res.status(400).json({
      error: 'Số tiền',
      message: 'Số tiền rút tối thiểu là 10.000đ.',
    });
  }

  try {
    await ensureWallet(phone);

    // Check if user is frozen
    const userCheck = await db.query('SELECT is_frozen FROM users WHERE phone = $1', [phone]);
    if (userCheck.rows.length > 0 && userCheck.rows[0].is_frozen) {
      return res.status(403).json({
        error: 'Tài khoản bị đóng băng',
        message: 'Tài khoản của bạn đang bị đóng băng. Không thể thực hiện rút tiền.',
      });
    }

    const walletRes = await db.query('SELECT balance FROM wallets WHERE phone = $1', [phone]);
    const balance = Number(walletRes.rows[0]?.balance || 0);

    if (withdrawAmount > balance) {
      return res.status(400).json({
        error: 'Số dư',
        message: 'Số dư ví không đủ để thực hiện lệnh rút.',
      });
    }

    const pendingRes = await db.query(
      `SELECT id FROM wallet_transactions
       WHERE phone = $1 AND type = 'withdraw' AND status = 'pending' LIMIT 1`,
      [phone]
    );
    if (pendingRes.rows.length > 0) {
      return res.status(409).json({
        error: 'Đang xử lý',
        message: 'Bạn đang có yêu cầu rút tiền chờ duyệt. Vui lòng đợi CSKH xử lý.',
      });
    }

    const txRes = await db.query(
      `INSERT INTO wallet_transactions
        (phone, type, amount, status, bank_name, account_number, account_holder, note)
       VALUES ($1, 'withdraw', $2, 'pending', $3, $4, $5, $6)
       RETURNING *`,
      [
        phone,
        withdrawAmount,
        bankName.trim(),
        accountNumber.trim(),
        accountHolder.trim(),
        'Yêu cầu rút tiền — chờ duyệt',
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Đã gửi yêu cầu rút tiền. CSKH sẽ xử lý trong thời gian sớm nhất.',
      transaction: txRes.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể tạo yêu cầu rút tiền.' });
  }
});

app.post('/api/admin/wallet/deposit', checkDbConnection, async (req, res) => {
  const { phone, amount, note } = req.body;
  const depositAmount = Math.floor(Number(amount));

  if (!phone || !depositAmount || depositAmount < 1000) {
    return res.status(400).json({ error: 'Nhập liệu', message: 'Số tiền nạp không hợp lệ.' });
  }

  try {
    await ensureWallet(phone);
    await db.query('UPDATE wallets SET balance = balance + $1 WHERE phone = $2', [depositAmount, phone]);
    const txRes = await db.query(
      `INSERT INTO wallet_transactions (phone, type, amount, status, note)
       VALUES ($1, 'deposit', $2, 'completed', $3)
       RETURNING *`,
      [phone, depositAmount, note?.trim() || 'Nạp tiền — Admin xác nhận']
    );
    const walletRes = await db.query('SELECT balance FROM wallets WHERE phone = $1', [phone]);
    res.json({
      success: true,
      balance: Number(walletRes.rows[0].balance),
      transaction: txRes.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể nạp tiền.' });
  }
});

app.get('/api/admin/wallet/pending-withdrawals', checkDbConnection, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*, u.name AS user_name
       FROM wallet_transactions t
       JOIN users u ON u.phone = t.phone
       WHERE t.type = 'withdraw' AND t.status = 'pending'
       ORDER BY t.created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể tải yêu cầu rút tiền.' });
  }
});

app.post('/api/admin/wallet/withdraw/:id/approve', checkDbConnection, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const txRes = await db.query(
      `SELECT * FROM wallet_transactions WHERE id = $1 AND type = 'withdraw' AND status = 'pending'`,
      [id]
    );
    if (txRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy', message: 'Yêu cầu rút không tồn tại hoặc đã xử lý.' });
    }
    const tx = txRes.rows[0];
    const walletRes = await db.query('SELECT balance FROM wallets WHERE phone = $1', [tx.phone]);
    const balance = Number(walletRes.rows[0]?.balance || 0);
    if (tx.amount > balance) {
      return res.status(400).json({ error: 'Số dư', message: 'Số dư không đủ để duyệt lệnh rút.' });
    }
    await db.query('UPDATE wallets SET balance = balance - $1 WHERE phone = $2', [tx.amount, tx.phone]);
    await db.query(
      `UPDATE wallet_transactions SET status = 'completed', note = $1 WHERE id = $2`,
      ['Rút tiền — đã duyệt', id]
    );
    res.json({ success: true, message: 'Đã duyệt yêu cầu rút tiền.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể duyệt rút tiền.' });
  }
});

app.post('/api/admin/wallet/withdraw/:id/reject', checkDbConnection, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await db.query(
      `UPDATE wallet_transactions
       SET status = 'rejected', note = $1
       WHERE id = $2 AND type = 'withdraw' AND status = 'pending'
       RETURNING id`,
      ['Rút tiền — bị từ chối', id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy', message: 'Yêu cầu rút không tồn tại hoặc đã xử lý.' });
    }
    res.json({ success: true, message: 'Đã từ chối yêu cầu rút tiền.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể từ chối rút tiền.' });
  }
});

// 5c. ORDERS & ADMIN TRANSACTIONS

const ORDER_STATUSES = ['pending', 'processing', 'shipping', 'completed', 'cancelled', 'rejected', 'offered'];

const parseCategoryCommissionPercent = (categoryName) => {
  const match = String(categoryName || '').match(/(\d+)\s*%/);
  return match ? Number(match[1]) : 0;
};

const calcCommissionAmount = (principal, percent) =>
  Math.floor((Number(principal) * Number(percent)) / 100);

const getStoreOrderPrefix = async () => {
  const storeRes = await db.query("SELECT value FROM settings WHERE key = 'store_name'");
  const name = storeRes.rows[0]?.value || 'Miinto';
  const slug = String(name).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return (slug || 'SHOP').slice(0, 8);
};

const generateOrderCode = async () => {
  const prefix = await getStoreOrderPrefix();
  const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
  return `${prefix}-${suffix}`;
};

const mapOrderRows = (rows) =>
  rows.map((row) => ({
    id: row.id,
    order_code: row.order_code,
    phone: row.phone,
    user_name: row.user_name,
    status: row.status,
    total_amount: Number(row.total_amount),
    principal_amount: Number(row.principal_amount ?? row.total_amount ?? 0),
    commission_percent: Number(row.commission_percent || 0),
    commission_amount: Number(row.commission_amount || 0),
    category_name: row.category_name || '',
    status_note: row.status_note || '',
    note: row.note || '',
    created_by: row.created_by,
    created_at: row.created_at,
    items: Array.isArray(row.items) ? row.items : [],
  }));

const fetchOrdersQuery = (whereClause, params) => db.query(
  `SELECT o.id, o.order_code, o.phone, o.status, o.total_amount,
          o.principal_amount, o.commission_percent, o.commission_amount, o.category_name,
          o.status_note, o.note, o.created_by, o.created_at, u.name AS user_name,
          COALESCE(
            json_agg(
              json_build_object(
                'id', oi.id,
                'product_id', oi.product_id,
                'product_name', oi.product_name,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'product_icon', oi.product_icon
              ) ORDER BY oi.id
            ) FILTER (WHERE oi.id IS NOT NULL),
            '[]'::json
          ) AS items
   FROM orders o
   JOIN users u ON u.phone = o.phone
   LEFT JOIN order_items oi ON oi.order_id = o.id
   ${whereClause}
   GROUP BY o.id, u.name
   ORDER BY o.created_at DESC`,
  params
);

app.post('/api/orders/purchase', checkDbConnection, async (req, res) => {
  const { phone, productId, quantity } = req.body;
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));

  if (!phone?.trim() || !productId) {
    return res.status(400).json({ error: 'Nhập liệu', message: 'Thiếu thông tin mua hàng.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user is frozen or lacks category permissions
    const userResQuery = await client.query('SELECT is_frozen, allowed_categories FROM users WHERE phone = $1', [phone.trim()]);
    if (userResQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Người dùng', message: 'Tài khoản không tồn tại.' });
    }
    const user = userResQuery.rows[0];
    if (user.is_frozen) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Tài khoản bị đóng băng',
        message: 'Tài khoản của bạn đang bị đóng băng. Không thể thực hiện mua hàng.',
      });
    }

    const prodRes = await client.query(
      'SELECT id, name, category, price, icon FROM products WHERE id = $1',
      [Number(productId)]
    );
    if (prodRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sản phẩm', message: 'Sản phẩm không tồn tại.' });
    }
    const product = prodRes.rows[0];

    // Check category permission
    const allowedList = (user.allowed_categories || '').split(',').map(s => s.trim());
    if (!allowedList.includes(product.category)) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Quyền danh mục',
        message: 'Bạn không có quyền mua hàng khu vực này hãy liên hệ CSKH để được nâng cấp'
      });
    }

    const principal = Number(product.price) * qty;
    const commissionPercent = parseCategoryCommissionPercent(product.category);
    const commissionAmount = calcCommissionAmount(principal, commissionPercent);

    await client.query(
      'INSERT INTO wallets (phone, balance) VALUES ($1, 0) ON CONFLICT (phone) DO NOTHING',
      [phone.trim()]
    );
    const walletRes = await client.query(
      'SELECT balance FROM wallets WHERE phone = $1 FOR UPDATE',
      [phone.trim()]
    );
    const balance = Number(walletRes.rows[0]?.balance || 0);
    if (principal > balance) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Số dư',
        message: 'Số dư ví không đủ để thanh toán đơn hàng.',
      });
    }

    await client.query(
      'UPDATE wallets SET balance = balance - $1 WHERE phone = $2',
      [principal, phone.trim()]
    );

    const orderCode = await generateOrderCode();
    const orderRes = await client.query(
      `INSERT INTO orders (
         order_code, phone, status, total_amount, principal_amount,
         commission_percent, commission_amount, category_name,
         status_note, note, created_by
       ) VALUES ($1, $2, 'pending', $3, $3, $4, $5, $6, $7, $8, 'customer')
       RETURNING id`,
      [
        orderCode,
        phone.trim(),
        principal,
        commissionPercent,
        commissionAmount,
        product.category,
        'Đơn hàng chờ admin duyệt.',
        `Mua ${qty}x ${product.name}`,
      ]
    );
    const orderId = orderRes.rows[0].id;

    await client.query(
      `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, product_icon)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orderId, product.id, product.name, qty, product.price, product.icon || '📦']
    );

    await client.query(
      `INSERT INTO wallet_transactions (phone, type, amount, status, note)
       VALUES ($1, 'purchase', $2, 'completed', $3)`,
      [
        phone.trim(),
        principal,
        `Mua hàng — đơn ${orderCode} (trừ tiền gốc)`,
      ]
    );

    const newWalletRes = await client.query(
      'SELECT balance FROM wallets WHERE phone = $1',
      [phone.trim()]
    );

    await client.query('COMMIT');

    const fullRes = await fetchOrdersQuery('WHERE o.id = $1', [orderId]);
    res.status(201).json({
      success: true,
      message: 'Đặt mua thành công. Đơn hàng đang chờ admin duyệt.',
      balance: Number(newWalletRes.rows[0]?.balance || 0),
      order: mapOrderRows(fullRes.rows)[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể hoàn tất mua hàng.' });
  } finally {
    client.release();
  }
});

app.post('/api/orders/:id/confirm', checkDbConnection, async (req, res) => {
  const id = Number(req.params.id);
  const { phone } = req.body;

  if (!id || !phone?.trim()) {
    return res.status(400).json({ error: 'Nhập liệu', message: 'Thiếu thông tin xác nhận đơn.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Không tìm thấy', message: 'Đơn hàng không tồn tại.' });
    }
    const order = orderRes.rows[0];

    if (order.phone !== phone.trim()) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Quyền', message: 'Đơn hàng không thuộc tài khoản này.' });
    }
    if (order.status !== 'offered' || order.created_by !== 'admin') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Trạng thái',
        message: 'Đơn này không còn chờ xác nhận mua.',
      });
    }

    // Check if user is frozen or lacks category permissions
    const userResQuery = await client.query('SELECT is_frozen, allowed_categories FROM users WHERE phone = $1', [phone.trim()]);
    if (userResQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Người dùng', message: 'Tài khoản không tồn tại.' });
    }
    const user = userResQuery.rows[0];
    if (user.is_frozen) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Tài khoản bị đóng băng',
        message: 'Tài khoản của bạn đang bị đóng băng. Không thể thực hiện mua hàng.',
      });
    }

    // Check category permission
    const allowedList = (user.allowed_categories || '').split(',').map(s => s.trim());
    if (order.category_name && !allowedList.includes(order.category_name)) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Quyền danh mục',
        message: 'Bạn không có quyền mua hàng khu vực này hãy liên hệ CSKH để được nâng cấp'
      });
    }

    const principal = Number(order.principal_amount || order.total_amount);

    await client.query(
      'INSERT INTO wallets (phone, balance) VALUES ($1, 0) ON CONFLICT (phone) DO NOTHING',
      [phone.trim()]
    );
    const walletRes = await client.query(
      'SELECT balance FROM wallets WHERE phone = $1 FOR UPDATE',
      [phone.trim()]
    );
    const balance = Number(walletRes.rows[0]?.balance || 0);
    if (principal > balance) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Số dư',
        message: 'Số dư ví không đủ để thanh toán đơn hàng.',
      });
    }

    await client.query(
      'UPDATE wallets SET balance = balance - $1 WHERE phone = $2',
      [principal, phone.trim()]
    );

    await client.query(
      `UPDATE orders SET
         status = 'pending',
         created_by = 'customer',
         status_note = $1
       WHERE id = $2`,
      ['Đơn đã thanh toán — chờ admin duyệt.', id]
    );

    await client.query(
      `INSERT INTO wallet_transactions (phone, type, amount, status, note)
       VALUES ($1, 'purchase', $2, 'completed', $3)`,
      [
        phone.trim(),
        principal,
        `Mua đơn ${order.order_code} (xác nhận từ đơn admin đẩy)`,
      ]
    );

    const newWalletRes = await client.query(
      'SELECT balance FROM wallets WHERE phone = $1',
      [phone.trim()]
    );

    await client.query('COMMIT');

    const fullRes = await fetchOrdersQuery('WHERE o.id = $1', [id]);
    res.json({
      success: true,
      message: 'Đã thanh toán đơn. Đơn chờ admin duyệt.',
      balance: Number(newWalletRes.rows[0]?.balance || 0),
      order: mapOrderRows(fullRes.rows)[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể xác nhận mua đơn.' });
  } finally {
    client.release();
  }
});

app.get('/api/orders', checkDbConnection, async (req, res) => {
  const phone = req.query.phone?.trim();
  if (!phone) {
    return res.status(400).json({ error: 'Nhập liệu', message: 'Thiếu số điện thoại khách hàng.' });
  }
  try {
    const result = await fetchOrdersQuery('WHERE o.phone = $1', [phone]);
    res.json(mapOrderRows(result.rows));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể tải đơn hàng.' });
  }
});

app.get('/api/admin/orders', checkDbConnection, async (req, res) => {
  try {
    const result = await fetchOrdersQuery('', []);
    res.json(mapOrderRows(result.rows));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể tải danh sách đơn hàng.' });
  }
});

app.post('/api/admin/orders/push', checkDbConnection, async (req, res) => {
  const { phone, items } = req.body;
  const orderStatus = 'offered';
  const statusNote = 'Khách hàng đã đặt đơn hãy bấm mua để xử lý';
  const note = 'Đơn đẩy từ admin (chưa trừ ví)';

  if (!phone?.trim()) {
    return res.status(400).json({ error: 'Nhập liệu', message: 'Vui lòng chọn khách hàng.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Nhập liệu', message: 'Đơn hàng cần ít nhất một sản phẩm.' });
  }
  if (!ORDER_STATUSES.includes(orderStatus)) {
    return res.status(400).json({ error: 'Trạng thái', message: 'Trạng thái đơn hàng không hợp lệ.' });
  }

  try {
    const userRes = await db.query('SELECT phone FROM users WHERE phone = $1', [phone.trim()]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy', message: 'Khách hàng không tồn tại.' });
    }

    const lineItems = [];
    let totalAmount = 0;

    for (const raw of items) {
      const qty = Math.max(1, Math.floor(Number(raw.quantity) || 1));
      let productName = raw.productName?.trim();
      let unitPrice = Math.floor(Number(raw.unitPrice));
      let productIcon = raw.productIcon?.trim() || '📦';
      let productId = raw.productId ? Number(raw.productId) : null;

      if (raw.productId) {
        const prodRes = await db.query(
          'SELECT id, name, category, price, icon FROM products WHERE id = $1',
          [Number(raw.productId)]
        );
        if (prodRes.rows.length === 0) {
          return res.status(404).json({
            error: 'Sản phẩm',
            message: `Không tìm thấy sản phẩm ID ${raw.productId}.`,
          });
        }
        const p = prodRes.rows[0];
        productId = p.id;
        productName = p.name;
        unitPrice = Number(p.price);
        productIcon = p.icon || '📦';
        raw.categoryName = p.category;
      }

      if (!productName || Number.isNaN(unitPrice) || unitPrice < 0) {
        return res.status(400).json({
          error: 'Nhập liệu',
          message: 'Mỗi dòng sản phẩm cần tên và đơn giá hợp lệ.',
        });
      }

      const lineTotal = unitPrice * qty;
      totalAmount += lineTotal;
      lineItems.push({
        productId,
        productName,
        quantity: qty,
        unitPrice,
        productIcon,
        categoryName: raw.categoryName || '',
      });
    }

    const orderCode = await generateOrderCode();
    const firstCategory = lineItems[0]?.categoryName || '';
    const commissionPercent = parseCategoryCommissionPercent(firstCategory);
    const commissionAmount = calcCommissionAmount(totalAmount, commissionPercent);

    const orderRes = await db.query(
      `INSERT INTO orders (
         order_code, phone, status, total_amount, principal_amount,
         commission_percent, commission_amount, category_name,
         status_note, note, created_by
       ) VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, 'admin')
       RETURNING id`,
      [
        orderCode,
        phone.trim(),
        orderStatus,
        totalAmount,
        commissionPercent,
        commissionAmount,
        firstCategory,
        statusNote,
        note,
      ]
    );
    const orderId = orderRes.rows[0].id;

    for (const line of lineItems) {
      await db.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, product_icon)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, line.productId, line.productName, line.quantity, line.unitPrice, line.productIcon]
      );
    }

    const fullRes = await fetchOrdersQuery('WHERE o.id = $1', [orderId]);
    res.status(201).json({
      success: true,
      message: 'Đã đẩy đơn — khách xem tại Cửa hàng và bấm Mua để xử lý.',
      order: mapOrderRows(fullRes.rows)[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể tạo đơn hàng.' });
  }
});

app.put('/api/admin/orders/:id', checkDbConnection, async (req, res) => {
  const id = Number(req.params.id);
  const { status, statusNote, note } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Nhập liệu', message: 'Mã đơn không hợp lệ.' });
  }

  try {
    const existing = await db.query(
      'SELECT id, status, created_by FROM orders WHERE id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy', message: 'Đơn hàng không tồn tại.' });
    }
    const order = existing.rows[0];
    if (
      order.created_by === 'customer' &&
      order.status === 'pending' &&
      status &&
      ['completed', 'rejected'].includes(status)
    ) {
      return res.status(400).json({
        error: 'Duyệt đơn',
        message: 'Đơn mua của khách cần dùng nút Duyệt hoặc Từ chối để hoàn tiền ví đúng quy tắc.',
      });
    }

    if (status && !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Trạng thái', message: 'Trạng thái đơn hàng không hợp lệ.' });
    }

    await db.query(
      `UPDATE orders SET
         status = COALESCE($1, status),
         status_note = COALESCE($2, status_note),
         note = COALESCE($3, note)
       WHERE id = $4`,
      [
        status || null,
        statusNote !== undefined ? String(statusNote).trim() : null,
        note !== undefined ? String(note).trim() : null,
        id,
      ]
    );

    const fullRes = await fetchOrdersQuery('WHERE o.id = $1', [id]);
    res.json({
      success: true,
      order: mapOrderRows(fullRes.rows)[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể cập nhật đơn hàng.' });
  }
});

const settleCustomerOrder = async (orderId, approve) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderRes = await client.query(
      `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { error: { status: 404, message: 'Đơn hàng không tồn tại.' } };
    }
    const order = orderRes.rows[0];
    if (order.created_by !== 'customer') {
      await client.query('ROLLBACK');
      return { error: { status: 400, message: 'Chỉ duyệt đơn mua từ khách hàng.' } };
    }
    if (order.status !== 'pending') {
      await client.query('ROLLBACK');
      return { error: { status: 409, message: 'Đơn hàng đã được xử lý trước đó.' } };
    }

    const principal = Number(order.principal_amount || order.total_amount);
    const commission = Number(order.commission_amount || 0);
    const refundTotal = approve ? principal + commission : principal;

    await client.query(
      'UPDATE wallets SET balance = balance + $1 WHERE phone = $2',
      [refundTotal, order.phone]
    );

    await client.query(
      `INSERT INTO wallet_transactions (phone, type, amount, status, note)
       VALUES ($1, 'order_refund', $2, 'completed', $3)`,
      [
        order.phone,
        principal,
        approve
          ? `Hoàn tiền gốc — đơn ${order.order_code} (đã duyệt)`
          : `Hoàn tiền gốc — đơn ${order.order_code} (từ chối)`,
      ]
    );

    if (approve && commission > 0) {
      await client.query(
        `INSERT INTO wallet_transactions (phone, type, amount, status, note)
         VALUES ($1, 'commission', $2, 'completed', $3)`,
        [
          order.phone,
          commission,
          `Hoa hồng ${order.commission_percent}% — đơn ${order.order_code}`,
        ]
      );
    }

    const newStatus = approve ? 'completed' : 'rejected';
    const statusNote = approve
      ? `Đơn thành công. Đã hoàn ${principal.toLocaleString('vi-VN')}đ gốc + ${commission.toLocaleString('vi-VN')}đ hoa hồng (${order.commission_percent}%).`
      : `Đơn bị từ chối. Đã hoàn ${principal.toLocaleString('vi-VN')}đ tiền gốc.`;

    await client.query(
      `UPDATE orders SET status = $1, status_note = $2 WHERE id = $3`,
      [newStatus, statusNote, orderId]
    );

    await client.query('COMMIT');
    return { success: true, newStatus, refundTotal, principal, commission };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

app.post('/api/admin/orders/:id/approve', checkDbConnection, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await settleCustomerOrder(id, true);
    if (result.error) {
      return res.status(result.error.status).json({
        error: 'Không hợp lệ',
        message: result.error.message,
      });
    }
    const fullRes = await fetchOrdersQuery('WHERE o.id = $1', [id]);
    res.json({
      success: true,
      message: 'Đã duyệt đơn. Tiền gốc và hoa hồng đã hoàn vào ví khách.',
      order: mapOrderRows(fullRes.rows)[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể duyệt đơn hàng.' });
  }
});

app.post('/api/admin/orders/:id/reject', checkDbConnection, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await settleCustomerOrder(id, false);
    if (result.error) {
      return res.status(result.error.status).json({
        error: 'Không hợp lệ',
        message: result.error.message,
      });
    }
    const fullRes = await fetchOrdersQuery('WHERE o.id = $1', [id]);
    res.json({
      success: true,
      message: 'Đã từ chối đơn. Tiền gốc đã hoàn vào ví khách.',
      order: mapOrderRows(fullRes.rows)[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể từ chối đơn hàng.' });
  }
});

app.get('/api/admin/transactions', checkDbConnection, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.id, t.phone, t.type, t.amount, t.status, t.bank_name, t.account_number,
              t.account_holder, t.note, t.created_at, u.name AS user_name
       FROM wallet_transactions t
       JOIN users u ON u.phone = t.phone
       WHERE t.type IN ('deposit', 'withdraw')
       ORDER BY t.created_at DESC
       LIMIT 200`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể tải lịch sử giao dịch.' });
  }
});

app.post('/api/admin/system/reset-data', checkDbConnection, async (req, res) => {
  try {
    await db.query('BEGIN');
    await db.query('DELETE FROM order_items');
    await db.query('DELETE FROM orders');
    await db.query('DELETE FROM wallet_transactions');
    await db.query('UPDATE wallets SET balance = 0');
    await db.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Đã xóa toàn bộ dữ liệu nạp rút, đơn hàng và đặt lại số dư ví của toàn bộ thành viên về 0 thành công.'
    });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    console.error('Lỗi khi xóa dữ liệu hệ thống:', err);
    res.status(500).json({ error: 'Lỗi', message: 'Không thể xóa dữ liệu hệ thống.' });
  }
});

// 6. IMAGE UPLOAD ROUTE (Cloudflare R2 with Base64 Fallback)
app.post('/api/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Upload', message: 'Vui lòng cung cấp tệp hình ảnh để tải lên.' });
  }

  const { buffer, originalname, mimetype } = req.file;
  
  // Cloudflare R2 configuration from environment variables
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;
  
  if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME && R2_PUBLIC_URL) {
    try {
      const s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
      });

      const uploadFolder = req.query.folder === 'categories' ? 'categories' : 'products';
      const fileExt = originalname.split('.').pop() || 'png';
      const fileName = `${uploadFolder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

      await s3Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: fileName,
        Body: buffer,
        ContentType: mimetype,
        CacheControl: 'public, max-age=31536000', // 1 year cache
      }));

      // Cloudflare R2 public URL
      const publicUrl = `${R2_PUBLIC_URL.replace(/\/$/, '')}/${fileName}`;
      
      console.log(`☁️ Image uploaded successfully to Cloudflare R2: ${publicUrl}`);
      return res.json({
        success: true,
        url: publicUrl,
        provider: 'cloudflare_r2'
      });
    } catch (err) {
      console.error('❌ Failed to upload to Cloudflare R2, falling back to Base64:', err);
      // Degrade gracefully to base64
      const base64Data = buffer.toString('base64');
      const base64Url = `data:${mimetype};base64,${base64Data}`;
      return res.json({
        success: true,
        url: base64Url,
        provider: 'fallback_base64',
        message: 'Lỗi tải lên Cloudflare R2. Đã tự động chuyển đổi sang Base64.'
      });
    }
  } else {
    // If Cloudflare is not configured yet, convert to Base64 Data URL so the app remains fully functional
    console.log('ℹ️ Cloudflare R2 is not configured in .env. Falling back to Base64.');
    const base64Data = buffer.toString('base64');
    const base64Url = `data:${mimetype};base64,${base64Data}`;
    return res.json({
      success: true,
      url: base64Url,
      provider: 'fallback_base64',
      message: 'Chưa cấu hình Cloudflare R2 trong .env. Đã tự động chuyển đổi sang Base64.'
    });
  }
});

// -------------------------------------------------------------
// RUN SERVER & SERVE INTEGRATED FRONTEND
// -------------------------------------------------------------
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from Vite's production build folder 'dist'
app.use(express.static(path.join(__dirname, 'dist')));

// Catch-all middleware to serve the React SPA index.html for non-API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`\n🪐 Miinto API Server is running on port: http://localhost:${port}`);
  console.log(`💡 Serving client endpoints with secure database queries.`);
});
