/**
 * Seed 50 sample products per category and upload images to Cloudflare R2.
 * Usage: npm run seed:products
 */
import 'dotenv/config';
import pkg from 'pg';
import { getR2Config, uploadBufferToR2 } from './lib/r2-upload.js';

const { Pool } = pkg;
const PRODUCTS_PER_CATEGORY = 50;

const CATEGORY_CATALOG = {
  'Mỹ Phẩm 10%': {
    slug: 'my-pham',
    names: [
      'Son môi', 'Kem dưỡng da', 'Serum vitamin C', 'Sữa rửa mặt', 'Toner cấp ẩm',
      'Kem chống nắng', 'Mặt nạ collagen', 'Tẩy trang dịu nhẹ', 'Kem mắt', 'Xịt khoáng',
      'Dưỡng thể', 'Tẩy tế bào chết', 'Essence phục hồi', 'Kem nền', 'Phấn phủ',
      'Mascara', 'Kẻ mắt', 'Son bóng', 'Dưỡng môi', 'Tinh chất niacinamide',
    ],
    priceMin: 89_000,
    priceMax: 4_500_000,
    picKeyword: 'cosmetics',
  },
  'Điện Tử 20%': {
    slug: 'dien-tu',
    names: [
      'Tai nghe Bluetooth', 'Loa mini', 'Sạc nhanh', 'Cáp Type-C', 'Ốp lưng điện thoại',
      'Pin dự phòng', 'Chuột không dây', 'Bàn phím cơ', 'Webcam HD', 'Hub USB-C',
      'Đồng hồ thông minh', 'Vòng đeo tay', 'Mic thu âm', 'Giá đỡ laptop', 'Bàn di chuột',
      'Adapter HDMI', 'Thẻ nhớ', 'Ổ cứng SSD', 'Router WiFi', 'Camera an ninh',
    ],
    priceMin: 150_000,
    priceMax: 28_000_000,
    picKeyword: 'gadget',
  },
  'Điện Lạnh 30%': {
    slug: 'dien-lanh',
    names: [
      'Tủ lạnh inverter', 'Máy giặt cửa trước', 'Điều hòa 1HP', 'Máy lọc không khí',
      'Quạt điều hòa', 'Bình nóng lạnh', 'Lò vi sóng', 'Bếp từ', 'Máy hút mùi',
      'Tủ đông mini', 'Máy sấy quần áo', 'Quạt sưởi', 'Máy lọc nước', 'Ấm siêu tốc',
      'Nồi cơm điện', 'Máy xay sinh tố', 'Máy ép trái cây', 'Bàn ủi hơi nước',
      'Máy hút bụi', 'Robot hút bụi',
    ],
    priceMin: 890_000,
    priceMax: 45_000_000,
    picKeyword: 'appliance',
  },
  'VIP 50%': {
    slug: 'vip',
    names: [
      'Đồng hồ cao cấp', 'Túi xách da thật', 'Giày thương hiệu', 'Kính mát designer',
      'Ví da hand-made', 'Thắt lưng premium', 'Trang sức vàng', 'Nước hoa niche',
      'Bộ quà tặng VIP', 'Thẻ membership', 'Tai nghe flagship', 'Tablet cao cấp',
      'Laptop ultrabook', 'Máy ảnh mirrorless', 'Loa hi-end', 'Amply mini',
      'Ghế massage', 'Máy pha cà phê', 'Bộ ấm trà', 'Vali khung nhôm',
    ],
    priceMin: 8_000_000,
    priceMax: 480_000_000,
    picKeyword: 'luxury',
  },

};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function pickPrice(min, max, index) {
  const spread = max - min;
  const step = Math.floor(spread / PRODUCTS_PER_CATEGORY);
  return min + step * index + (index % 7) * 1_000;
}

