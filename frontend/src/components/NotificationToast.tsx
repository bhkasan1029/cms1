import { useEffect } from 'react';
import { FiX } from 'react-icons/fi';

export interface Toast {
  id: string;
  title: string;
  message: string;
}

interface NotificationToastProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const AUTO_DISMISS_MS = 5000;

function NotificationToast({ toasts, onDismiss }: NotificationToastProps) {
  useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map((t) =>
      setTimeout(() => onDismiss(t.id), AUTO_DISMISS_MS),
    );

    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className="toast-item">
          <button className="toast-close" onClick={() => onDismiss(t.id)}>
            <FiX size={13} />
          </button>
          <div className="toast-content">
            <span className="toast-title">{t.title}</span>
            <span className="toast-message">{t.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default NotificationToast;
