import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { maskPhone, formatPriceVND, formatDateTime } from '../utils/format';

const ROLE_LABEL = {
  admin: 'Quản trị viên',
  user: 'Thành viên',
};

export default function ProfilePanel({
  storeName,
  currentUser,
  onClose,
  onLogout,
  onDepositToSupport,
  addToast,
}) {
  const [loading, setLoading] = useState(true);
  const [walletData, setWalletData] = useState(null);
  const [view, setView] = useState('main');
  const [submitting, setSubmitting] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    bankName: '',
    accountNumber: '',
    accountHolder: currentUser.name || '',
  });

  const loadWallet = async () => {
    setLoading(true);
    try {
      const data = await api.getWallet(currentUser.phone, currentUser);
      setWalletData(data);
    } catch (err) {
      setWalletData({
        user: currentUser,
        balance: 0,
        transactions: [],
      });
      addToast('danger', 'Lỗi', err.message || 'Không tải được thông tin ví.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
  }, [currentUser.phone]);

  const handleDeposit = () => {
    onClose();
    onDepositToSupport();
  };

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    const amount = Math.floor(Number(withdrawForm.amount));
    if (!withdrawForm.bankName.trim() || !withdrawForm.accountNumber.trim() || !withdrawForm.accountHolder.trim()) {
      addToast('danger', 'Thiếu thông tin', 'Vui lòng nhập đầy đủ thông tin ngân hàng.');
      return;
    }
    if (!amount || amount < 10000) {
      addToast('danger', 'Số tiền', 'Số tiền rút tối thiểu là 10.000đ.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.requestWithdraw({
        phone: currentUser.phone,
        amount,
        bankName: withdrawForm.bankName.trim(),
        accountNumber: withdrawForm.accountNumber.trim(),
        accountHolder: withdrawForm.accountHolder.trim(),
      });
      addToast('success', 'Yêu cầu rút tiền', result.message || 'Đã gửi yêu cầu rút tiền.');
      setView('main');
      setWithdrawForm((f) => ({ ...f, amount: '' }));
      await loadWallet();
    } catch (err) {
      addToast('danger', 'Không thành công', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const transactions = walletData?.transactions || [];

  const userInfo = walletData?.user || currentUser;
  const isUserFrozen = userInfo?.is_frozen === true || currentUser?.is_frozen === true;
  const balance = walletData?.balance ?? 0;
  const joinDate = userInfo.created_at
    ? formatDateTime(userInfo.created_at).split(',')[0]
    : '—';

  const txLabel = (tx) => {
    if (tx.type === 'deposit') return 'Nạp tiền';
    if (tx.type === 'purchase') return 'Mua hàng';
    if (tx.type === 'order_refund') return 'Hoàn tiền gốc';
    if (tx.type === 'commission') return 'Hoa hồng đơn hàng';
    if (tx.type === 'withdraw' && tx.status === 'pending') return 'Rút tiền (chờ duyệt)';
    if (tx.type === 'withdraw' && tx.status === 'rejected') return 'Rút tiền (từ chối)';
    if (tx.type === 'withdraw') return 'Rút tiền';
    return tx.type;
  };

  const txAmountClass = (tx) => {
    if (tx.type === 'purchase') return 'profile-tx-amount withdraw';
    if (
      (tx.type === 'deposit' || tx.type === 'order_refund' || tx.type === 'commission') &&
      tx.status === 'completed'
    ) {
      return 'profile-tx-amount deposit';
    }
    if (tx.type === 'withdraw' && tx.status === 'completed') return 'profile-tx-amount withdraw';
    return 'profile-tx-amount pending';
  };

  const txAmountPrefix = (tx) => {
    if (tx.type === 'purchase' || (tx.type === 'withdraw' && tx.status === 'completed')) return '−';
    if (tx.type === 'deposit' || tx.type === 'order_refund' || tx.type === 'commission') return '+';
    return '';
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content profile-modal animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title" style={{ color: 'var(--primary)' }}>
            {view === 'withdraw' ? '🏦 Rút tiền' : '👤 Của Tôi'}
          </h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>

        {loading && view === 'main' ? (
          <div className="profile-loading">Đang tải thông tin...</div>
        ) : view === 'withdraw' ? (
          isUserFrozen ? (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>❄️</div>
              <p style={{ 
                color: '#ef4444', 
                fontWeight: '600', 
                fontSize: '1.05rem', 
                lineHeight: '1.6',
                background: 'rgba(239, 68, 68, 0.08)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                marginBottom: '24px'
              }}>
                Tài khoản của bạn đang bị đóng băng. Vui lòng liên hệ CSKH để được hỗ trợ giải ngân.
              </p>
              <button type="button" className="btn-secondary" style={{ width: '100%' }} onClick={() => setView('main')}>
                Quay lại
              </button>
            </div>
          ) : (
            <form className="auth-form profile-withdraw-form" onSubmit={handleWithdrawSubmit}>
              <p className="profile-withdraw-hint">
                Nhập thông tin tài khoản ngân hàng nhận tiền. Yêu cầu sẽ được CSKH xử lý sau khi duyệt.
              </p>
              <div className="form-group">
                <label className="form-label" htmlFor="w-amount">Số tiền rút (VNĐ)</label>
                <div className="input-wrapper">
                  <span className="input-icon">💰</span>
                  <input
                    id="w-amount"
                    type="number"
                    className="form-input"
                    min="10000"
                    step="1000"
                    placeholder="Tối thiểu 10.000đ"
                    value={withdrawForm.amount}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                    required
                  />
                </div>
                <span className="profile-field-note">
                  Số dư khả dụng: <strong>{formatPriceVND(balance)}</strong>
                </span>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="w-bank">Tên ngân hàng</label>
                <div className="input-wrapper">
                  <span className="input-icon">🏦</span>
                  <input
                    id="w-bank"
                    type="text"
                    className="form-input"
                    placeholder="VD: Vietcombank, Techcombank..."
                    value={withdrawForm.bankName}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, bankName: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="w-acc">Số tài khoản</label>
                <div className="input-wrapper">
                  <span className="input-icon">🔢</span>
                  <input
                    id="w-acc"
                    type="text"
                    className="form-input"
                    placeholder="Nhập số tài khoản"
                    value={withdrawForm.accountNumber}
                    onChange={(e) =>
                      setWithdrawForm({ ...withdrawForm, accountNumber: e.target.value.replace(/\s/g, '') })
                    }
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="w-holder">Chủ tài khoản</label>
                <div className="input-wrapper">
                  <span className="input-icon">👤</span>
                  <input
                    id="w-holder"
                    type="text"
                    className="form-input"
                    placeholder="Họ tên trùng tài khoản ngân hàng"
                    value={withdrawForm.accountHolder}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, accountHolder: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer profile-withdraw-footer">
                <button type="button" className="btn-secondary" onClick={() => setView('main')}>
                  Quay lại
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Đang gửi...' : 'Gửi yêu cầu rút'}
                </button>
              </div>
            </form>
          )
        ) : (
          <>
            <div className="profile-vip-card">
              <div className="profile-vip-card-top">
                <span className="profile-vip-badge">{storeName.toUpperCase()} MEMBER</span>
                <span aria-hidden>👤</span>
              </div>
              <div className="profile-readonly-row">
                <span className="profile-readonly-label">Họ và tên</span>
                <span className="profile-readonly-value">{userInfo.name}</span>
              </div>
              <div className="profile-readonly-grid">
                <div>
                  <span className="profile-readonly-label">Số điện thoại</span>
                  <span className="profile-readonly-value profile-phone-masked">
                    {maskPhone(userInfo.phone)}
                  </span>
                </div>
                <div>
                  <span className="profile-readonly-label">Loại tài khoản</span>
                  <span className="profile-readonly-value">
                    {ROLE_LABEL[userInfo.role] || 'Thành viên'}
                  </span>
                </div>
              </div>
            </div>

            <div className="profile-meta-list">
              <div className="profile-meta-item">
                <span>Mã khách hàng</span>
                <strong>USR-{String(userInfo.phone).slice(-4)}</strong>
              </div>
              <div className="profile-meta-item">
                <span>Ngày tham gia</span>
                <strong>{joinDate}</strong>
              </div>
            </div>

            <div className="profile-wallet glass-panel">
              <div className="profile-wallet-header">
                <span className="profile-wallet-title">💳 Ví tiền</span>
                <span className="profile-wallet-balance">{formatPriceVND(balance)}</span>
              </div>
              <div className="profile-wallet-actions">
                <button type="button" className="btn-primary profile-btn-deposit" onClick={handleDeposit}>
                  Nạp tiền
                </button>
                <button
                  type="button"
                  className={isUserFrozen ? "btn-buy profile-btn-withdraw frozen" : "btn-buy profile-btn-withdraw"}
                  style={isUserFrozen ? { opacity: 0.65, backgroundColor: '#6b7280', backgroundImage: 'none' } : undefined}
                  onClick={() => setView('withdraw')}
                >
                  {isUserFrozen ? '❄️ Bị Đóng Băng' : 'Rút tiền'}
                </button>
              </div>
            </div>

            <section className="profile-tx-section">
              <h4 className="profile-tx-title">Lịch sử giao dịch</h4>
              <div className="profile-tx-table-wrap">
                {transactions.length === 0 ? (
                  <p className="profile-tx-empty">Chưa có giao dịch nạp hoặc rút.</p>
                ) : (
                  <table className="profile-tx-table">
                    <thead>
                      <tr>
                        <th>Thời gian</th>
                        <th>Loại</th>
                        <th>Số tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id}>
                          <td>{formatDateTime(tx.created_at)}</td>
                          <td>{txLabel(tx)}</td>
                          <td className={txAmountClass(tx)}>
                            {txAmountPrefix(tx)}
                            {formatPriceVND(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <div className="modal-footer profile-main-footer">
              <button
                type="button"
                className="btn-logout profile-btn-logout"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
              >
                Đăng xuất
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Đóng
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
