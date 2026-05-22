import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import Home from './components/Home';
import AdminDashboard from './components/AdminDashboard';
import NavBar from './components/NavBar';
import Toast from './components/Toast';
import Footer from './components/Footer';
import { api } from './utils/api';
import { DEFAULT_STORE_NAME } from './utils/brand';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [toasts, setToasts] = useState([]);
  const [cartItems, setCartItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ecommerce_cart') || '[]');
    } catch (e) {
      return [];
    }
  });

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const [activeModal, setActiveModal] = useState(null);
  const [storeName, setStoreName] = useState(
    () => localStorage.getItem('ecommerce_store_name') || DEFAULT_STORE_NAME
  );
  const [isOffline, setIsOffline] = useState(() => api.isFallback);

  const addToast = (type, title, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const applyStoreName = (name) => {
    const trimmed = name?.trim() || DEFAULT_STORE_NAME;
    setStoreName(trimmed);
    localStorage.setItem('ecommerce_store_name', trimmed);
    document.title = `${trimmed} - Cửa hàng trực tuyến`;
  };

  useEffect(() => {
    if (!localStorage.getItem('ecommerce_sponsor_code')) {
      localStorage.setItem('ecommerce_sponsor_code', 'CTV123');
    }

    api.onFallbackChange = (val) => setIsOffline(val);
    setIsOffline(api.isFallback);

    api.getStoreName().then(applyStoreName).catch(() => applyStoreName(DEFAULT_STORE_NAME));

    const storedUser = localStorage.getItem('ecommerce_current_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
        if (user.role === 'admin') {
          setCurrentView('admin');
        } else {
          setCurrentView('home');
        }
      } catch (e) {
        localStorage.removeItem('ecommerce_current_user');
      }
    }

    return () => {
      api.onFallbackChange = null;
    };
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    localStorage.setItem('ecommerce_current_user', JSON.stringify(user));
    if (user.role === 'admin') {
      setCurrentView('admin');
    } else {
      setCurrentView('home');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('login');
    setCartItems([]);
    localStorage.removeItem('ecommerce_cart');
    localStorage.removeItem('ecommerce_current_user');
    addToast('success', 'Đăng xuất', 'Đã đăng xuất tài khoản thành công');
  };

  const renderView = () => {
    if (!currentUser) {
      if (currentView === 'register') {
        return (
          <RegisterForm
            storeName={storeName}
            onRegisterSuccess={() => setCurrentView('login')}
            switchToLogin={() => setCurrentView('login')}
            addToast={addToast}
          />
        );
      }
      return (
        <LoginForm
          storeName={storeName}
          onLoginSuccess={handleLoginSuccess}
          switchToRegister={() => setCurrentView('register')}
          addToast={addToast}
        />
      );
    }

    if (currentUser.role === 'admin') {
      if (currentView === 'home' || currentView === 'store') {
        return (
          <Home
            storeName={storeName}
            currentUser={currentUser}
            addToast={addToast}
            cartItems={cartItems}
            setCartItems={setCartItems}
            setActiveModal={setActiveModal}
            currentView={currentView}
          />
        );
      }
      return (
        <AdminDashboard
          storeName={storeName}
          onStoreNameChange={applyStoreName}
          addToast={addToast}
        />
      );
    }

    return (
      <Home
        storeName={storeName}
        currentUser={currentUser}
        addToast={addToast}
        cartItems={cartItems}
        setCartItems={setCartItems}
        setActiveModal={setActiveModal}
        currentView={currentView}
      />
    );
  };

  return (
    <div className="app-container" id="app-root-container">
      <NavBar
        storeName={storeName}
        currentUser={currentUser}
        onLogout={handleLogout}
        currentView={currentView}
        setCurrentView={setCurrentView}
        cartCount={cartCount}
        setActiveModal={setActiveModal}
      />

      {isOffline && (
        <div className="offline-banner animate-slide-down" id="connection-offline-banner">
          <span className="offline-icon">⚠️</span>
          <span className="offline-text">
            Bạn đang chạy ở <strong>Chế độ Ngoại tuyến (Offline)</strong>. Kết nối tới Neon Database thất bại. Dữ liệu chỉ được lưu tạm thời trên trình duyệt này.
          </span>
        </div>
      )}

      <main id="app-main-content">{renderView()}</main>

      <Toast toasts={toasts} removeToast={removeToast} />

      <Footer
        storeName={storeName}
        currentUser={currentUser}
        currentView={currentView}
        setCurrentView={setCurrentView}
        activeModal={activeModal}
        setActiveModal={setActiveModal}
        cartItems={cartItems}
        setCartItems={setCartItems}
        onLogout={handleLogout}
        addToast={addToast}
      />
    </div>
  );
}
