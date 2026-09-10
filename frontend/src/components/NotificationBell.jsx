// src/components/NotificationBell.jsx
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

export default function NotificationBell({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);

  useEffect(() => {
    if (!user) { setNotifications([]); return; }
    let cancelled = false;

    const loadNotifications = async () => {
      try {
        const data = await api.getNotifications();
        if (cancelled) return;
        let rows = [];
        if (Array.isArray(data)) rows = data;
        else if (Array.isArray(data?.notifications)) rows = data.notifications;
        else if (Array.isArray(data?.data)) rows = data.data;
        setNotifications(rows);
      } catch (error) {
        console.error('Failed to load notifications:', error);
        setNotifications([]);
      }
    };

    loadNotifications();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read && !n.read).length;

  const handleNotificationClick = async (notification) => {
    const notificationId = notification.notification_id ?? notification.id;
    if (!notificationId) return;
    const alreadyRead = notification.is_read || notification.read;
    if (alreadyRead) return;

    setNotifications((current) =>
      current.map((item) => {
        const itemId = item.notification_id ?? item.id;
        return itemId === notificationId ? { ...item, is_read: true, read: true } : item;
      })
    );

    try {
      await api.markNotificationRead(notificationId);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setNotifications((current) => current.map((n) => ({ ...n, is_read: true, read: true })));
    try {
      await api.markAllNotificationsRead();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const formatNotificationTime = (dateValue) => {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    if (diff < 604800) {
      const days = Math.floor(diff / 86400);
      return `${days} day${days === 1 ? '' : 's'} ago`;
    }
    return date.toLocaleDateString();
  };

  const getNotificationTitle = (n) => n.title || n.notification_title || 'Notification';
  const getNotificationMessage = (n) => n.message || n.notification_message || n.body || '';
  const getNotificationDate = (n) => n.created_at || n.createdAt || n.date;

  if (!user) return null;

  return (
    <div className="notification-wrapper" ref={notificationRef}>
      <button
        className={`notification-trigger ${showNotifications ? 'active' : ''}`}
        onClick={() => setShowNotifications(!showNotifications)}
        aria-label="Notifications"
      >
        <span className="notification-bell">🔔</span>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {showNotifications && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <div>
              <h3>Notifications</h3>
              {unreadCount > 0 && <span>{unreadCount} unread</span>}
            </div>
            {unreadCount > 0 && (
              <button className="mark-all-read-btn" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <div className="notification-empty-icon">🔔</div>
                <strong>You're all caught up</strong>
                <p>No notifications yet.</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const notificationId = notification.notification_id ?? notification.id;
                const isRead = notification.is_read || notification.read;
                return (
                  <button
                    key={notificationId}
                    className={`notification-item ${!isRead ? 'unread' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="notification-dot-area">
                      {!isRead && <span className="notification-unread-dot" />}
                    </div>
                    <div className="notification-content">
                      <div className="notification-title">{getNotificationTitle(notification)}</div>
                      {getNotificationMessage(notification) && (
                        <div className="notification-message">{getNotificationMessage(notification)}</div>
                      )}
                      <div className="notification-time">
                        {formatNotificationTime(getNotificationDate(notification))}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}