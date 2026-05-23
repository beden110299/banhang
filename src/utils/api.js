// -------------------------------------------------------------
// SECURE API GATEWAY WITH AUTOMATIC LOCALSTORAGE FALLBACK
// -------------------------------------------------------------

// Local storage seed fallbacks in case database connection is not established
const LOCAL_USERS = 'ecommerce_users';
const LOCAL_SPONSOR = 'ecommerce_sponsor_code';
const LOCAL_STORE_NAME = 'ecommerce_store_name';
const LOCAL_CATS = 'ecommerce_categories';
const LOCAL_PRODS = 'ecommerce_products';
const LOCAL_WALLETS = 'ecommerce_wallets';
const LOCAL_WALLET_TX = 'ecommerce_wallet_transactions';
const LOCAL_ORDERS = 'ecommerce_orders';

const DEFAULT_CATEGORIES = [
  { name: 'Mỹ Phẩm 10%', icon: '' },
  { name: 'Điện Tử 20%', icon: '' },
  { name: 'Điện Lạnh 30%', icon: '' },
  { name: 'VIP 50%', icon: '' },
];

export const normalizeCategories = (data) => {
  if (!Array.isArray(data)) return [];
  return data.map((c) => {
    if (typeof c === 'string') return { name: c, icon: '' };
    return { name: c.name, icon: c.icon || '' };
  });
};

const readLocalCategories = () =>
  normalizeCategories(JSON.parse(localStorage.getItem(LOCAL_CATS) || '[]'));

const writeLocalCategories = (categories) => {
  localStorage.setItem(LOCAL_CATS, JSON.stringify(normalizeCategories(categories)));
};
const DEFAULT_PRODUCTS = [
  { id: 1, name: 'Son Môi Aura Premium Velvet', category: 'Mỹ Phẩm 10%', price: 1200000, desc: 'Son môi siêu mịn lì vỏ mạ vàng tinh tế, giữ màu lâu trôi, chiết xuất dưỡng chất tự nhiên.', icon: '💄' },
  { id: 2, name: 'Serum Dưỡng Da Aura Collagen Gold', category: 'Mỹ Phẩm 10%', price: 2400000, desc: 'Tinh chất dưỡng trắng ngọc trai, phục hồi tế bào gốc và nâng cơ trẻ hóa da hiệu quả.', icon: '🧴' },
  { id: 3, name: 'SoundAura Premium ANC Headphones', category: 'Điện Tử 20%', price: 6200000, desc: 'Tai nghe chống ồn chủ động cao cấp, chất lượng âm thanh studio chân thực, pin 40 giờ liên tục.', icon: '🎧' },
  { id: 4, name: 'Ocular Horizon Smart Specs', category: 'Điện Tử 20%', price: 12500000, desc: 'Kính thực tế ảo tăng cường micro-OLED thông minh hiển thị dữ liệu thời gian thực đỉnh cao.', icon: '🕶️' },
  { id: 5, name: 'Tủ Lạnh Aura Inverter Mirror Door', category: 'Điện Lạnh 30%', price: 34500000, desc: 'Tủ lạnh mặt kính gương đen sang trọng, công suất inverter tiết kiệm điện 5 sao, kháng khuẩn nano.', icon: '❄️' },
  { id: 6, name: 'Điều Hòa Không Khí Aura WindFree', category: 'Điện Lạnh 30%', price: 18900000, desc: 'Điều hòa lọc bụi mịn siêu vi, làm lạnh êm dịu không gió buốt, điều khiển từ xa qua smartphone.', icon: '💨' },
  { id: 7, name: 'Royal Oak Chronograph Gold Edition', category: 'VIP 50%', price: 425000000, desc: 'Siêu phẩm đồng hồ chế tác giới hạn, vỏ vàng nguyên khối 18K, tuyệt tác nghệ thuật Haute Horlogerie.', icon: '👑' },
  { id: 8, name: 'Aura VIP Privilege Membership Card', category: 'VIP 50%', price: 50000000, desc: 'Thẻ thành viên VIP độc quyền Aura Store, đặc quyền hưởng ưu đãi giảm giá 30% và chăm sóc đặc biệt.', icon: '💳' }
];

// Helper to seed localStorage
const seedLocalStorage = () => {
  if (!localStorage.getItem(LOCAL_SPONSOR)) localStorage.setItem(LOCAL_SPONSOR, 'CTV123');
  if (!localStorage.getItem(LOCAL_STORE_NAME)) localStorage.setItem(LOCAL_STORE_NAME, 'Miinto');
  if (!localStorage.getItem(LOCAL_USERS)) {
    localStorage.setItem(LOCAL_USERS, JSON.stringify([
      { name: 'Khách hàng Miinto', phone: '0987654321', password: 'user123', role: 'user', is_frozen: false, allowed_categories: 'Mỹ Phẩm 10%' }
    ]));
  }
  
  // Migration check: If old categories exist, force update to new categories and products
  const currentCats = localStorage.getItem(LOCAL_CATS);
  if (!currentCats || !currentCats.includes('Mỹ Phẩm 10%')) {
    localStorage.setItem(LOCAL_CATS, JSON.stringify(DEFAULT_CATEGORIES));
    localStorage.setItem(LOCAL_PRODS, JSON.stringify(DEFAULT_PRODUCTS));
  }
};

// Execute seeding initially
seedLocalStorage();

// Parse custom API errors
const parseError = async (res) => {
  try {
    const data = await res.json();
    return data.message || data.error || 'Đã xảy ra lỗi không xác định.';
  } catch (e) {
    return `Lỗi HTTP ${res.status}: ${res.statusText}`;
  }
};

