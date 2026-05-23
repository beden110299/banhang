import React from 'react';

export default function NavBar({ storeName, currentUser, onLogout, currentView, setCurrentView, cartCount, setActiveModal }) {
  if (!currentUser) return null;

  return (
    <nav className="navbar" id="app-navbar">
      {/* Header Row: Contains Brand (left) and Shopping Cart Status (right) */}
      <div className="navbar-header-row">
        <a 
          href="#" 
          className="nav-brand" 
          onClick={(e) => {
            e.preventDefault();
            if (currentUser.role === 'admin') {
              setCurrentView('admin');
            } else {
              setCurrentView('home');
            }
          }} 
          id="navbar-brand"
        >
          {storeName}
        </a>

        <div className="navbar-right-widgets" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Real-time Shopping Cart indicator replacing hamburger menu on mobile */}
          {currentView !== 'admin' && (
            <div 
              className="navbar-cart-indicator" 
              id="navbar-cart-indicator"
              onClick={() => setActiveModal('cart')}
              style={{ cursor: 'pointer' }}
            >
              <span className="navbar-cart-emoji">🛒</span>
              <span className="navbar-cart-badge" id="navbar-cart-count">{cartCount}</span>
            </div>
          )}

          {currentView !== 'admin' && (
            <button 
              className="btn-cskh header-cskh-btn" 
              onClick={() => setActiveModal('support')} 
              id="btn-navbar-support-mobile"
            >
              💬 CSKH
            </button>
          )}

          {currentView === 'admin' && (
            <button 
              className="btn-logout header-cskh-btn" 
              onClick={onLogout} 
              id="btn-navbar-logout-mobile"
              style={{
                background: '#ffffff',
                border: 'none',
                color: '#ee4d2d',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 700,
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; }}
            >
              🚪 Đăng xuất
            </button>
          )}
        </div>
      </div>

      {/* Navigation menu: Direct horizontal access with high touch-target tabs */}
      <div className="nav-menu" id="navbar-menu">
        <div className="nav-links-group">
          {currentView !== 'admin' && (
            <span 
              className="nav-item navbar-cart-pill-desktop" 
              id="nav-item-home"
              style={{ 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                padding: '8px 16px',
                borderRadius: '20px',
                fontWeight: '700',
                fontSize: '0.85rem',
                transition: 'all 0.2s ease-in-out',
                boxShadow: 'none'
              }}
              onClick={() => setActiveModal('cart')}
              onMouseOver={(e) => { 
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.28)';
                e.currentTarget.style.borderColor = '#ffffff';
                e.currentTarget.style.transform = 'scale(1.03)';
              }}
              onMouseOut={(e) => { 
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.35)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <span>🛒 Giỏ hàng</span>
              <span className="navbar-cart-badge" id="nav-item-cart-count">{cartCount}</span>
            </span>
          )}
          
          {currentUser.role === 'admin' && (
            <span 
              className={`nav-item ${currentView === 'admin' ? 'active' : ''}`} 
              style={{ cursor: 'pointer' }}
              id="nav-item-admin"
              onClick={() => setCurrentView('admin')}
            >
              🛡️ Quản trị
            </span>
          )}
        </div>

        <div className="nav-profile" id="navbar-profile">
          <div className="profile-info-block">
            <span className="profile-name" id="navbar-user-name">{currentUser.name}</span>
            <span className={`user-badge ${currentUser.role}`} id="navbar-user-badge">
              {currentUser.role === 'admin' ? 'Quản trị' : 'Thành viên'}
            </span>
          </div>
          {currentView !== 'admin' ? (
            <button 
              className="btn-cskh" 
              onClick={() => setActiveModal('support')} 
              id="btn-navbar-support"
            >
              💬 CSKH
            </button>
          ) : (
            <button 
              className="btn-logout" 
              onClick={onLogout} 
              id="btn-navbar-logout"
              style={{
                background: '#ffffff',
                border: 'none',
                color: '#ee4d2d',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                transition: 'all 0.2s ease-in-out',
                marginLeft: '12px'
              }}
              onMouseOver={(e) => { 
                e.currentTarget.style.background = '#fef2f2';
                e.currentTarget.style.transform = 'scale(1.03)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.18)';
              }}
              onMouseOut={(e) => { 
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.12)';
              }}
            >
              🚪 Đăng xuất
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
