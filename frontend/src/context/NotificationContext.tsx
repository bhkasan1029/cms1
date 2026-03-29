import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  getNotificationsApi,
  getUnreadCountApi,
  markAsReadApi,
  markAllAsReadApi,
} from '../api/notifications';
import type { NotificationRecord } from '../api/notifications';
import NotificationToast from '../components/NotificationToast';
import type { Toast } from '../components/NotificationToast';

interface NotificationContextType {
  notifications: NotificationRecord[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  fetchNotifications: (category?: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const isFirstFetchRef = useRef(true);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchNotifications = useCallback(async (category?: string) => {
    setIsLoading(true);
    try {
      const data = await getNotificationsApi(category);
      const incoming = data.notifications;

      // On first fetch, just record known IDs without showing toasts
      if (isFirstFetchRef.current) {
        isFirstFetchRef.current = false;
        knownIdsRef.current = new Set(incoming.map((n) => n.id));
      } else {
        // On subsequent polls, detect new notifications and show as toasts
        const newOnes = incoming.filter((n) => !knownIdsRef.current.has(n.id));
        if (newOnes.length > 0) {
          const newToasts: Toast[] = newOnes.map((n) => ({
            id: n.id,
            title: n.title,
            message: n.message,
          }));
          setToasts((prev) => [...newToasts, ...prev]);
          newOnes.forEach((n) => knownIdsRef.current.add(n.id));
        }
      }

      setNotifications(incoming);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await getUnreadCountApi();
      setUnreadCount(data.count);
    } catch {
      // ignore
    }
  }, []);

  // Fetch initial data + poll every 30 seconds
  useEffect(() => {
    if (!isAuthenticated || !token) {
      setNotifications([]);
      setUnreadCount(0);
      isFirstFetchRef.current = true;
      knownIdsRef.current.clear();
      return;
    }

    fetchNotifications();
    fetchUnreadCount();

    const interval = setInterval(() => {
      fetchNotifications();
      fetchUnreadCount();
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, token, fetchNotifications, fetchUnreadCount]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await markAsReadApi(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await markAllAsReadApi();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        fetchNotifications,
      }}
    >
      {children}
      <NotificationToast toasts={toasts} onDismiss={dismissToast} />
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