// Backend unreachable, route missing, or DB not configured
const shouldUseOfflineFallback = (res) => [404, 502, 503, 504].includes(res.status);

const readLocalWalletBalance = (phone) => {
  const wallets = JSON.parse(localStorage.getItem(LOCAL_WALLETS) || '{}');
  return Number(wallets[phone] || 0);
};

const readLocalWalletTransactions = (phone) => {
  const all = JSON.parse(localStorage.getItem(LOCAL_WALLET_TX) || '[]');
  return all
    .filter((t) => t.phone === phone)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

const walletOfflinePayload = (phone, sessionUser) => {
  const users = JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
  const stored = users.find((u) => u.phone === phone);
  const user = sessionUser || stored || { name: 'Khách', phone, role: 'user', is_frozen: false, allowed_categories: 'Mỹ Phẩm 10%' };
  return {
    user: {
      name: user.name,
      phone: user.phone,
      role: user.role,
      is_frozen: user.is_frozen ?? false,
      allowed_categories: user.allowed_categories ?? 'Mỹ Phẩm 10%',
      created_at: user.created_at,
    },
    balance: readLocalWalletBalance(phone),
    transactions: readLocalWalletTransactions(phone),
  };
};

const offlineLogin = (phone, password) => {
  if (phone === '0999999999' && password === 'admin123') {
    return { 
      name: 'Miinto Admin (Offline)', 
      phone: '0999999999', 
      role: 'admin', 
      is_frozen: false, 
      allowed_categories: 'Mỹ Phẩm 10%, Điện Tử 20%, Điện Lạnh 30%, VIP 50%' 
    };
  }
  const users = JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
  const user = users.find((u) => u.phone === phone);
  if (!user || user.password !== password) {
    throw new Error('Số điện thoại hoặc mật khẩu không chính xác.');
  }
  return { 
    name: user.name, 
    phone: user.phone, 
    role: user.role,
    is_frozen: user.is_frozen ?? false,
    allowed_categories: user.allowed_categories ?? 'Mỹ Phẩm 10%',
  };
};

export const api = {
  _isFallback: false,
  onFallbackChange: null,
  get isFallback() {
    return this._isFallback;
  },
  set isFallback(val) {
    const old = this._isFallback;
    this._isFallback = val;
    if (old !== val && typeof this.onFallbackChange === 'function') {
      this.onFallbackChange(val);
    }
  },

  // -------------------------------------------------------------
  // AUTHENTICATION API
  // -------------------------------------------------------------
  
  async login(phone, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });

      if (res.ok) {
        this.isFallback = false;
        return await res.json();
      }

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        return offlineLogin(phone, password);
      }

      const errMsg = await parseError(res);
      throw new Error(errMsg);
    } catch (err) {
      if (
        err.message.includes('Failed to fetch') ||
        err.message.includes('NetworkError') ||
        err.message.includes('502')
      ) {
        this.isFallback = true;
        return offlineLogin(phone, password);
      }
      throw err;
    }
  },

  async register(name, phone, password, sponsorCode) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, password, sponsorCode })
      });

      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        // Fallback local register
        const activeCode = localStorage.getItem(LOCAL_SPONSOR) || 'CTV123';
        if (sponsorCode !== activeCode) {
          throw new Error('Mã bảo lãnh đăng ký không chính xác (Chế độ Offline).');
        }
        const users = JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
        if (users.some(u => u.phone === phone) || phone === '0999999999') {
          throw new Error('Số điện thoại này đã được sử dụng (Chế độ Offline).');
        }
        users.push({ name, phone, password, role: 'user', is_frozen: false, allowed_categories: 'Mỹ Phẩm 10%' });
        localStorage.setItem(LOCAL_USERS, JSON.stringify(users));
        return { success: true };
      }

      const errMsg = await parseError(res);
      throw new Error(errMsg);
    } catch (err) {
      if (this.isFallback) {
        // Retry offline logic
        const activeCode = localStorage.getItem(LOCAL_SPONSOR) || 'CTV123';
        if (sponsorCode !== activeCode) {
          throw new Error('Mã bảo lãnh không đúng.');
        }
        const users = JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
        if (users.some(u => u.phone === phone) || phone === '0999999999') {
          throw new Error('Số điện thoại đã tồn tại.');
        }
        users.push({ name, phone, password, role: 'user', is_frozen: false, allowed_categories: 'Mỹ Phẩm 10%' });
        localStorage.setItem(LOCAL_USERS, JSON.stringify(users));
        return { success: true };
      }
      throw err;
    }
  },

  // -------------------------------------------------------------
  // SYSTEM SETTINGS / SPONSOR CODE
  // -------------------------------------------------------------

  async getSponsorCode() {
    try {
      const res = await fetch('/api/settings/sponsor-code');
      if (res.ok) {
        const data = await res.json();
        return data.sponsorCode;
      }
      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        return localStorage.getItem(LOCAL_SPONSOR) || 'CTV123';
      }
      return 'CTV123';
    } catch (e) {
      this.isFallback = true;
      return localStorage.getItem(LOCAL_SPONSOR) || 'CTV123';
    }
  },

  async getStoreName() {
    try {
      const res = await fetch('/api/settings/store-name');
      if (res.ok) {
        const data = await res.json();
        const name = data.storeName || 'Miinto';
        localStorage.setItem(LOCAL_STORE_NAME, name);
        return name;
      }
      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        return localStorage.getItem(LOCAL_STORE_NAME) || 'Miinto';
      }
      return 'Miinto';
    } catch (e) {
      this.isFallback = true;
      return localStorage.getItem(LOCAL_STORE_NAME) || 'Miinto';
    }
  },

  async updateStoreName(storeName) {
    try {
      const res = await fetch('/api/settings/store-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(LOCAL_STORE_NAME, data.storeName);
        return data;
      }

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        localStorage.setItem(LOCAL_STORE_NAME, storeName.trim());
        return { success: true, storeName: storeName.trim() };
      }

      const errMsg = await parseError(res);
      throw new Error(errMsg);
    } catch (err) {
      if (this.isFallback) {
        localStorage.setItem(LOCAL_STORE_NAME, storeName.trim());
        return { success: true, storeName: storeName.trim() };
      }
      throw err;
    }
  },

  async updateSponsorCode(newSponsorCode) {
    try {
      const res = await fetch('/api/settings/sponsor-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newSponsorCode })
      });

      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        localStorage.setItem(LOCAL_SPONSOR, newSponsorCode);
        return { success: true };
      }

      const errMsg = await parseError(res);
      throw new Error(errMsg);
    } catch (err) {
      if (this.isFallback) {
        localStorage.setItem(LOCAL_SPONSOR, newSponsorCode);
        return { success: true };
      }
      throw err;
    }
  },

  async getBanners() {
    try {
      const res = await fetch('/api/settings/banners');
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('ecommerce_banners', JSON.stringify(data));
        return data;
      }
      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        return JSON.parse(localStorage.getItem('ecommerce_banners') || '[]');
      }
      return [];
    } catch (e) {
      this.isFallback = true;
      return JSON.parse(localStorage.getItem('ecommerce_banners') || '[]');
    }
  },

  async updateBanners(banners) {
    try {
      const res = await fetch('/api/settings/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banners }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('ecommerce_banners', JSON.stringify(data.banners));
        return data;
      }

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        localStorage.setItem('ecommerce_banners', JSON.stringify(banners));
        return { success: true, banners };
      }

      const errMsg = await parseError(res);
      throw new Error(errMsg);
    } catch (err) {
      if (this.isFallback) {
        localStorage.setItem('ecommerce_banners', JSON.stringify(banners));
        return { success: true, banners };
      }
      throw err;
    }
  },

  async getCSKHSettings() {
    try {
      const res = await fetch('/api/settings/cskh');
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('ecommerce_cskh_settings', JSON.stringify(data));
        return data;
      }
      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        return JSON.parse(localStorage.getItem('ecommerce_cskh_settings') || '{"cskh_type":"built_in","cskh_script":""}');
      }
      return { cskh_type: 'built_in', cskh_script: '' };
    } catch (e) {
      this.isFallback = true;
      return JSON.parse(localStorage.getItem('ecommerce_cskh_settings') || '{"cskh_type":"built_in","cskh_script":""}');
    }
  },

  async updateCSKHSettings(settings) {
    try {
      const res = await fetch('/api/settings/cskh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('ecommerce_cskh_settings', JSON.stringify(data.settings));
        return data;
      }

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        localStorage.setItem('ecommerce_cskh_settings', JSON.stringify(settings));
        return { success: true, settings };
      }

      const errMsg = await parseError(res);
      throw new Error(errMsg);
    } catch (err) {
      if (this.isFallback) {
        localStorage.setItem('ecommerce_cskh_settings', JSON.stringify(settings));
        return { success: true, settings };
      }
      throw err;
    }
  },

  // -------------------------------------------------------------
  // MEMBERS MANAGEMENT API
  // -------------------------------------------------------------

  async getMembers() {
    try {
      const res = await fetch('/api/members');
      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        return JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
      }
      return [];
    } catch (e) {
      this.isFallback = true;
      return JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
    }
  },

  async addMember(member) {
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member)
      });

      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        const users = JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
        if (users.some(u => u.phone === member.phone) || member.phone === '0999999999') {
          throw new Error('Số điện thoại này đã tồn tại.');
        }
        users.push(member);
        localStorage.setItem(LOCAL_USERS, JSON.stringify(users));
        return { success: true };
      }

      const errMsg = await parseError(res);
      throw new Error(errMsg);
    } catch (err) {
      if (this.isFallback) {
        const users = JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
        if (users.some(u => u.phone === member.phone)) throw new Error('Số điện thoại này đã đăng ký.');
        users.push(member);
        localStorage.setItem(LOCAL_USERS, JSON.stringify(users));
        return { success: true };
      }
      throw err;
    }
  },

  async updateMember(originalPhone, member) {
    try {
      const res = await fetch(`/api/members/${originalPhone}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member)
      });

      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        const users = JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
        if (member.phone !== originalPhone) {
          if (users.some(u => u.phone === member.phone) || member.phone === '0999999999') {
            throw new Error('Số điện thoại mới đã tồn tại.');
          }
        }
        const updated = users.map(u => u.phone === originalPhone ? { ...u, ...member } : u);
        localStorage.setItem(LOCAL_USERS, JSON.stringify(updated));
        return { success: true };
      }

      const errMsg = await parseError(res);
      throw new Error(errMsg);
    } catch (err) {
      if (this.isFallback) {
        const users = JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
        const updated = users.map(u => u.phone === originalPhone ? { ...u, ...member } : u);
        localStorage.setItem(LOCAL_USERS, JSON.stringify(updated));
        return { success: true };
      }
      throw err;
    }
  },

  async deleteMember(phone) {
    try {
      const res = await fetch(`/api/members/${phone}`, {
        method: 'DELETE'
      });

      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        const users = JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
        const filtered = users.filter(u => u.phone !== phone);
        localStorage.setItem(LOCAL_USERS, JSON.stringify(filtered));
        return { success: true };
      }

      const errMsg = await parseError(res);
      throw new Error(errMsg);
    } catch (err) {
      if (this.isFallback) {
        const users = JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
        const filtered = users.filter(u => u.phone !== phone);
        localStorage.setItem(LOCAL_USERS, JSON.stringify(filtered));
        return { success: true };
      }
      throw err;
    }
  },

  // -------------------------------------------------------------
  // CATEGORIES MANAGEMENT API
  // -------------------------------------------------------------

  async getCategories() {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) return normalizeCategories(await res.json());

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        return readLocalCategories();
      }
      return [];
    } catch (e) {
      this.isFallback = true;
      return readLocalCategories();
    }
  },

  async addCategory(name, icon = '') {
    const payload = { name: name.trim(), icon: icon ? String(icon).trim() : '' };
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        const cats = readLocalCategories();
        if (cats.some((c) => c.name.toLowerCase() === payload.name.toLowerCase())) {
          throw new Error('Danh mục này đã tồn tại.');
        }
        cats.push(payload);
        writeLocalCategories(cats);
        return { success: true };
      }

      const errMsg = await parseError(res);
      throw new Error(errMsg);
    } catch (err) {
      if (this.isFallback) {
        const cats = readLocalCategories();
        cats.push(payload);
        writeLocalCategories(cats);
        return { success: true };
      }
      throw err;
    }
  },

  async updateCategory(name, originalName, icon = '') {
    const payload = {
      name: name.trim(),
      originalName,
      icon: icon !== undefined && icon !== null ? String(icon).trim() : '',
    };
    try {
      const res = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        const cats = readLocalCategories();
        const updatedCats = cats.map((c) =>
          c.name === originalName ? { name: payload.name, icon: payload.icon } : c
        );
        writeLocalCategories(updatedCats);

        const prods = JSON.parse(localStorage.getItem(LOCAL_PRODS) || '[]');
        const updatedProds = prods.map((p) =>
          p.category === originalName ? { ...p, category: payload.name } : p
        );
        localStorage.setItem(LOCAL_PRODS, JSON.stringify(updatedProds));
        return { success: true };
      }

      const errMsg = await parseError(res);
      throw new Error(errMsg);
    } catch (err) {
      if (this.isFallback) {
        const cats = readLocalCategories();
        const updatedCats = cats.map((c) =>
          c.name === originalName ? { name: payload.name, icon: payload.icon } : c
        );
        writeLocalCategories(updatedCats);
        return { success: true };
      }
      throw err;
    }
  },

  async deleteCategory(name) {
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });

      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        const prods = JSON.parse(localStorage.getItem(LOCAL_PRODS) || '[]');
        if (prods.some((p) => p.category === name)) {
          throw new Error('Không thể xóa danh mục vì đang chứa sản phẩm.');
        }
        writeLocalCategories(readLocalCategories().filter((c) => c.name !== name));
        return { success: true };
      }

      const errMsg = await parseError(res);
      throw new Error(errMsg);
    } catch (err) {
      if (this.isFallback) {
        writeLocalCategories(readLocalCategories().filter((c) => c.name !== name));
        return { success: true };
      }
      throw err;
    }
  },

  // -------------------------------------------------------------
  // PRODUCTS MANAGEMENT API
  // -------------------------------------------------------------

  async getProducts() {
    try {
      const res = await fetch('/api/products');
      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        return JSON.parse(localStorage.getItem(LOCAL_PRODS) || '[]');
      }
      return [];
    } catch (e) {
      this.isFallback = true;
      return JSON.parse(localStorage.getItem(LOCAL_PRODS) || '[]');
    }
  },

  async addProduct(product) {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });

      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        const prods = JSON.parse(localStorage.getItem(LOCAL_PRODS) || '[]');
        if (prods.some(p => p.name.toLowerCase() === product.name.trim().toLowerCase())) {
          throw new Error('Sản phẩm này đã tồn tại trên kệ.');
        }
        const newProduct = {
          ...product,
          id: Date.now(),
          price: Number(product.price)
        };
        prods.push(newProduct);
        localStorage.setItem(LOCAL_PRODS, JSON.stringify(prods));
        return { success: true };
      }

      const errMsg = await parseError(res);
      throw new Error(errMsg);
    } catch (err) {
      if (this.isFallback) {
        const prods = JSON.parse(localStorage.getItem(LOCAL_PRODS) || '[]');
        prods.push({ ...product, id: Date.now(), price: Number(product.price) });
        localStorage.setItem(LOCAL_PRODS, JSON.stringify(prods));
        return { success: true };
      }
      throw err;
    }
  },

  async updateProduct(id, product) {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });

      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        const prods = JSON.parse(localStorage.getItem(LOCAL_PRODS) || '[]');
        const updated = prods.map(p => p.id === id ? { ...p, ...product, price: Number(product.price) } : p);
        localStorage.setItem(LOCAL_PRODS, JSON.stringify(updated));
        return { success: true };
      }

      const errMsg = await parseError(res);
      throw new Error(errMsg);
    } catch (err) {
      if (this.isFallback) {
        const prods = JSON.parse(localStorage.getItem(LOCAL_PRODS) || '[]');
        const updated = prods.map(p => p.id === id ? { ...p, ...product, price: Number(product.price) } : p);
        localStorage.setItem(LOCAL_PRODS, JSON.stringify(updated));
        return { success: true };
      }
      throw err;
    }
  },

  async deleteProduct(id) {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        const prods = JSON.parse(localStorage.getItem(LOCAL_PRODS) || '[]');
        const filtered = prods.filter(p => p.id !== id);
        localStorage.setItem(LOCAL_PRODS, JSON.stringify(filtered));
        return { success: true };
      }

      const errMsg = await parseError(res);
      throw new Error(errMsg);
    } catch (err) {
      if (this.isFallback) {
        const prods = JSON.parse(localStorage.getItem(LOCAL_PRODS) || '[]');
        const filtered = prods.filter(p => p.id !== id);
        localStorage.setItem(LOCAL_PRODS, JSON.stringify(filtered));
        return { success: true };
      }
      throw err;
    }
  },

  async uploadImage(fileFile, folder = 'products') {
    const uploadFolder = folder === 'categories' ? 'categories' : 'products';
    try {
      const formData = new FormData();
      formData.append('image', fileFile);

      const res = await fetch(`/api/upload?folder=${uploadFolder}`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        return await res.json();
      }

      if (shouldUseOfflineFallback(res)) {
        // Local fallback: convert file to Base64 in frontend
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(fileFile);
          reader.onload = () => resolve({
            success: true,
            url: reader.result,
            provider: 'frontend_base64',
            message: 'Chạy chế độ Offline. Đã tự động chuyển đổi ảnh sang Base64 trên trình duyệt.'
          });
          reader.onerror = error => reject(error);
        });
      }

      const errMsg = await parseError(res);
      throw new Error(errMsg);
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        // Frontend offline fallback
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(fileFile);
          reader.onload = () => resolve({
            success: true,
            url: reader.result,
            provider: 'frontend_base64',
            message: 'Không thể kết nối máy chủ. Đã tự động chuyển đổi ảnh sang Base64.'
          });
          reader.onerror = error => reject(error);
        });
      }
      throw err;
    }
  },

  // -------------------------------------------------------------
  // WALLET API
  // -------------------------------------------------------------

  _getLocalWallet(phone) {
    return readLocalWalletBalance(phone);
  },

  _setLocalWallet(phone, balance) {
    const wallets = JSON.parse(localStorage.getItem(LOCAL_WALLETS) || '{}');
    wallets[phone] = balance;
    localStorage.setItem(LOCAL_WALLETS, JSON.stringify(wallets));
  },

  _getLocalTransactions(phone) {
    return readLocalWalletTransactions(phone);
  },

  _addLocalTransaction(tx) {
    const all = JSON.parse(localStorage.getItem(LOCAL_WALLET_TX) || '[]');
    all.unshift({
      ...tx,
      id: tx.id || Date.now(),
      created_at: tx.created_at || new Date().toISOString(),
    });
    localStorage.setItem(LOCAL_WALLET_TX, JSON.stringify(all));
  },

  _settleLocalWithdraw(id, approve) {
    const allTx = JSON.parse(localStorage.getItem(LOCAL_WALLET_TX) || '[]');
    const txIndex = allTx.findIndex((t) => String(t.id) === String(id));
    if (txIndex === -1) throw new Error('Không tìm thấy yêu cầu rút tiền (Offline).');
    const tx = allTx[txIndex];
    if (tx.type !== 'withdraw' || tx.status !== 'pending') {
      throw new Error('Yêu cầu không hợp lệ hoặc đã được xử lý (Offline).');
    }
    
    if (approve) {
      const balance = this._getLocalWallet(tx.phone);
      if (tx.amount > balance) throw new Error('Số dư không đủ để duyệt rút tiền (Offline).');
      this._setLocalWallet(tx.phone, balance - tx.amount);
      tx.status = 'completed';
      tx.note = 'Rút tiền — đã duyệt (Offline)';
    } else {
      tx.status = 'rejected';
      tx.note = 'Rút tiền — bị từ chối (Offline)';
    }
    allTx[txIndex] = tx;
    localStorage.setItem(LOCAL_WALLET_TX, JSON.stringify(allTx));
    return { success: true };
  },

  async getWallet(phone, sessionUser = null) {
    try {
      const res = await fetch(`/api/wallet/${encodeURIComponent(phone)}`);
      if (res.ok) {
        this.isFallback = false;
        return await res.json();
      }
      if (shouldUseOfflineFallback(res) && sessionUser) {
        this.isFallback = true;
        return walletOfflinePayload(phone, sessionUser);
      }
      throw new Error(await parseError(res));
    } catch (err) {
      if (
        sessionUser &&
        (err.message.includes('Failed to fetch') ||
          err.message.includes('502') ||
          err.message.includes('404'))
      ) {
        this.isFallback = true;
        return walletOfflinePayload(phone, sessionUser);
      }
      throw err;
    }
  },

  async requestWithdraw({ phone, amount, bankName, accountNumber, accountHolder }) {
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount, bankName, accountNumber, accountHolder }),
      });
      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        const users = JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
        const user = users.find((u) => u.phone === phone);
        if (user && user.is_frozen) {
          throw new Error('Tài khoản của bạn đang bị đóng băng. Không thể thực hiện rút tiền.');
        }
        const withdrawAmount = Math.floor(Number(amount));
        const balance = this._getLocalWallet(phone);
        if (withdrawAmount > balance) throw new Error('Số dư ví không đủ (Offline).');
        const pending = this._getLocalTransactions(phone).some(
          (t) => t.type === 'withdraw' && t.status === 'pending'
        );
        if (pending) throw new Error('Bạn đang có yêu cầu rút chờ duyệt (Offline).');
        this._addLocalTransaction({
          phone,
          type: 'withdraw',
          amount: withdrawAmount,
          status: 'pending',
          bank_name: bankName,
          account_number: accountNumber,
          account_holder: accountHolder,
          note: 'Yêu cầu rút tiền — chờ duyệt',
        });
        return { success: true, message: 'Đã gửi yêu cầu rút (Offline).' };
      }
      throw new Error(await parseError(res));
    } catch (err) {
      if (this.isFallback) throw err;
      if (err.message.includes('Failed to fetch') || err.message.includes('502')) {
        this.isFallback = true;
        return this.requestWithdraw({ phone, amount, bankName, accountNumber, accountHolder });
      }
      throw err;
    }
  },

  async adminDeposit(phone, amount, note) {
    try {
      const res = await fetch('/api/admin/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount, note }),
      });
      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        const depAmount = Math.floor(Number(amount));
        const balance = this._getLocalWallet(phone);
        this._setLocalWallet(phone, balance + depAmount);
        const tx = {
          phone,
          type: 'deposit',
          amount: depAmount,
          status: 'completed',
          note: note?.trim() || 'Nạp tiền — Admin xác nhận (Offline)',
        };
        this._addLocalTransaction(tx);
        return { success: true, balance: balance + depAmount, transaction: tx };
      }
      throw new Error(await parseError(res));
    } catch (err) {
      if (this.isFallback) {
        const depAmount = Math.floor(Number(amount));
        const balance = this._getLocalWallet(phone);
        this._setLocalWallet(phone, balance + depAmount);
        const tx = {
          phone,
          type: 'deposit',
          amount: depAmount,
          status: 'completed',
          note: note?.trim() || 'Nạp tiền — Admin xác nhận (Offline)',
        };
        this._addLocalTransaction(tx);
        return { success: true, balance: balance + depAmount, transaction: tx };
      }
      throw err;
    }
  },

  async getPendingWithdrawals() {
    try {
      const res = await fetch('/api/admin/wallet/pending-withdrawals');
      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        const users = JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
        const allTx = JSON.parse(localStorage.getItem(LOCAL_WALLET_TX) || '[]');
        return allTx
          .filter((t) => t.type === 'withdraw' && t.status === 'pending')
          .map((t) => ({
            ...t,
            user_name: users.find((u) => u.phone === t.phone)?.name || '—',
          }));
      }
      throw new Error(await parseError(res));
    } catch (err) {
      if (this.isFallback) {
        const users = JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
        const allTx = JSON.parse(localStorage.getItem(LOCAL_WALLET_TX) || '[]');
        return allTx
          .filter((t) => t.type === 'withdraw' && t.status === 'pending')
          .map((t) => ({
            ...t,
            user_name: users.find((u) => u.phone === t.phone)?.name || '—',
          }));
      }
      throw err;
    }
  },

  async approveWithdraw(id) {
    try {
      const res = await fetch(`/api/admin/wallet/withdraw/${id}/approve`, { method: 'POST' });
      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        return this._settleLocalWithdraw(id, true);
      }
      throw new Error(await parseError(res));
    } catch (err) {
      if (this.isFallback) return this._settleLocalWithdraw(id, true);
      throw err;
    }
  },

  async rejectWithdraw(id) {
    try {
      const res = await fetch(`/api/admin/wallet/withdraw/${id}/reject`, { method: 'POST' });
      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        return this._settleLocalWithdraw(id, false);
      }
      throw new Error(await parseError(res));
    } catch (err) {
      if (this.isFallback) return this._settleLocalWithdraw(id, false);
      throw err;
    }
  },

  // -------------------------------------------------------------
  // ORDERS & ADMIN TRANSACTIONS
  // -------------------------------------------------------------

  _readLocalOrders() {
    return JSON.parse(localStorage.getItem(LOCAL_ORDERS) || '[]');
  },

  _writeLocalOrders(orders) {
    localStorage.setItem(LOCAL_ORDERS, JSON.stringify(orders));
  },

  async getOrdersByPhone(phone) {
    try {
      const res = await fetch(`/api/orders?phone=${encodeURIComponent(phone)}`);
      if (res.ok) {
        this.isFallback = false;
        return await res.json();
      }
      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        return this._readLocalOrders().filter((o) => o.phone === phone);
      }
      return [];
    } catch (e) {
      this.isFallback = true;
      return this._readLocalOrders().filter((o) => o.phone === phone);
    }
  },

  async getAdminOrders() {
    try {
      const res = await fetch('/api/admin/orders');
      if (res.ok) {
        this.isFallback = false;
        return await res.json();
      }
      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        return this._readLocalOrders();
      }
      return [];
    } catch (e) {
      this.isFallback = true;
      return this._readLocalOrders();
    }
  },

  async pushOrder(payload) {
    try {
      const res = await fetch('/api/admin/orders/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        const users = JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
        const user = users.find((u) => u.phone === payload.phone);
        const prods = JSON.parse(localStorage.getItem(LOCAL_PRODS) || '[]');
        const items = (payload.items || []).map((raw) => {
          const qty = Math.max(1, Number(raw.quantity) || 1);
          const prod = raw.productId ? prods.find((p) => p.id === Number(raw.productId)) : null;
          const unitPrice = prod ? Number(prod.price) : Number(raw.unitPrice) || 0;
          const productName = prod?.name || raw.productName || 'Sản phẩm';
          return {
            id: Date.now() + Math.random(),
            product_id: prod?.id || null,
            product_name: productName,
            quantity: qty,
            unit_price: unitPrice,
            product_icon: prod?.icon || raw.productIcon || '📦',
          };
        });
        const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
        const firstProd = prods.find((p) => p.id === Number(payload.items?.[0]?.productId));
        const cat = firstProd?.category || '';
        const match = String(cat).match(/(\d+)\s*%/);
        const commissionPercent = match ? Number(match[1]) : 0;
        const commissionAmount = Math.floor((total * commissionPercent) / 100);
        const order = {
          id: Date.now(),
          order_code: `OFF-${Date.now().toString().slice(-6)}`,
          phone: payload.phone,
          user_name: user?.name || 'Khách',
          status: 'offered',
          total_amount: total,
          principal_amount: total,
          commission_percent: commissionPercent,
          commission_amount: commissionAmount,
          category_name: cat,
          status_note: 'Khách hàng đã đặt đơn hãy bấm mua để xử lý',
          note: 'Đơn đẩy admin (Offline)',
          created_by: 'admin',
          created_at: new Date().toISOString(),
          items,
        };
        const all = this._readLocalOrders();
        all.unshift(order);
        this._writeLocalOrders(all);
        return { success: true, order };
      }
      throw new Error(await parseError(res));
    } catch (err) {
      if (this.isFallback) throw err;
      if (err.message.includes('Failed to fetch') || err.message.includes('502')) {
        this.isFallback = true;
        return this.pushOrder(payload);
      }
      throw err;
    }
  },

  async updateOrder(id, payload) {
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();

      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        const all = this._readLocalOrders();
        const updated = all.map((o) =>
          o.id === id
            ? {
                ...o,
                status: payload.status ?? o.status,
                status_note: payload.statusNote !== undefined ? payload.statusNote : o.status_note,
                note: payload.note !== undefined ? payload.note : o.note,
              }
            : o
        );
        this._writeLocalOrders(updated);
        return { success: true, order: updated.find((o) => o.id === id) };
      }
      throw new Error(await parseError(res));
    } catch (err) {
      if (this.isFallback) throw err;
      throw err;
    }
  },

  async confirmOfferedOrder(orderId, phone) {
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      if (res.ok) {
        this.isFallback = false;
        return await res.json();
      }
      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        const users = JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
        const user = users.find((u) => u.phone === phone);
        if (user && user.is_frozen) {
          throw new Error('Tài khoản của bạn đang bị đóng băng. Không thể thực hiện mua hàng.');
        }

        const all = this._readLocalOrders();
        const order = all.find((o) => o.id === orderId);
        if (!order || order.status !== 'offered' || order.phone !== phone) {
          throw new Error('Đơn không hợp lệ (Offline).');
        }

        const allowedList = (user?.allowed_categories || 'Mỹ Phẩm 10%').split(',').map((s) => s.trim());
        if (order.category_name && !allowedList.includes(order.category_name)) {
          throw new Error('Bạn không có quyền mua hàng khu vực này hãy liên hệ CSKH để được nâng cấp');
        }

        const principal = Number(order.principal_amount || order.total_amount);
        const balance = this._getLocalWallet(phone);
        if (principal > balance) throw new Error('Số dư ví không đủ (Offline).');
        this._setLocalWallet(phone, balance - principal);
        this._addLocalTransaction({
          phone,
          type: 'purchase',
          amount: principal,
          status: 'completed',
          note: `Xác nhận đơn ${order.order_code} (Offline)`,
        });
        order.status = 'pending';
        order.created_by = 'customer';
        order.status_note = 'Đơn đã thanh toán — chờ duyệt (Offline)';
        this._writeLocalOrders(all.map((o) => (o.id === orderId ? order : o)));
        return { success: true, balance: this._getLocalWallet(phone), order };
      }
      throw new Error(await parseError(res));
    } catch (err) {
      if (this.isFallback) throw err;
      if (err.message.includes('Failed to fetch') || err.message.includes('502')) {
        this.isFallback = true;
        return this.confirmOfferedOrder(orderId, phone);
      }
      throw err;
    }
  },

  async purchaseProduct({ phone, productId, quantity = 1 }) {
    try {
      const res = await fetch('/api/orders/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, productId, quantity }),
      });
      if (res.ok) {
        this.isFallback = false;
        return await res.json();
      }
      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        const users = JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
        const user = users.find((u) => u.phone === phone);
        if (user && user.is_frozen) {
          throw new Error('Tài khoản của bạn đang bị đóng băng. Không thể thực hiện mua hàng.');
        }

        const prods = JSON.parse(localStorage.getItem(LOCAL_PRODS) || '[]');
        const product = prods.find((p) => p.id === Number(productId));
        if (!product) throw new Error('Sản phẩm không tồn tại (Offline).');

        const allowedList = (user?.allowed_categories || 'Mỹ Phẩm 10%').split(',').map((s) => s.trim());
        if (!allowedList.includes(product.category)) {
          throw new Error('Bạn không có quyền mua hàng khu vực này hãy liên hệ CSKH để được nâng cấp');
        }

        const qty = Math.max(1, Number(quantity) || 1);
        const principal = Number(product.price) * qty;
        const match = String(product.category || '').match(/(\d+)\s*%/);
        const commissionPercent = match ? Number(match[1]) : 0;
        const commissionAmount = Math.floor((principal * commissionPercent) / 100);
        const balance = this._getLocalWallet(phone);
        if (principal > balance) throw new Error('Số dư ví không đủ (Offline).');
        this._setLocalWallet(phone, balance - principal);
        this._addLocalTransaction({
          phone,
          type: 'purchase',
          amount: principal,
          status: 'completed',
          note: 'Mua hàng — trừ tiền gốc (Offline)',
        });
        const order = {
          id: Date.now(),
          order_code: `OFF-${Date.now().toString().slice(-6)}`,
          phone,
          status: 'pending',
          total_amount: principal,
          principal_amount: principal,
          commission_percent: commissionPercent,
          commission_amount: commissionAmount,
          category_name: product.category,
          status_note: 'Đơn chờ admin duyệt (Offline)',
          created_by: 'customer',
          created_at: new Date().toISOString(),
          items: [{
            id: Date.now(),
            product_id: product.id,
            product_name: product.name,
            quantity: qty,
            unit_price: product.price,
            product_icon: product.icon,
          }],
        };
        const all = this._readLocalOrders();
        all.unshift(order);
        this._writeLocalOrders(all);
        return {
          success: true,
          balance: this._getLocalWallet(phone),
          order,
        };
      }
      throw new Error(await parseError(res));
    } catch (err) {
      if (this.isFallback) throw err;
      if (err.message.includes('Failed to fetch') || err.message.includes('502')) {
        this.isFallback = true;
        return this.purchaseProduct({ phone, productId, quantity });
      }
      throw err;
    }
  },

  async approveOrder(id) {
    try {
      const res = await fetch(`/api/admin/orders/${id}/approve`, { method: 'POST' });
      if (res.ok) return await res.json();
      if (shouldUseOfflineFallback(res)) {
        return this._settleLocalOrder(id, true);
      }
      throw new Error(await parseError(res));
    } catch (err) {
      if (this.isFallback) return this._settleLocalOrder(id, true);
      throw err;
    }
  },

  async rejectOrder(id) {
    try {
      const res = await fetch(`/api/admin/orders/${id}/reject`, { method: 'POST' });
      if (res.ok) return await res.json();
      if (shouldUseOfflineFallback(res)) {
        return this._settleLocalOrder(id, false);
      }
      throw new Error(await parseError(res));
    } catch (err) {
      if (this.isFallback) return this._settleLocalOrder(id, false);
      throw err;
    }
  },

  _settleLocalOrder(id, approve) {
    const all = this._readLocalOrders();
    const order = all.find((o) => o.id === id);
    if (!order || order.status !== 'pending' || order.created_by !== 'customer') {
      throw new Error('Đơn không hợp lệ hoặc đã xử lý (Offline).');
    }
    const principal = Number(order.principal_amount || order.total_amount);
    const commission = Number(order.commission_amount || 0);
    const refund = approve ? principal + commission : principal;
    this._setLocalWallet(order.phone, this._getLocalWallet(order.phone) + refund);
    this._addLocalTransaction({
      phone: order.phone,
      type: 'order_refund',
      amount: principal,
      status: 'completed',
      note: approve ? 'Hoàn gốc (duyệt offline)' : 'Hoàn gốc (từ chối offline)',
    });
    if (approve && commission > 0) {
      this._addLocalTransaction({
        phone: order.phone,
        type: 'commission',
        amount: commission,
        status: 'completed',
        note: `Hoa hồng ${order.commission_percent}%`,
      });
    }
    order.status = approve ? 'completed' : 'rejected';
    order.status_note = approve
      ? `Đã duyệt — hoàn gốc + hoa hồng (Offline)`
      : `Từ chối — hoàn gốc (Offline)`;
    this._writeLocalOrders(all.map((o) => (o.id === id ? order : o)));
    return { success: true, order };
  },

  async getAdminTransactions() {
    try {
      const res = await fetch('/api/admin/transactions');
      if (res.ok) {
        this.isFallback = false;
        return await res.json();
      }
      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        const users = JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
        const all = JSON.parse(localStorage.getItem(LOCAL_WALLET_TX) || '[]');
        return all
          .filter((t) => t.type === 'deposit' || t.type === 'withdraw')
          .map((t) => ({
            ...t,
            user_name: users.find((u) => u.phone === t.phone)?.name || '—',
          }))
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
      return [];
    } catch (e) {
      this.isFallback = true;
      const users = JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
      const all = JSON.parse(localStorage.getItem(LOCAL_WALLET_TX) || '[]');
      return all
        .filter((t) => t.type === 'deposit' || t.type === 'withdraw')
        .map((t) => ({
          ...t,
          user_name: users.find((u) => u.phone === t.phone)?.name || '—',
        }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  },

  async resetSystemData() {
    try {
      const res = await fetch('/api/admin/system/reset-data', {
        method: 'POST',
      });
      if (res.ok) {
        localStorage.setItem(LOCAL_ORDERS, '[]');
        localStorage.setItem(LOCAL_WALLET_TX, '[]');
        localStorage.setItem(LOCAL_WALLETS, '{}');
        return await res.json();
      }
      
      if (shouldUseOfflineFallback(res)) {
        this.isFallback = true;
        localStorage.setItem(LOCAL_ORDERS, '[]');
        localStorage.setItem(LOCAL_WALLET_TX, '[]');
        localStorage.setItem(LOCAL_WALLETS, '{}');
        return {
          success: true,
          message: 'Đã xóa toàn bộ dữ liệu nạp rút, đơn hàng và đặt lại số dư ví (Chế độ Offline).'
        };
      }
      throw new Error(await parseError(res));
    } catch (err) {
      if (this.isFallback || err.message.includes('Failed to fetch') || err.message.includes('502')) {
        this.isFallback = true;
        localStorage.setItem(LOCAL_ORDERS, '[]');
        localStorage.setItem(LOCAL_WALLET_TX, '[]');
        localStorage.setItem(LOCAL_WALLETS, '{}');
        return {
          success: true,
          message: 'Đã xóa toàn bộ dữ liệu nạp rút, đơn hàng và đặt lại số dư ví (Chế độ Offline ngoại tuyến).'
        };
      }
      throw err;
    }
  }
};
