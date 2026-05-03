import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationToastProps {
  notification: ToastNotification;
  onDismiss: (id: string) => void;
}

const NotificationToast = ({ notification, onDismiss }: NotificationToastProps) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!notification.duration) return;
    
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(notification.id), 300);
    }, notification.duration);

    return () => clearTimeout(timer);
  }, [notification.id, notification.duration, onDismiss]);

  const getStyles = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 flex-shrink-0" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 flex-shrink-0" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 flex-shrink-0" />;
      case 'info':
        return <Info className="w-5 h-5 flex-shrink-0" />;
    }
  };

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg border
        ${getStyles()}
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
        transition-all duration-300
      `}
    >
      {getIcon()}
      <div className="flex-1">
        <p className="font-medium">{notification.message}</p>
        {notification.action && (
          <button
            onClick={() => {
              notification.action?.onClick();
              onDismiss(notification.id);
            }}
            className="mt-2 text-sm font-semibold hover:underline"
          >
            {notification.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onDismiss(notification.id), 300);
        }}
        className="flex-shrink-0 hover:opacity-70 transition"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};

export default NotificationToast;
