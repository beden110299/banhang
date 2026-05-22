import React, { useState } from 'react';
import { api } from '../utils/api';

export default function RegisterForm({ storeName, onRegisterSuccess, switchToLogin, addToast }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [sponsorCode, setSponsorCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Validation
    if (!name.trim()) {
      addToast('danger', 'Lỗi nhập liệu', 'Vui lòng nhập họ và tên');
      return;
    }

    if (!phone.trim() || phone.length < 10) {
      addToast('danger', 'Lỗi nhập liệu', 'Vui lòng nhập số điện thoại hợp lệ (tối thiểu 10 chữ số)');
      return;
    }

    if (!password || password.length < 6) {
      addToast('danger', 'Lỗi nhập liệu', 'Mật khẩu phải có độ dài tối thiểu từ 6 ký tự');
      return;
    }

    if (!sponsorCode.trim()) {
      addToast('danger', 'Lỗi nhập liệu', 'Vui lòng nhập mã bảo lãnh');
      return;
    }

    try {
      await api.register(name, phone, password, sponsorCode);
      
      addToast('success', 'Đăng ký thành công', 'Tài khoản đã được khởi tạo. Bạn có thể đăng nhập ngay!');
      
      // Auto switch to login
      setTimeout(() => {
        switchToLogin();
      }, 1500);
    } catch (err) {
      addToast('danger', 'Đăng ký thất bại', err.message);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-container glass-panel animate-fade-in" id="register-container">
        <div className="auth-header">
          <span className="brand-logo" id="register-logo">{storeName}</span>
          <p className="auth-subtitle" id="register-subtitle">Đăng ký tài khoản thành viên mới</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" id="register-form">
          <div className="form-group">
            <label className="form-label" htmlFor="register-name">Họ và tên</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </span>
              <input
                type="text"
                id="register-name"
                className="form-input"
                placeholder="Nhập đầy đủ họ và tên"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-phone">Số điện thoại</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </span>
              <input
                type="tel"
                id="register-phone"
                className="form-input"
                placeholder="Nhập số điện thoại đăng ký"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} // only allow digits
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-password">Mật khẩu</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                id="register-password"
                className="form-input"
                placeholder="Tối thiểu 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="btn-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                id="register-toggle-password"
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

          <div className="form-group">
            <label className="form-label" htmlFor="register-sponsor">Mã bảo lãnh (CTV)</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </span>
              <input
                type="text"
                id="register-sponsor"
                className="form-input"
                placeholder="Nhập mã bảo lãnh để đăng ký"
                value={sponsorCode}
                onChange={(e) => setSponsorCode(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" id="btn-register-submit">
            Đăng ký tài khoản
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
          </button>
        </form>

        <div className="auth-footer" id="register-footer">
          Đã có tài khoản?{' '}
          <a href="#" className="auth-link" onClick={(e) => { e.preventDefault(); switchToLogin(); }} id="link-goto-login">
            Đăng nhập
          </a>
        </div>
      </div>
    </div>
  );
}
