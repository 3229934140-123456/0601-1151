import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import type { OperationNotification } from '@shared/types';

const NotificationToast: React.FC = () => {
  const { state, dismissNotification } = useApp();

  useEffect(() => {
    state.notifications.forEach((notification) => {
      const timer = setTimeout(() => {
        dismissNotification(notification.id);
      }, 4000);
      return () => clearTimeout(timer);
    });
  }, [state.notifications, dismissNotification]);

  if (state.notifications.length === 0) return null;

  return (
    <div className="notification-container">
      {state.notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={() => dismissNotification(notification.id)}
        />
      ))}
    </div>
  );
};

interface NotificationItemProps {
  notification: OperationNotification;
  onDismiss: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onDismiss }) => {
  const getStatusInfo = (status: OperationNotification['status']) => {
    switch (status) {
      case 'success':
        return { icon: '✅', bgColor: '#10b98120', borderColor: '#10b981', iconColor: '#10b981' };
      case 'failed':
        return { icon: '❌', bgColor: '#ef444420', borderColor: '#ef4444', iconColor: '#ef4444' };
      case 'cancelled':
        return { icon: '🚫', bgColor: '#64748b20', borderColor: '#64748b', iconColor: '#64748b' };
      case 'not_supported':
        return { icon: '⚠️', bgColor: '#f59e0b20', borderColor: '#f59e0b', iconColor: '#f59e0b' };
      default:
        return { icon: 'ℹ️', bgColor: '#3b82f620', borderColor: '#3b82f6', iconColor: '#3b82f6' };
    }
  };

  const getTypeLabel = (type: OperationNotification['type']) => {
    switch (type) {
      case 'copy':
        return '复制';
      case 'export':
        return '导出';
      case 'import':
        return '导入';
      case 'save':
        return '保存';
      default:
        return '操作';
    }
  };

  const info = getStatusInfo(notification.status);
  const typeLabel = getTypeLabel(notification.type);

  return (
    <div
      className="notification-item"
      style={{
        backgroundColor: info.bgColor,
        borderLeft: `4px solid ${info.borderColor}`,
      }}
    >
      <div className="notification-icon" style={{ color: info.iconColor }}>
        {info.icon}
      </div>
      <div className="notification-content">
        <div className="notification-title">
          {typeLabel}
          {notification.status === 'success' && '成功'}
          {notification.status === 'failed' && '失败'}
          {notification.status === 'cancelled' && '已取消'}
          {notification.status === 'not_supported' && '不支持'}
        </div>
        <div className="notification-message">{notification.message}</div>
        {notification.detail && (
          <div className="notification-detail">{notification.detail}</div>
        )}
      </div>
      <button className="notification-close" onClick={onDismiss}>
        ✕
      </button>
    </div>
  );
};

export default NotificationToast;