function buildProductMeta(category, index, existingCount) {
  const cfg = CATEGORY_CATALOG[category] || {
    slug: slugify(category),
    names: ['Sản phẩm'],
    priceMin: 100_000,
    priceMax: 5_000_000,
    picKeyword: 'product',
  };
  const seq = existingCount + index + 1;
  const baseName = cfg.names[(seq - 1) % cfg.names.length];
  const variant = Math.floor((seq - 1) / cfg.names.length) + 1;
  const name =
    variant > 1
      ? `${baseName} Aura ${String(seq).padStart(2, '0')} (Bản ${variant})`
      : `${baseName} Aura ${String(seq).padStart(2, '0')}`;

  return {
    name,
    category,
    price: pickPrice(cfg.priceMin, cfg.priceMax, seq - 1),
    desc: `Sản phẩm mẫu ${category} — ${name}. Chất lượng chuẩn Aura Store, bảo hành chính hãng, giao nhanh toàn quốc.`,
    seed: `${cfg.slug}-${cfg.picKeyword}-${seq}`,
    r2Key: `products/samples/${cfg.slug}/${String(seq).padStart(3, '0')}.jpg`,
  };
}

async function downloadSampleImage(seed) {
  const url = `https://picsum.photos/seed/${encodeURIComponent(seed)}/480/480.jpg`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Không tải được ảnh (${res.status}) từ picsum: ${seed}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  return { buffer, contentType };
}

async function main() {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('YOUR_USER')) {
    console.error('❌ Chưa cấu hình DATABASE_URL trong .env');
    process.exit(1);
  }

  const r2 = getR2Config();
  if (!r2.ok) {
    console.warn('⚠️  Chưa cấu hình Cloudflare R2 trong .env. Sẽ tự động chuyển đổi ảnh sang Base64.');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log(`\n🌱 Bắt đầu seed: ${PRODUCTS_PER_CATEGORY} sản phẩm / danh mục → R2\n`);

  try {
    const catResult = await pool.query('SELECT name FROM categories ORDER BY id ASC');
    let categories = catResult.rows.map((r) => r.name);

    if (categories.length === 0) {
      const defaultCats = Object.keys(CATEGORY_CATALOG);
      for (const cat of defaultCats) {
        await pool.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [cat]);
      }
      categories = defaultCats;
      console.log('📁 Đã tạo danh mục mặc định.');
    }

    let totalInserted = 0;
    let totalUploaded = 0;

    for (const category of categories) {
      const countRes = await pool.query(
        'SELECT COUNT(*)::int AS count FROM products WHERE category = $1',
        [category]
      );
      const current = countRes.rows[0].count;
      const needed = Math.max(0, PRODUCTS_PER_CATEGORY - current);

      console.log(`\n📦 ${category}: hiện có ${current}, cần thêm ${needed}`);

      if (needed === 0) {
        continue;
      }

      for (let i = 0; i < needed; i++) {
        const meta = buildProductMeta(category, i, current);

        const dup = await pool.query(
          'SELECT id FROM products WHERE LOWER(name) = LOWER($1)',
          [meta.name]
        );
        if (dup.rows.length > 0) {
          console.log(`  ⏭️  Bỏ qua (trùng tên): ${meta.name}`);
          continue;
        }

        let iconUrl;
        try {
          const { buffer, contentType } = await downloadSampleImage(meta.seed);
          if (r2.ok) {
            iconUrl = await uploadBufferToR2(
              r2.client,
              r2.bucket,
              r2.publicBase,
              meta.r2Key,
              buffer,
              contentType
            );
            totalUploaded++;
          } else {
            const base64Data = buffer.toString('base64');
            iconUrl = `data:${contentType};base64,${base64Data}`;
            totalUploaded++;
          }
        } catch (imgErr) {
          console.error(`  ⚠️  Ảnh lỗi (${meta.name}): ${imgErr.message}`);
          iconUrl = '📦';
        }

        await pool.query(
          `INSERT INTO products (name, category, price, description, icon)
           VALUES ($1, $2, $3, $4, $5)`,
          [meta.name, meta.category, meta.price, meta.desc, iconUrl]
        );
        totalInserted++;

        if ((i + 1) % 10 === 0 || i === needed - 1) {
          console.log(`  ✅ ${i + 1}/${needed} — ${meta.name}`);
        }

        await sleep(120);
      }
    }

    const summary = await pool.query(
      `SELECT category, COUNT(*)::int AS count
       FROM products
       GROUP BY category
       ORDER BY category`
    );

    console.log('\n📊 Tổng kết theo danh mục:');
    for (const row of summary.rows) {
      console.log(`   • ${row.category}: ${row.count} sản phẩm`);
    }
    console.log(`\n✅ Hoàn tất: thêm ${totalInserted} sản phẩm, upload ${totalUploaded} ảnh lên R2.\n`);
  } catch (err) {
    console.error('❌ Seed thất bại:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
