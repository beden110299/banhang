import React, { useEffect, useState } from 'react';

export default function Toast({ toasts, removeToast }) {
  return (
    <div className="toast-container" id="toast-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }) {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onRemove();
    }, 300); // matches animation duration
  };

  const getIcon = () => {
    if (toast.type === 'success') {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      );
    }
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    );
  };

  return (
    <div className={`toast ${toast.type} ${isClosing ? 'closing' : ''}`} role="alert" id={`toast-${toast.id}`}>
      <div style={{ color: toast.type === 'success' ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center' }}>
        {getIcon()}
      </div>
      <div className="toast-content">
        <div className="toast-title" id={`toast-title-${toast.id}`}>{toast.title}</div>
        <div className="toast-message" id={`toast-message-${toast.id}`}>{toast.message}</div>
      </div>
      <button className="toast-close" onClick={handleClose} aria-label="Close notification" id={`toast-close-${toast.id}`}>
        &times;
      </button>
    </div>
  );
}
