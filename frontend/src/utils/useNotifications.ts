import { useState, useCallback } from 'react';
import { ToastNotification } from '../components/NotificationToast';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  const addNotification = useCallback((
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    duration: number = 5000,
    action?: { label: string; onClick: () => void }
  ) => {
    const id = `notif_${Date.now()}_${Math.random()}`;
    const notification: ToastNotification = {
      id,
      type,
      message,
      duration,
      action,
    };

    setNotifications(prev => [...prev, notification]);
    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    addNotification,
    removeNotification,
    dismissAll,
  };
};
