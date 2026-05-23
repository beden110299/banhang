import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';
import { resolveCategoryImage } from '../utils/categoryImage';
import { parseCategoryCommissionPercent, calcCommissionAmount } from '../utils/commission';

export default function Home({ storeName, currentUser, addToast, cartItems = [], setCartItems, setActiveModal, currentView }) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const [productsList, setProductsList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [bannersList, setBannersList] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [offeredOrders, setOfferedOrders] = useState([]);
  const [confirmingOrderId, setConfirmingOrderId] = useState(null);

  // Load dynamic catalog and banners from Neon database
  useEffect(() => {
    const fetchData = async () => {
      try {
        const cats = await api.getCategories();
        setCategoriesList(cats);
        if (cats && cats.length > 0) {
          setSelectedCategory(cats[0].name);
        }

        const prods = await api.getProducts();
        setProductsList(prods);

        const banners = await api.getBanners();
        setBannersList(banners || []);
      } catch (err) {
        addToast('danger', 'Lỗi kết nối', 'Không thể tải dữ liệu từ máy chủ.');
      }
    };
    fetchData();
  }, []);

  // Auto-play slide banner
  useEffect(() => {
    if (bannersList.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % bannersList.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [bannersList.length]);

  useEffect(() => {
    if (!currentUser?.phone || currentUser.role === 'admin') {
      setOfferedOrders([]);
      return;
    }
    const loadOffered = async () => {
      try {
        const orders = await api.getOrdersByPhone(currentUser.phone);
        setOfferedOrders(orders.filter((o) => o.status === 'offered' && o.created_by === 'admin'));
      } catch {
        setOfferedOrders([]);
      }
    };
    loadOffered();
  }, [currentUser?.phone, currentUser?.role]);

  const categoryIconMap = useMemo(() => {
    const map = {};
    categoriesList.forEach((c) => {
      map[c.name] = c.icon || '';
    });
    return map;
  }, [categoriesList]);

  const categories = categoriesList.map((c) => c.name);

  const allowedCats = useMemo(() => {
    if (!currentUser) return ['Mỹ Phẩm 10%'];
    return currentUser.allowed_categories
      ? currentUser.allowed_categories.split(',').map(s => s.trim())
      : ['Mỹ Phẩm 10%'];
  }, [currentUser]);

  const isCategoryLocked = (catName) => {
    if (catName === 'Tất cả') return false;
    if (currentUser?.role === 'admin') return false;
    return !allowedCats.includes(catName);
  };

  const filteredProducts = productsList.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (product.desc && product.desc.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));

  const handleConfirmOfferedOrder = async (order) => {
    if (!currentUser) return;
    if (currentUser.is_frozen) {
      addToast('danger', 'Tài khoản bị đóng băng', 'Tài khoản của bạn đang bị đóng băng. Vui lòng liên hệ CSKH để được hỗ trợ.');
      return;
    }
    if (isCategoryLocked(order.category_name)) {
      addToast('danger', 'Không có quyền mua', 'Bạn không có quyền mua hàng khu vực này hãy liên hệ CSKH để được nâng cấp');
      return;
    }
    setConfirmingOrderId(order.id);
    try {
      const result = await api.confirmOfferedOrder(order.id, currentUser.phone);
      setOfferedOrders((prev) => prev.filter((o) => o.id !== order.id));
      setCartCount((prev) => prev + 1);
      const principal = order.principal_amount ?? order.total_amount;
      const commission = order.commission_amount ?? 0;
      const pct = order.commission_percent ?? 0;
      addToast(
        'success',
        'Đã thanh toán đơn',
        `Trừ ${principal.toLocaleString('vi-VN')}đ từ ví. Đơn chờ admin duyệt — khi duyệt hoàn gốc + hoa hồng ${pct}% (${commission.toLocaleString('vi-VN')}đ).`
      );
    } catch (err) {
      addToast('danger', 'Không mua được', err.message);
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const handlePurchase = (product) => {
    if (!currentUser) {
      addToast('danger', 'Đăng nhập', 'Vui lòng đăng nhập để mua hàng.');
      return;
    }
    if (currentUser.role === 'admin') {
      addToast('danger', 'Không áp dụng', 'Tài khoản quản trị không thể mua hàng tại cửa hàng.');
      return;
    }
    if (currentUser.is_frozen) {
      addToast('danger', 'Tài khoản bị đóng băng', 'Tài khoản của bạn đang bị đóng băng. Vui lòng liên hệ CSKH để được hỗ trợ.');
      return;
    }
    if (isCategoryLocked(product.category)) {
      addToast('danger', 'Không có quyền mua', 'Bạn không có quyền mua hàng khu vực này hãy liên hệ CSKH để được nâng cấp');
      return;
    }

    // Add to cartItems
    const existingIndex = cartItems.findIndex((item) => item.id === product.id);
    let updatedCart = [];
    if (existingIndex > -1) {
      updatedCart = cartItems.map((item, idx) => 
        idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      updatedCart = [
        ...cartItems,
        {
          id: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
          desc: product.desc,
          icon: product.icon,
          quantity: 1,
        }
      ];
    }
    setCartItems(updatedCart);
    localStorage.setItem('ecommerce_cart', JSON.stringify(updatedCart));

    // Automatically transition customer to cart modal
    setActiveModal('cart');

    addToast(
      'success',
      'Đã thêm vào giỏ hàng',
      `Đã chuyển "${product.name}" vào giỏ hàng. Đang tự động hiển thị giỏ hàng.`
    );
  };

  const formatPriceVND = (price) => {
    if (price === undefined || price === null) return '0 đ';
    return price.toLocaleString('vi-VN') + ' đ';
  };

  if (currentUser?.role !== 'admin' && currentView === 'store') {
    return (
      <div className="storefront-wrapper animate-fade-in" id="store-pushed-view" style={{ padding: '16px', minHeight: 'calc(100vh - 120px)' }}>


        <section className="offered-orders-section" id="offered-orders-section" style={{ marginBottom: '28px' }}>
          <h2 className="section-title" style={{ color: 'var(--primary)', borderBottom: '2px solid var(--primary)', paddingBottom: '8px', marginBottom: '20px' }}>
            Đơn dành cho bạn
          </h2>
          {offeredOrders.length > 0 ? (
            <>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Khách hàng đã đặt đơn hãy bấm <strong>Mua</strong> để xử lý
              </p>
              <div
                className="product-grid"
                style={isMobile ? { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' } : {}}
              >
                {offeredOrders.map((order) => {
                  const item = order.items?.[0];
                  const icon = item?.product_icon;
                  return (
                    <div key={order.id} className="product-card glass-panel" style={{ border: '2px solid var(--primary)' }}>
                      <div className="product-image-container" style={isMobile ? { height: '100px' } : {}}>
                        {icon && (icon.startsWith('http') || icon.startsWith('data:') || icon.startsWith('/')) ? (
                          <img src={icon} alt={item?.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span className="product-image-placeholder">{icon || '📦'}</span>
                        )}
                      </div>
                      <div className="product-info">
                        <span className="product-category">Khách hàng đã đặt đơn · {order.order_code}</span>
                        <h3 className="product-name">
                          {(order.items || []).map((i) => `${i.quantity}x ${i.product_name}`).join(', ')}
                        </h3>
                        <p className="product-desc" style={{ fontSize: '0.8rem' }}>{order.status_note}</p>
                      </div>
                      <div className="product-footer" style={{ flexDirection: 'column', gap: '8px' }}>
                        <span className="product-price">{formatPriceVND(order.principal_amount ?? order.total_amount)}</span>
                        {order.commission_percent > 0 && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--success)' }}>
                            Hoa hồng {order.commission_percent}% khi duyệt: {formatPriceVND(order.commission_amount)}
                          </span>
                        )}
                        <button
                          type="button"
                          className="btn-buy"
                          disabled={confirmingOrderId === order.id}
                          onClick={() => handleConfirmOfferedOrder(order)}
                        >
                          {confirmingOrderId === order.id ? 'Đang xử lý...' : 'Mua'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="no-products-found glass-panel" style={{ padding: '40px', textAlign: 'center', marginTop: '40px' }}>
              <span className="no-products-icon" style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>📦</span>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Hiện tại bạn không có đơn hàng gợi ý nào cần xử lý.</p>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="storefront-wrapper animate-fade-in" id="storefront-view">
      {/* Dynamic Slide Banner replacing static Hero Section */}
      <div className="store-banner-slider" id="store-hero">
        {bannersList.length > 0 ? (
          <div className="slider-container" style={{ position: 'relative', width: '100%' }}>
            {bannersList.map((slide, index) => (
              <div
                key={slide.id || index}
                className={`slide-item ${index === currentSlide ? 'active' : ''}`}
                style={{
                  display: index === currentSlide ? 'block' : 'none',
                  position: 'relative',
                  width: '100%',
                  height: isMobile ? '160px' : '280px',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                  border: '1px solid var(--border-glass)',
                  transition: 'opacity 0.5s ease-in-out'
                }}
              >
                {/* Background image */}
                {slide.imageUrl && (slide.imageUrl.startsWith('http') || slide.imageUrl.startsWith('data:') || slide.imageUrl.startsWith('/')) ? (
                  <img
                    src={slide.imageUrl}
                    alt={slide.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block'
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(135deg, #ee4d2d, #ff7b54)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  />
                )}

                {/* Dark overlay for readability */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(to right, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.1) 100%)',
                    zIndex: 1
                  }}
                />

                {/* Content Overlay */}
                <div
                  className="slide-content"
                  style={{
                    position: 'absolute',
                    bottom: isMobile ? '16px' : '30px',
                    left: isMobile ? '20px' : '40px',
                    right: '20px',
                    zIndex: 2,
                    color: '#ffffff',
                    textAlign: 'left',
                    maxWidth: '80%'
                  }}
                >
                  <h1
                    style={{
                      fontSize: isMobile ? '1.2rem' : '2.2rem',
                      fontWeight: 700,
                      marginBottom: '8px',
                      textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
                      lineHeight: 1.2,
                      color: '#ffffff'
                    }}
                  >
                    {slide.title}
                  </h1>
                  <p
                    style={{
                      fontSize: isMobile ? '0.8rem' : '1.05rem',
                      opacity: 0.95,
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                      lineHeight: 1.4,
                      margin: 0,
                      color: '#ffffff'
                    }}
                  >
                    {slide.subtitle}
                  </p>
                </div>
              </div>
            ))}

            {/* Slider arrows */}
            {bannersList.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentSlide((prev) => (prev - 1 + bannersList.length) % bannersList.length)}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '12px',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    borderRadius: '50%',
                    width: isMobile ? '28px' : '36px',
                    height: isMobile ? '28px' : '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 3,
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.35)'}
                >
                  ❮
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentSlide((prev) => (prev + 1) % bannersList.length)}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: '12px',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    borderRadius: '50%',
                    width: isMobile ? '28px' : '36px',
                    height: isMobile ? '28px' : '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 3,
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.35)'}
                >
                  ❯
                </button>
              </>
            )}

            {/* Bottom dot indicators */}
            {bannersList.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: '6px',
                  zIndex: 3
                }}
              >
                {bannersList.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentSlide(idx)}
                    style={{
                      width: idx === currentSlide ? '16px' : '6px',
                      height: '6px',
                      borderRadius: '3px',
                      backgroundColor: idx === currentSlide ? '#ee4d2d' : 'rgba(255, 255, 255, 0.5)',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <header className="store-hero glass-panel" style={{ padding: '30px' }}>
            <h1 id="store-hero-title">Chào mừng đến {storeName}</h1>
            <p id="store-hero-subtitle">
              Khám phá bộ sưu tập sản phẩm nổi bật đa dạng tại {storeName} — mua sắm tiện lợi, giao hàng nhanh chóng.
            </p>
          </header>
        )}


      </div>

      {offeredOrders.length > 0 && currentUser?.role !== 'admin' && currentView === 'store' && (
        <section className="offered-orders-section" id="offered-orders-section" style={{ marginBottom: '28px' }}>
          <h2 className="section-title" style={{ color: 'var(--primary)' }}>Đơn dành cho bạn</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Khách hàng đã đặt đơn hãy bấm <strong>Mua</strong> để xử lý
          </p>
          <div
            className="product-grid"
            style={isMobile ? { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' } : {}}
          >
            {offeredOrders.map((order) => {
              const item = order.items?.[0];
              const icon = item?.product_icon;
              return (
                <div key={order.id} className="product-card glass-panel" style={{ border: '2px solid var(--primary)' }}>
                  <div className="product-image-container" style={isMobile ? { height: '100px' } : {}}>
                    {icon && (icon.startsWith('http') || icon.startsWith('data:') || icon.startsWith('/')) ? (
                      <img src={icon} alt={item?.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span className="product-image-placeholder">{icon || '📦'}</span>
                    )}
                  </div>
                  <div className="product-info">
                    <span className="product-category">Khách hàng đã đặt đơn · {order.order_code}</span>
                    <h3 className="product-name">
                      {(order.items || []).map((i) => `${i.quantity}x ${i.product_name}`).join(', ')}
                    </h3>
                    <p className="product-desc" style={{ fontSize: '0.8rem' }}>{order.status_note}</p>
                  </div>
                  <div className="product-footer" style={{ flexDirection: 'column', gap: '8px' }}>
                    <span className="product-price">{formatPriceVND(order.principal_amount ?? order.total_amount)}</span>
                    {order.commission_percent > 0 && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--success)' }}>
                        Hoa hồng {order.commission_percent}% khi duyệt: {formatPriceVND(order.commission_amount)}
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn-buy"
                      disabled={confirmingOrderId === order.id}
                      onClick={() => handleConfirmOfferedOrder(order)}
                    >
                      {confirmingOrderId === order.id ? 'Đang xử lý...' : 'Mua'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Filter and Search controls */}
      <section className="store-controls" id="store-controls">
        {/* Search */}
        <div className="store-search-wrapper">
          <input
            type="text"
            className="form-input store-search-input"
            placeholder="Tìm kiếm sản phẩm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            id="product-search-input"
          />
          <span className="store-search-icon">
            🔍
          </span>
        </div>

        {/* Category Grid Section */}
        <div className="category-grid" id="category-grid">
          {categories.map((cat) => {
            const catImage = resolveCategoryImage(cat, categoryIconMap[cat]);

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`category-card-btn ${selectedCategory === cat ? 'active' : ''}`}
                id={`filter-btn-${cat.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <div className="category-card-image-wrapper">
                  <img src={catImage} alt={cat} className="category-card-image" />
                </div>
                <span className="category-card-name">
                  {isCategoryLocked(cat) ? `🔒 ${cat}` : cat}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Products list */}
      <section id="products-catalog-section">
        <h2 className="section-title" id="catalog-title">Sản Phẩm Nổi Bật</h2>
        
        {filteredProducts.length > 0 ? (
          <div 
            className="product-grid" 
            id="product-grid"
            style={isMobile ? {
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px'
            } : {}}
          >
            {filteredProducts.map((product) => (
              <div 
                key={product.id} 
                className="product-card glass-panel animate-fade-in" 
                id={`product-card-${product.id}`}
                style={isMobile ? {
                  padding: '12px',
                  gap: '8px',
                  borderRadius: '12px'
                } : {}}
              >
                <div 
                  className="product-image-container"
                  style={isMobile ? {
                    height: '110px',
                    borderRadius: '8px'
                  } : {}}
                >
                  {product.icon && (product.icon.startsWith('http') || product.icon.startsWith('data:') || product.icon.startsWith('/')) ? (
                    <img 
                      src={product.icon} 
                      alt={product.name}
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <span 
                      className="product-image-placeholder" 
                      style={isMobile ? { fontSize: '2.5rem' } : { fontSize: '4rem' }}
                    >
                      {product.icon || '📦'}
                    </span>
                  )}
                </div>
                <div className="product-info" style={isMobile ? { gap: '4px' } : {}}>
                  <span 
                    className="product-category"
                    style={isMobile ? {
                      fontSize: '0.62rem',
                      letterSpacing: '0.6px'
                    } : {}}
                  >
                    {product.category} {isCategoryLocked(product.category) && '🔒'}
                  </span>
                  <h3 
                    className="product-name" 
                    id={`product-name-${product.id}`}
                    style={isMobile ? {
                      fontSize: '0.82rem',
                      lineHeight: '1.3',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    } : {}}
                  >
                    {product.name}
                  </h3>
                  {!isMobile && (
                    <p className="product-desc" id={`product-desc-${product.id}`}>
                      {product.desc}
                    </p>
                  )}
                </div>
                <div 
                  className="product-footer"
                  style={isMobile ? {
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: '6px',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border-glass)'
                  } : {}}
                >
                  <span 
                    className="product-price" 
                    id={`product-price-${product.id}`}
                    style={isMobile ? {
                      fontSize: '0.82rem',
                      fontWeight: '700',
                      color: 'var(--primary)',
                      textAlign: 'center',
                      display: 'block'
                    } : {}}
                  >
                    {formatPriceVND(product.price)}
                  </span>
                  {parseCategoryCommissionPercent(product.category) > 0 && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--success)', display: 'block', textAlign: isMobile ? 'center' : 'left' }}>
                      Hoa hồng {parseCategoryCommissionPercent(product.category)}% khi duyệt:{' '}
                      {formatPriceVND(calcCommissionAmount(product.price, parseCategoryCommissionPercent(product.category)))}
                    </span>
                  )}
                  <button 
                    className="btn-buy" 
                    onClick={() => handlePurchase(product)}
                    disabled={!currentUser || currentUser.role === 'admin'}
                    id={`btn-add-to-cart-${product.id}`}
                    style={isMobile ? {
                      width: '100%',
                      padding: '6px 8px',
                      fontSize: '0.72rem',
                      minHeight: 'auto',
                      textAlign: 'center'
                    } : {}}
                  >
                    {currentUser?.role === 'admin' ? 'Chỉ khách mua' : 'Mua Ngay'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-products-found glass-panel" id="no-products-found">
            <span className="no-products-icon">📦</span>
            <p>Không tìm thấy sản phẩm nào khớp với tìm kiếm của bạn.</p>
          </div>
        )}
      </section>
    </div>
  );
}
