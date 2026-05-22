import React, { useState } from 'react';
import { api } from '../utils/api';

export default function LoginForm({ storeName, onLoginSuccess, switchToRegister, addToast }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!phone.trim()) {
      addToast('danger', 'Lỗi nhập liệu', 'Vui lòng nhập số điện thoại');
      return;
    }

    if (!password) {
      addToast('danger', 'Lỗi nhập liệu', 'Vui lòng nhập mật khẩu');
      return;
    }

    try {
      const user = await api.login(phone, password);
      onLoginSuccess(user);
      
      if (api.isFallback) {
        addToast('success', 'Đăng nhập thành công', `Chào mừng ${user.name} (Chế độ Ngoại tuyến)`);
      } else {
        addToast('success', 'Đăng nhập thành công', `Chào mừng ${user.name} đã kết nối dữ liệu trực tuyến!`);
      }
    } catch (err) {
      addToast('danger', 'Đăng nhập thất bại', err.message);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-container glass-panel animate-fade-in" id="login-container">
        <div className="auth-header">
          <span className="brand-logo" id="login-logo">{storeName}</span>
          <p className="auth-subtitle" id="login-subtitle">Đăng nhập để trải nghiệm thế giới mua sắm cao cấp</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" id="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="login-phone">Số điện thoại</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </span>
              <input
                type="tel"
                id="login-phone"
                className="form-input"
                placeholder="Nhập số điện thoại của bạn"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} // only allow digits
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Mật khẩu</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                id="login-password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="btn-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                id="login-toggle-password"
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary" id="btn-login-submit">
            Đăng nhập
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </form>

        <div className="auth-footer" id="login-footer">
          Chưa có tài khoản?{' '}
          <a href="#" className="auth-link" onClick={(e) => { e.preventDefault(); switchToRegister(); }} id="link-goto-register">
            Đăng ký ngay
          </a>
        </div>
      </div>
    </div>
  );
}
