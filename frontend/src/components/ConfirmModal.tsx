import { useState } from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: (password: string) => Promise<void>;
  onCancel: () => void;
  error?: string;
}

function ConfirmModal({ open, title, message, confirmLabel, onConfirm, onCancel, error }: ConfirmModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  if (!open) return null;

  const handleConfirm = async () => {
    if (!password.trim()) {
      setLocalError('Please enter your password');
      return;
    }
    setLocalError('');
    setLoading(true);
    try {
      await onConfirm(password);
      setPassword('');
    } catch {
      // error handled by parent via error prop
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPassword('');
    setLocalError('');
    onCancel();
  };

  const displayError = error || localError;

  return (
    <>
      <div className="confirm-overlay" onClick={handleCancel} />
      <div className="confirm-modal">
        <button className="confirm-close" onClick={handleCancel}>
          <FiX size={18} />
        </button>
        <div className="confirm-icon">
          <FiAlertTriangle size={32} />
        </div>
        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        <div className="confirm-password">
          <label htmlFor="confirm-pw">Enter your password to confirm</label>
          <input
            id="confirm-pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
          />
        </div>
        {displayError && <p className="confirm-error">{displayError}</p>}
        <div className="confirm-actions">
          <button className="confirm-btn-cancel" onClick={handleCancel}>
            No, cancel
          </button>
          <button className="confirm-btn-confirm" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}

export default ConfirmModal;
