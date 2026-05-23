import React, { useState, useEffect } from 'react';
import ProfilePanel from './ProfilePanel';
import { api } from '../utils/api';
import { formatPriceVND, formatDateTime } from '../utils/format';
import { getOrderStatusLabel, getOrderStatusBadgeClass } from '../utils/orderStatus';

export default function Footer({ storeName = 'Miinto', currentUser, currentView, setCurrentView, activeModal, setActiveModal, cartItems = [], setCartItems, onLogout, addToast }) {
  const [cskhConfig, setCskhConfig] = useState({ cskh_type: 'built_in', cskh_script: '' });
  const [cskhInjected, setCskhInjected] = useState(false);
  const [supportMessages, setSupportMessages] = useState([
    { sender: 'bot', text: `Chào mừng quý khách đến với dịch vụ CSKH của ${storeName}! Chúng tôi có thể hỗ trợ gì cho quý khách hôm nay?` }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [supportBootMessage, setSupportBootMessage] = useState(null);
  const [userOrders, setUserOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [offeredCount, setOfferedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  
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

  // -------------------------------------------------------------
  // CONNECT & CONTROL CSKH CHAT SCRIPTS DYNAMICALLY
  // -------------------------------------------------------------
  
  // 1. Fetch CSKH settings on mount
  useEffect(() => {
    const fetchCSKH = async () => {
      try {
        const settings = await api.getCSKHSettings();
        if (settings) {
          setCskhConfig(settings);
        }
      } catch (err) {
        console.error("Lỗi tải cấu hình CSKH:", err);
      }
    };
    fetchCSKH();
  }, []);

  // 2. Dynamic injection function (Lazy loading to save cost)
  const injectThirdPartyChat = (type, script) => {
    if (!script || typeof window === 'undefined') return;

    if (type === 'crisp') {
      if (window.$crisp) return; // Already injected
      
      // Smart extraction for Crisp ID (extract UUID v4 pattern if user pasted the entire script block)
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = script.match(uuidRegex);
      const crispId = match ? match[0] : script.trim();

      window.$crisp = [];
      window.CRISP_WEBSITE_ID = crispId;
      (function() {
        var d = document;
        var s = d.createElement("script");
        s.src = "https://client.crisp.chat/l.js";
        s.async = 1;
        s.id = "crisp-cskh-script";
        d.getElementsByTagName("head")[0].appendChild(s);
      })();
    } 
    else if (type === 'tawk') {
      if (window.Tawk_API) return; // Already injected
      
      // Smart extraction for Tawk.to URL (extract embed URL if user pasted the entire script block)
      const tawkUrlRegex = /https:\/\/embed\.tawk\.to\/[a-zA-Z0-9]+\/[a-zA-Z0-9]+/i;
      const tawkMatch = script.match(tawkUrlRegex);
      const tawkUrl = tawkMatch ? tawkMatch[0] : script.trim();

      window.Tawk_API = window.Tawk_API || {};
      window.Tawk_LoadStart = new Date();
      (function() {
        var s1 = document.createElement("script"), s0 = document.getElementsByTagName("script")[0];
        s1.async = true;
        s1.src = tawkUrl; // The direct embed URL
        s1.charset = 'UTF-8';
        s1.id = "tawk-cskh-script";
        s1.setAttribute('crossorigin', '*');
        if (s0 && s0.parentNode) {
          s0.parentNode.insertBefore(s1, s0);
        } else {
          document.head.appendChild(s1);
        }
      })();
    }
    else if (type === 'zalo' || type === 'custom') {
      // Check if Zalo is just a URL link
      if (type === 'zalo' && (script.startsWith('http://') || script.startsWith('https://'))) {
        return;
      }
      if (document.getElementById("custom-cskh-container")) return; // Already injected
      
      const container = document.createElement("div");
      container.id = "custom-cskh-container";
      document.body.appendChild(container);
      container.innerHTML = script;

      // Extract and execute scripts
      const scripts = container.getElementsByTagName("script");
      for (let i = 0; i < scripts.length; i++) {
        const s = document.createElement("script");
        if (scripts[i].src) {
          s.src = scripts[i].src;
        } else {
          s.textContent = scripts[i].textContent;
        }
        s.async = true;
        document.body.appendChild(s);
      }
    }
    setCskhInjected(true);
  };

  // 3. Watcher for activeModal to show/hide dynamic widgets
  useEffect(() => {
    const handleWidgetVisibility = () => {
      const isSupportOpen = activeModal === 'support';
      if (typeof window === 'undefined') return;

      const type = cskhConfig.cskh_type;
      const script = cskhConfig.cskh_script;

      // If support is opened, lazy load the configured widget script
      if (isSupportOpen && type !== 'built_in') {
        injectThirdPartyChat(type, script);
      }

      // Crisp Chat Hide/Show
      if (window.$crisp) {
        try {
          if (isSupportOpen && type === 'crisp') {
            window.$crisp.push(["do", "chat:show"]);
            window.$crisp.push(["do", "chat:open"]);
          } else {
            window.$crisp.push(["do", "chat:hide"]);
          }
        } catch (e) {
          console.error("Crisp toggle error:", e);
        }
      }

      // Tawk.to Hide/Show
      if (window.Tawk_API) {
        try {
          if (isSupportOpen && type === 'tawk') {
            if (typeof window.Tawk_API.showWidget === 'function') window.Tawk_API.showWidget();
            if (typeof window.Tawk_API.maximize === 'function') window.Tawk_API.maximize();
          } else {
            if (typeof window.Tawk_API.hideWidget === 'function') window.Tawk_API.hideWidget();
            if (typeof window.Tawk_API.minimize === 'function') window.Tawk_API.minimize();
          }
        } catch (e) {
          console.error("Tawk toggle error:", e);
        }
      }

      // Facebook Customer Chat SDK
      if (window.FB && window.FB.CustomerChat) {
        try {
          if (isSupportOpen && type === 'facebook') {
            window.FB.CustomerChat.show(true);
            window.FB.CustomerChat.showDialog();
          } else {
            window.FB.CustomerChat.hide();
          }
        } catch (e) {
          console.error("FB Customer Chat error:", e);
        }
      }

      // Custom elements (like Zalo, Tawk containers, etc.)
      const chatSelectors = [
        '#tawk-container',
        '.tawk-min-container',
        'iframe[title*="chat"]',
        'iframe[src*="tawk.to"]',
        'iframe[id*="crisp"]',
        '.crisp-client',
        '#crisp-chatbox',
        '#zalo-chat-widget',
        '.zalo-chat-widget',
        'iframe[src*="zalo"]',
        'div[class*="zalo-chat-widget"]',
        'div[id*="zalo-chat-widget"]',
        '#custom-cskh-container'
      ];

      chatSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            if (isSupportOpen && type !== 'built_in') {
              // For official Crisp/Tawk widgets, remove our forced inline styles so they use their native CSS layout (e.g. flex/fixed)
              if (selector.includes('crisp') || selector.includes('tawk')) {
                el.style.removeProperty('display');
                el.style.removeProperty('visibility');
                el.style.removeProperty('opacity');
              } else {
                el.style.setProperty('display', 'block', 'important');
                el.style.setProperty('visibility', 'visible', 'important');
                el.style.setProperty('opacity', '1', 'important');
              }
            } else {
              el.style.setProperty('display', 'none', 'important');
              el.style.setProperty('visibility', 'hidden', 'important');
              el.style.setProperty('opacity', '0', 'important');
            }
          });
        } catch (e) {
          // Ignore DOM selector errors
        }
      });
    };

    // Trigger immediately
    handleWidgetVisibility();

    // Poll to cover lazy loaded script widgets
    let count = 0;
    const interval = setInterval(() => {
      handleWidgetVisibility();
      count++;
      if (count >= 5) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeModal, cskhConfig, cskhInjected]);

  useEffect(() => {
    if (activeModal !== 'orders' || !currentUser?.phone) {
      return;
    }
    let cancelled = false;
    const loadOrders = async () => {
      setOrdersLoading(true);
      try {
        const list = await api.getOrdersByPhone(currentUser.phone);
        if (!cancelled) setUserOrders(list);
      } catch {
        if (!cancelled) setUserOrders([]);
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    };
    loadOrders();
    return () => { cancelled = true; };
  }, [activeModal, currentUser?.phone]);

  useEffect(() => {
    if (activeModal !== 'cart' || !currentUser?.phone) return;
    const fetchBalance = async () => {
      try {
        const result = await api.getWallet(currentUser.phone, currentUser);
        setWalletBalance(result.balance || 0);
      } catch (err) {
        setWalletBalance(0);
      }
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, [activeModal, currentUser?.phone]);

  useEffect(() => {
    if (!currentUser?.phone || currentUser.role === 'admin') {
      setOfferedCount(0);
      setPendingCount(0);
      return;
    }

    const checkNewOrders = async () => {
      try {
        const list = await api.getOrdersByPhone(currentUser.phone);
        const offered = list.filter(o => o.status === 'offered' && o.created_by === 'admin');
        setOfferedCount(offered.length);
        const pending = list.filter(o => o.status === 'pending');
        setPendingCount(pending.length);
        if (activeModal === 'orders') {
          setUserOrders(list);
        }
      } catch (err) {
        console.error("Lỗi kiểm tra đơn hàng mới:", err);
      }
    };

    checkNewOrders();
    const interval = setInterval(checkNewOrders, 6000);
    return () => clearInterval(interval);
  }, [currentUser?.phone, activeModal]);

  useEffect(() => {
    if (activeModal !== 'support' || !supportBootMessage) return;
    setSupportMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.sender === 'user' && last.text === supportBootMessage) return prev;
      return [...prev, { sender: 'user', text: supportBootMessage }];
    });
    setChatInput('');
    setSupportBootMessage(null);

    setTimeout(() => {
      setSupportMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: 'Dạ, để nạp tiền vào ví, quý khách vui lòng cung cấp số tiền muốn nạp và phương thức thanh toán. Chuyên viên CSKH sẽ hướng dẫn chuyển khoản và xác nhận số dư ví trong vài phút.',
        },
      ]);
    }, 600);
  }, [activeModal, supportBootMessage]);

  const handleDepositFromProfile = () => {
    setSupportBootMessage('Tôi muốn nạp tiền vào ví. Vui lòng hỗ trợ hướng dẫn thanh toán.');
    setActiveModal('support');
  };

  const handleDepositFromCart = () => {
    setSupportBootMessage('Tôi muốn nạp tiền vào ví để mua hàng.');
    setActiveModal('support');
  };

  const parseCategoryCommissionPercent = (catName) => {
    if (!catName) return 0;
    const match = String(catName).match(/(\d+)\s*%/);
    return match ? Number(match[1]) : 0;
  };

  const calcCommissionAmount = (amount, percent) => {
    return Math.floor((Number(amount || 0) * Number(percent || 0)) / 100);
  };

  const handleIncrement = (productId) => {
    const updated = cartItems.map((item) =>
      item.id === productId ? { ...item, quantity: item.quantity + 1 } : item
    );
    setCartItems(updated);
    localStorage.setItem('ecommerce_cart', JSON.stringify(updated));
  };

  const handleDecrement = (productId) => {
    const updated = cartItems.map((item) => {
      if (item.id === productId) {
        const newQty = item.quantity - 1;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    });
    setCartItems(updated);
    localStorage.setItem('ecommerce_cart', JSON.stringify(updated));
  };

  const handleRemoveItem = (productId) => {
    const updated = cartItems.filter((item) => item.id !== productId);
    setCartItems(updated);
    localStorage.setItem('ecommerce_cart', JSON.stringify(updated));
    addToast('success', 'Đã xóa sản phẩm', 'Đã xóa sản phẩm khỏi giỏ hàng.');
  };

  const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  const totalCommission = cartItems.reduce((sum, item) => {
    const pct = parseCategoryCommissionPercent(item.category);
    return sum + calcCommissionAmount(item.price * item.quantity, pct);
  }, 0);

  const handleCheckout = async () => {
    if (!currentUser) return;
    if (currentUser.is_frozen) {
      addToast('danger', 'Tài khoản bị đóng băng', 'Tài khoản của bạn đang bị đóng băng. Vui lòng liên hệ CSKH để được hỗ trợ.');
      return;
    }
    setIsSubmittingOrder(true);
    let successCount = 0;
    let failedItems = [];

    for (const item of cartItems) {
      try {
        await api.purchaseProduct({
          phone: currentUser.phone,
          productId: item.id,
          quantity: item.quantity,
        });
        successCount++;
      } catch (err) {
        failedItems.push(item);
      }
    }

    if (failedItems.length === 0) {
      setCartItems([]);
      localStorage.removeItem('ecommerce_cart');
      addToast(
        'success',
        'Đặt hàng thành công',
        `Đã đặt thành công ${successCount} sản phẩm. Đơn hàng chờ Hệ Thống duyệt.`
      );
      setActiveModal('orders');
    } else {
      setCartItems(failedItems);
      localStorage.setItem('ecommerce_cart', JSON.stringify(failedItems));
      addToast(
        'danger',
        'Đặt hàng bị lỗi',
        `Đã đặt thành công ${successCount} sản phẩm. Còn ${failedItems.length} sản phẩm gặp sự cố trong giỏ.`
      );
    }
    setIsSubmittingOrder(false);
  };

  const handleTabClick = (tab) => {
    if (tab === 'home') {
      setCurrentView('home');
      setActiveModal(null);
    } else if (tab === 'store') {
      setCurrentView('store');
      setActiveModal(null);
    } else {
      setActiveModal(tab);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    const updatedMessages = [...supportMessages, { sender: 'user', text: userText }];
    setSupportMessages(updatedMessages);
    setChatInput('');

    // Generate dynamic luxury response
    setTimeout(() => {
      let botResponse = `Cảm ơn quý khách đã gửi yêu cầu. Chuyên viên CSKH ${storeName} đang kiểm tra và sẽ phản hồi quý khách trong vài phút tới!`;
      
      const lowerText = userText.toLowerCase();
      if (lowerText.includes('mua') || lowerText.includes('sản phẩm')) {
        botResponse = 'Dạ, để đặt mua sản phẩm, quý khách chỉ cần vào mục "Cửa Hàng", bấm nút "MUA" ở sản phẩm mong muốn. Số lượng sẽ được tích lũy vào giỏ hàng 🛒 ở đầu trang ngay lập tức!';
      } else if (lowerText.includes('vip') || lowerText.includes('thành viên')) {
        botResponse = `Dạ, thành viên ${storeName} được hưởng nhiều ưu đãi, tích điểm thưởng và hỗ trợ giao hàng nhanh trên toàn quốc!`;
      } else if (lowerText.includes('đơn hàng') || lowerText.includes('giao hàng')) {
        botResponse = 'Dạ, quý khách có thể kiểm tra trạng thái vận chuyển chi tiết của đơn hàng trực tiếp ngay tại mục "Đơn Hàng" ở thanh chân trang!';
      } else if (lowerText.includes('lịch sử') || lowerText.includes('tiền')) {
        botResponse = 'Dạ, lịch sử nạp tiền và thanh toán của quý khách được bảo mật tuyệt đối và ghi nhận vĩnh viễn trên hệ thống đám mây Neon Postgres, hiển thị tại mục "Lịch Sử"!';
      }

      setSupportMessages(prev => [...prev, { sender: 'bot', text: botResponse }]);
    }, 800);
  };

  if (!currentUser || currentUser.role === 'admin' || currentView === 'admin') return null;

  return (
    <>
      {/* 1. Desktop Footer view */}
      <footer className="desktop-footer" id="app-desktop-footer">
        <div className="desktop-footer-copy"></div>
        <div className="desktop-footer-links">
          <span className={`desktop-footer-link ${currentView === 'home' && !activeModal ? 'active' : ''}`} onClick={() => handleTabClick('home')}>
            🏠 Trang Chủ
          </span>
          <span className="desktop-footer-link" onClick={() => handleTabClick('store')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            🛒 Cửa Hàng
            {offeredCount > 0 && (
              <span style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                borderRadius: '10px',
                padding: '2px 6px',
                fontSize: '0.68rem',
                fontWeight: '700',
                marginLeft: '4px',
                lineHeight: '1'
              }}>
                {offeredCount}
              </span>
            )}
          </span>
          <span className="desktop-footer-link" onClick={() => handleTabClick('orders')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            📦 Đơn Hàng
            {pendingCount > 0 && (
              <span style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                borderRadius: '10px',
                padding: '2px 6px',
                fontSize: '0.68rem',
                fontWeight: '700',
                marginLeft: '4px',
                lineHeight: '1'
              }}>
                {pendingCount}
              </span>
            )}
          </span>
          <span className="desktop-footer-link" onClick={() => handleTabClick('profile')}>
            👤 Của Tôi
          </span>
        </div>
      </footer>

      {/* 2. Mobile Bottom Navigation Tab Bar (Shopee Style) */}
      <nav 
        className="mobile-footer-nav" 
        id="app-mobile-footer"
        style={{
          display: isMobile ? 'flex' : 'none',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          margin: '0 auto',
          transform: 'none',
          width: '100%',
          maxWidth: '480px',
          height: '56px',
          background: '#ffffff',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border-glass)',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 400,
          padding: '0 6px',
          boxSizing: 'border-box',
          boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.08)'
        }}
      >
        <div 
          className={`footer-nav-item ${(currentView === 'home' && !activeModal) ? 'active' : ''}`} 
          onClick={() => handleTabClick('home')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            color: (currentView === 'home' && !activeModal) ? 'var(--primary)' : 'var(--text-secondary)',
            fontSize: '0.62rem',
            fontWeight: 500,
            cursor: 'pointer',
            flex: '1',
            minWidth: '0px',
            maxWidth: '80px',
            textAlign: 'center',
            padding: '4px 1px',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <span className="footer-nav-icon" style={{ fontSize: '1.15rem' }}>🏠</span>
          <span>Trang Chủ</span>
        </div>
        
        <div 
          className={`footer-nav-item ${(currentView === 'store' && !activeModal) ? 'active' : ''}`} 
          onClick={() => handleTabClick('store')}
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            color: (currentView === 'store' && !activeModal) ? 'var(--primary)' : 'var(--text-secondary)',
            fontSize: '0.62rem',
            fontWeight: 500,
            cursor: 'pointer',
            flex: '1',
            minWidth: '0px',
            maxWidth: '80px',
            textAlign: 'center',
            padding: '4px 1px',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <span className="footer-nav-icon" style={{ fontSize: '1.15rem' }}>🏬</span>
          <span>Cửa Hàng</span>
          {offeredCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '2px',
              right: '18px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              borderRadius: '50%',
              padding: '2px 5px',
              fontSize: '0.6rem',
              fontWeight: '700',
              lineHeight: '1',
              minWidth: '10px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              border: '1.5px solid #ffffff'
            }}>
              {offeredCount}
            </span>
          )}
        </div>
        
        <div 
          className={`footer-nav-item ${activeModal === 'orders' ? 'active' : ''}`} 
          onClick={() => handleTabClick('orders')}
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            color: activeModal === 'orders' ? 'var(--primary)' : 'var(--text-secondary)',
            fontSize: '0.62rem',
            fontWeight: 500,
            cursor: 'pointer',
            flex: '1',
            minWidth: '0px',
            maxWidth: '80px',
            textAlign: 'center',
            padding: '4px 1px',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <span className="footer-nav-icon" style={{ fontSize: '1.15rem' }}>📦</span>
          <span>Đơn Hàng</span>
          {pendingCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '2px',
              right: '18px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              borderRadius: '50%',
              padding: '2px 5px',
              fontSize: '0.6rem',
              fontWeight: '700',
              lineHeight: '1',
              minWidth: '10px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              border: '1.5px solid #ffffff'
            }}>
              {pendingCount}
            </span>
          )}
        </div>
        
        <div 
          className={`footer-nav-item ${activeModal === 'profile' ? 'active' : ''}`} 
          onClick={() => handleTabClick('profile')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            color: activeModal === 'profile' ? 'var(--primary)' : 'var(--text-secondary)',
            fontSize: '0.62rem',
            fontWeight: 500,
            cursor: 'pointer',
            flex: '1',
            minWidth: '0px',
            maxWidth: '80px',
            textAlign: 'center',
            padding: '4px 1px',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <span className="footer-nav-icon" style={{ fontSize: '1.15rem' }}>👤</span>
          <span>Của Tôi</span>
        </div>
      </nav>

      {/* 3. INTERACTIVE PREMIUM MODALS */}
      
      {/* A. Đơn Hàng (Order Management Modal) */}
      {activeModal === 'orders' && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-content glass-card animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--primary)' }}>📦 Đơn Hàng Của Bạn</h3>
              <button className="modal-close" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '4px' }}>
              {!currentUser ? (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                  Vui lòng đăng nhập để xem đơn hàng.
                </p>
              ) : ordersLoading ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>Đang tải đơn hàng...</p>
              ) : userOrders.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                  Bạn chưa có đơn hàng nào.
                </p>
              ) : (
                userOrders.map((order) => {
                  const borderColor =
                    order.status === 'completed'
                      ? 'var(--success)'
                      : order.status === 'cancelled'
                        ? 'var(--text-muted)'
                        : 'var(--primary)';
                  return (
                    <div
                      key={order.id}
                      className="glass-card"
                      style={{ padding: '16px', marginBottom: '12px', borderLeft: `3px solid ${borderColor}` }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>Mã Đơn: {order.order_code}</span>
                        <span className={`user-badge ${getOrderStatusBadgeClass(order.status)}`} style={{ fontSize: '0.7rem' }}>
                          {getOrderStatusLabel(order.status).toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {(order.items || []).map((item) => (
                          <p key={item.id}>🛍️ {item.quantity}x {item.product_name}</p>
                        ))}
                        <p>💰 Tiền gốc: <strong>{formatPriceVND(order.principal_amount ?? order.total_amount)}</strong></p>
                        {order.status === 'offered' && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>
                            Khách hàng đã đặt đơn hãy bấm mua để xử lý
                          </p>
                        )}
                        {order.commission_percent > 0 && order.status !== 'offered' && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--success)' }}>
                            🎁 Hoa hồng {order.commission_percent}%: {formatPriceVND(order.commission_amount)}
                            {order.status === 'pending' && ' (nhận khi Hệ Thống duyệt)'}
                          </p>
                        )}
                        {order.status_note && (
                          <p style={{ fontSize: '0.75rem', marginTop: '6px', color: 'var(--text-muted)' }}>
                            📍 {order.status_note}
                          </p>
                        )}
                        <p style={{ fontSize: '0.7rem', marginTop: '4px', color: 'var(--text-muted)' }}>
                          {formatDateTime(order.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}


      {/* B. Giỏ Hàng (Cart Modal) */}
      {activeModal === 'cart' && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-content glass-card animate-fade-in" style={{ width: '95%', maxWidth: '480px', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '16px' }}>
              <h3 className="modal-title" style={{ color: 'var(--primary)' }}>🛒 Giỏ Hàng Của Bạn</h3>
              <button className="modal-close" onClick={() => setActiveModal(null)}>×</button>
            </div>
            
            <div style={{ maxHeight: '280px', overflowY: 'auto', padding: '4px', marginBottom: '16px' }}>
              {cartItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)' }}>
                  <span style={{ fontSize: '3rem', display: 'block', marginBottom: '8px' }}>🛒</span>
                  <p style={{ fontSize: '0.95rem' }}>Giỏ hàng của bạn đang trống.</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Hãy thêm các sản phẩm yêu thích từ cửa hàng!</p>
                </div>
              ) : (
                cartItems.map((item) => {
                  const pct = parseCategoryCommissionPercent(item.category);
                  const commission = calcCommissionAmount(item.price * item.quantity, pct);
                  return (
                    <div 
                      key={item.id} 
                      className="glass-card" 
                      style={{ 
                        padding: '12px', 
                        marginBottom: '10px', 
                        display: 'flex', 
                        gap: '12px', 
                        alignItems: 'center',
                        position: 'relative',
                        border: '1px solid var(--border-glass)'
                      }}
                    >
                      {/* Product Icon */}
                      <div style={{ 
                        width: '50px', 
                        height: '50px', 
                        borderRadius: '6px', 
                        background: 'rgba(255,255,255,0.7)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: '1.8rem',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}>
                        {item.icon && (item.icon.startsWith('http') || item.icon.startsWith('data:') || item.icon.startsWith('/')) ? (
                          <img src={item.icon} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          item.icon || '📦'
                        )}
                      </div>
                      
                      {/* Product Name & Controls */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </h4>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                          Khu vực: {item.category}
                        </span>
                        
                        {/* Quantity Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button 
                            type="button"
                            onClick={() => handleDecrement(item.id)}
                            style={{ 
                              width: '24px', 
                              height: '24px', 
                              borderRadius: '4px', 
                              border: '1px solid var(--border-glass)', 
                              background: '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              fontSize: '0.8rem'
                            }}
                          >
                            -
                          </button>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>
                            {item.quantity}
                          </span>
                          <button 
                            type="button"
                            onClick={() => handleIncrement(item.id)}
                            style={{ 
                              width: '24px', 
                              height: '24px', 
                              borderRadius: '4px', 
                              border: '1px solid var(--border-glass)', 
                              background: '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              fontSize: '0.8rem'
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      
                      {/* Price & Delete */}
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: '52px' }}>
                        <button 
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: 'var(--danger)', 
                            cursor: 'pointer', 
                            fontSize: '1rem',
                            padding: '2px'
                          }}
                          title="Xóa sản phẩm"
                        >
                          🗑️
                        </button>
                        <div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                            {formatPriceVND(item.price * item.quantity)}
                          </span>
                          {pct > 0 && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--success)', display: 'block' }}>
                              + {formatPriceVND(commission)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Wallet Balance Info */}
            <div 
              className="glass-card" 
              style={{ 
                padding: '10px 14px', 
                background: 'rgba(255, 255, 255, 0.4)', 
                borderRadius: '8px', 
                marginBottom: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.85rem',
                border: '1px solid var(--border-glass)'
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>💳 Ví tài khoản của bạn:</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {walletLoading ? 'Đang tải...' : formatPriceVND(walletBalance)}
              </strong>
            </div>

            {/* Insufficient Balance warning */}
            {!walletLoading && cartItems.length > 0 && totalAmount > walletBalance && (
              <div 
                className="glass-card animate-fade-in" 
                style={{ 
                  padding: '12px', 
                  background: 'rgba(238, 77, 45, 0.08)', 
                  border: '1px solid rgba(238, 77, 45, 0.35)', 
                  borderRadius: '8px', 
                  color: '#ee4d2d', 
                  fontSize: '0.82rem', 
                  marginBottom: '14px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px' 
                }}
              >
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span>⚠️</span>
                  <span style={{ fontWeight: 600 }}>Số dư ví không đủ thanh toán!</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Tổng cộng: <strong>{formatPriceVND(totalAmount)}</strong>. Bạn cần thêm{' '}
                  <strong style={{ color: '#ee4d2d' }}>{formatPriceVND(totalAmount - walletBalance)}</strong>.
                </p>
                <button 
                  type="button" 
                  className="btn-buy" 
                  style={{ 
                    alignSelf: 'flex-start', 
                    padding: '4px 10px', 
                    fontSize: '0.72rem', 
                    height: 'auto', 
                    minHeight: 'auto', 
                    background: 'var(--primary)',
                    color: '#ffffff',
                    borderRadius: '4px'
                  }} 
                  onClick={() => handleDepositFromCart()}
                >
                  💬 Nạp tiền ngay
                </button>
              </div>
            )}

            {/* Summary Details */}
            {cartItems.length > 0 && (
              <div style={{ fontSize: '0.85rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Tổng hoa hồng ước tính:</span>
                  <strong style={{ color: 'var(--success)' }}>+ {formatPriceVND(totalCommission)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Tổng cộng thanh toán:</span>
                  <strong style={{ color: 'var(--primary)', fontWeight: 800 }}>{formatPriceVND(totalAmount)}</strong>
                </div>
              </div>
            )}

            <div className="modal-footer" style={{ marginTop: '0', paddingTop: '12px' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setActiveModal(null)}
                disabled={isSubmittingOrder}
              >
                Tiếp tục mua sắm
              </button>
              {cartItems.length > 0 && (
                <button 
                  type="button" 
                  className="btn-buy" 
                  onClick={handleCheckout}
                  disabled={totalAmount > walletBalance || isSubmittingOrder || walletLoading}
                  style={{
                    background: (totalAmount > walletBalance) ? 'var(--text-muted)' : 'var(--primary)',
                    color: '#ffffff',
                    cursor: (totalAmount > walletBalance) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmittingOrder ? 'Đang đặt đơn...' : 'Xác nhận đặt hàng'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}



      {/* C. CSKH (Customer Support Live Chat Modal) */}
      {activeModal === 'support' && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-content glass-card animate-fade-in" style={{ width: '95%', maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--primary)' }}>💬 CSKH {storeName}</h3>
              <button className="modal-close" onClick={() => setActiveModal(null)}>×</button>
            </div>
            
            {cskhConfig.cskh_type === 'built_in' ? (
              <>
                {/* Message Area */}
                <div style={{
                  height: '250px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '10px 4px',
                  marginBottom: '16px',
                  borderBottom: '1px solid var(--border-glass)'
                }}>
                  {supportMessages.map((msg, idx) => (
                    <div key={idx} style={{
                      alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      background: msg.sender === 'user' ? 'rgba(238, 77, 45, 0.12)' : '#f5f5f5',
                      border: msg.sender === 'user' ? '1px solid rgba(238, 77, 45, 0.35)' : '1px solid var(--border-glass)',
                      color: msg.sender === 'user' ? 'var(--primary)' : 'var(--text-primary)',
                      padding: '8px 14px',
                      borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      fontSize: '0.85rem',
                      lineHeight: '1.4'
                    }}>
                      {msg.text}
                    </div>
                  ))}
                </div>

                {/* Input Form */}
                <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Nhập câu hỏi của bạn (ví dụ: thẻ VIP)..."
                    className="form-input"
                    style={{ flex: 1, padding: '10px 14px !important', height: '40px' }}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                  />
                  <button type="submit" className="btn-buy" style={{ height: '40px', padding: '0 16px' }}>Gửi</button>
                </form>
              </>
            ) : (
              <div style={{
                padding: '30px 16px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px'
              }}>
                {/* Brand or Provider Visual Icon */}
                <div style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  background: 'rgba(238, 77, 45, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.5rem',
                  animation: 'pulse 2s infinite ease-in-out'
                }}>
                  {cskhConfig.cskh_type === 'crisp' && '💬'}
                  {cskhConfig.cskh_type === 'tawk' && '⚡'}
                  {cskhConfig.cskh_type === 'zalo' && '📱'}
                  {cskhConfig.cskh_type === 'custom' && '⚙️'}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {cskhConfig.cskh_type === 'crisp' && 'Kết nối Crisp Live Chat'}
                    {cskhConfig.cskh_type === 'tawk' && 'Kết nối Tawk.to Live Chat'}
                    {cskhConfig.cskh_type === 'zalo' && 'Hỗ trợ trực tuyến qua Zalo'}
                    {cskhConfig.cskh_type === 'custom' && 'Kết nối Kênh Hỗ trợ Khách hàng'}
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                    {cskhConfig.cskh_type === 'zalo' && (cskhConfig.cskh_script.startsWith('http://') || cskhConfig.cskh_script.startsWith('https://'))
                      ? 'Vui lòng bấm vào nút bên dưới để mở cửa sổ chat hỗ trợ Zalo chính thức của chúng tôi.'
                      : 'Hệ thống đã kích hoạt và kết nối thành công kênh hỗ trợ Live Chat bên thứ ba.'}
                  </p>
                </div>

                {cskhConfig.cskh_type === 'zalo' && (cskhConfig.cskh_script.startsWith('http://') || cskhConfig.cskh_script.startsWith('https://')) ? (
                  <a
                    href={cskhConfig.cskh_script}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-buy"
                    style={{
                      height: '42px',
                      padding: '0 24px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      background: '#0068ff',
                      color: '#ffffff',
                      borderRadius: '8px',
                      fontWeight: 600,
                      textDecoration: 'none',
                      boxShadow: '0 4px 12px rgba(0, 104, 255, 0.25)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    💬 Chat Zalo Ngay
                  </a>
                ) : (
                  <button
                    type="button"
                    className="btn-buy"
                    style={{
                      height: '42px',
                      padding: '0 24px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      borderRadius: '8px',
                      fontWeight: 600,
                      boxShadow: '0 4px 12px rgba(238, 77, 45, 0.25)',
                      transition: 'all 0.3s ease'
                    }}
                    onClick={() => {
                      if (cskhConfig.cskh_type === 'crisp' && window.$crisp) {
                        window.$crisp.push(["do", "chat:show"]);
                        window.$crisp.push(["do", "chat:open"]);
                      } else if (cskhConfig.cskh_type === 'tawk' && window.Tawk_API && typeof window.Tawk_API.showWidget === 'function') {
                        window.Tawk_API.showWidget();
                        window.Tawk_API.maximize();
                      } else {
                        // Re-trigger injection in case it was missed
                        injectThirdPartyChat(cskhConfig.cskh_type, cskhConfig.cskh_script);
                      }
                    }}
                  >
                    🚀 Bắt Đầu Chat Ngay
                  </button>
                )}

                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                  * Khi bạn đóng bảng điều khiển này, cửa sổ chat hỗ trợ cũng sẽ tự động ẩn đi hoàn toàn khỏi trang chủ.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeModal === 'profile' && (
        <ProfilePanel
          storeName={storeName}
          currentUser={currentUser}
          onClose={() => setActiveModal(null)}
          onLogout={onLogout}
          onDepositToSupport={handleDepositFromProfile}
          addToast={addToast}
        />
      )}
    </>
  );
}
