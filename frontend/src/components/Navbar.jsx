
// src/components/Navbar.jsx

import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

export default function Navbar({
  wishlistCount,
  cartCount,
  user,
  onOpenWishlist,
  onOpenCart,
  onOpenAuth,
  onOpenAdmin,
  onOpenOrders,
  onSignOut,
  onHome,
  onBrowseBooks,
  searchQuery,
  setSearchQuery
}) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);

  /*
   * Load notifications for the currently logged-in user.
   */
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    let cancelled = false;

    const loadNotifications = async () => {
      try {
        const data = await api.getNotifications();

        if (cancelled) return;

        // Supports either:
        // [ ...notifications ]
        // { notifications: [...] }
        // { data: [...] }
        let rows = [];

        if (Array.isArray(data)) {
          rows = data;
        } else if (Array.isArray(data?.notifications)) {
          rows = data.notifications;
        } else if (Array.isArray(data?.data)) {
          rows = data.data;
        }

        setNotifications(rows);
      } catch (error) {
        console.error('Failed to load notifications:', error);
        setNotifications([]);
      }
    };

    loadNotifications();

    return () => {
      cancelled = true;
    };
  }, [user]);

  /*
   * Close notification dropdown when clicking outside it.
   */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  /*
   * Number of unread notifications.
   */
  const unreadCount = notifications.filter(
    (notification) =>
      !notification.is_read &&
      !notification.read
  ).length;

  /*
   * Mark one notification as read.
   */
  const handleNotificationClick = async (notification) => {
    const notificationId =
      notification.notification_id ??
      notification.id;

    if (!notificationId) return;

    const alreadyRead =
      notification.is_read ||
      notification.read;

    if (alreadyRead) return;

    // Update UI immediately
    setNotifications((current) =>
      current.map((item) => {
        const itemId =
          item.notification_id ??
          item.id;

        if (itemId === notificationId) {
          return {
            ...item,
            is_read: true,
            read: true
          };
        }

        return item;
      })
    );

    try {
      await api.markNotificationRead(notificationId);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  /*
   * Mark every notification as read.
   */
  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;

    // Update UI immediately
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        is_read: true,
        read: true
      }))
    );

    try {
      await api.markAllNotificationsRead();
    } catch (error) {
      console.error(
        'Failed to mark all notifications as read:',
        error
      );
    }
  };

  /*
   * Format notification time.
   */
  const formatNotificationTime = (dateValue) => {
    if (!dateValue) return '';

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const now = new Date();
    const diff = Math.floor(
      (now.getTime() - date.getTime()) / 1000
    );

    if (diff < 60) {
      return 'Just now';
    }

    if (diff < 3600) {
      return `${Math.floor(diff / 60)} min ago`;
    }

    if (diff < 86400) {
      return `${Math.floor(diff / 3600)} hr ago`;
    }

    if (diff < 604800) {
      return `${Math.floor(diff / 86400)} day${
        Math.floor(diff / 86400) === 1 ? '' : 's'
      } ago`;
    }

    return date.toLocaleDateString();
  };

  /*
   * Get notification title/message regardless
   * of the exact property names returned by backend.
   */
  const getNotificationTitle = (notification) => {
    return (
      notification.title ||
      notification.notification_title ||
      'Notification'
    );
  };

  const getNotificationMessage = (notification) => {
    return (
      notification.message ||
      notification.notification_message ||
      notification.body ||
      ''
    );
  };

  const getNotificationDate = (notification) => {
    return (
      notification.created_at ||
      notification.createdAt ||
      notification.date
    );
  };

  return (
    <header className="bn-header">
      <div className="header-inner">

        {/* LOGO */}
        <div className="logo-section" onClick={onHome}>
          <h1>BOOKSTORE</h1>
        </div>

        {/* SEARCH */}
        <div className="search-container">
          <input
            type="text"
            placeholder="Search by Title, Author, or Keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onBrowseBooks();
              }
            }}
          />

          <button
            className="search-btn"
            onClick={onBrowseBooks}
          >
            Search
          </button>
        </div>

        {/* NAVIGATION */}
        <div className="nav-controls">

          {/* BOOKS */}
          <button
            className="nav-books-btn"
            onClick={onBrowseBooks}
          >
            Books
          </button>

          {/* WISHLIST */}
          <button
            className="nav-icon-btn"
            onClick={onOpenWishlist}
          >
            <span className="icon-symbol">♡</span>
            <span className="btn-label">Wishlists</span>

            {user && (
              <span className="badge">
                {wishlistCount}
              </span>
            )}
          </button>

          {/* CART */}
          <button
            className="nav-icon-btn cart-accent"
            onClick={onOpenCart}
          >
            <span className="icon-symbol">🛒</span>
            <span className="btn-label">Cart</span>

            <span className="badge">
              {cartCount}
            </span>
          </button>

          {/* =====================================================
              NOTIFICATIONS
             ===================================================== */}
          {user && (
            <div
              className="notification-wrapper"
              ref={notificationRef}
            >
              <button
                className={`notification-trigger ${
                  showNotifications ? 'active' : ''
                }`}
                onClick={() =>
                  setShowNotifications(!showNotifications)
                }
                aria-label="Notifications"
              >
                <span className="notification-bell">
                  🔔
                </span>

                {unreadCount > 0 && (
                  <span className="notification-badge">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="notification-dropdown">

                  {/* HEADER */}
                  <div className="notification-header">
                    <div>
                      <h3>Notifications</h3>

                      {unreadCount > 0 && (
                        <span>
                          {unreadCount} unread
                        </span>
                      )}
                    </div>

                    {unreadCount > 0 && (
                      <button
                        className="mark-all-read-btn"
                        onClick={handleMarkAllRead}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* NOTIFICATION LIST */}
                  <div className="notification-list">

                    {notifications.length === 0 ? (
                      <div className="notification-empty">
                        <div className="notification-empty-icon">
                          🔔
                        </div>

                        <strong>
                          You're all caught up
                        </strong>

                        <p>
                          No notifications yet.
                        </p>
                      </div>
                    ) : (
                      notifications.map((notification) => {
                        const notificationId =
                          notification.notification_id ??
                          notification.id;

                        const isRead =
                          notification.is_read ||
                          notification.read;

                        return (
                          <button
                            key={notificationId}
                            className={`notification-item ${
                              !isRead ? 'unread' : ''
                            }`}
                            onClick={() =>
                              handleNotificationClick(
                                notification
                              )
                            }
                          >

                            {/* UNREAD DOT */}
                            <div className="notification-dot-area">
                              {!isRead && (
                                <span className="notification-unread-dot" />
                              )}
                            </div>

                            {/* CONTENT */}
                            <div className="notification-content">

                              <div className="notification-title">
                                {getNotificationTitle(
                                  notification
                                )}
                              </div>

                              {getNotificationMessage(
                                notification
                              ) && (
                                <div className="notification-message">
                                  {getNotificationMessage(
                                    notification
                                  )}
                                </div>
                              )}

                              <div className="notification-time">
                                {formatNotificationTime(
                                  getNotificationDate(
                                    notification
                                  )
                                )}
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
          )}

          {/* ACCOUNT */}
          {user ? (
            <div className="account-dropdown-wrapper">

              <button
                className="account-trigger"
                onClick={() =>
                  setShowProfileMenu(!showProfileMenu)
                }
              >
                <span>
                  Hi, {user.username}
                </span>

                <span className="arrow">
                  ▾
                </span>
              </button>

              {showProfileMenu && (
                <div
                  className="account-menu"
                  onClick={() =>
                    setShowProfileMenu(false)
                  }
                >
                  <div className="menu-header">

                    <strong>
                      {user.username}
                    </strong>

                    <span>
                      {user.email}
                    </span>

                    <small className="role-tag">
                      {user.role?.toUpperCase()}
                    </small>

                  </div>

                  <hr />

                  <button
                    className="menu-item"
                    onClick={onOpenOrders}
                  >
                    My Orders
                  </button>

                  <button
                    className="menu-item"
                    onClick={onOpenWishlist}
                  >
                    My Wishlists
                  </button>

                  <button
                    className="menu-item"
                    onClick={onOpenCart}
                  >
                    My Shopping Cart
                  </button>

                  {user.role === 'admin' && (
                    <>
                      <hr />

                      <button
                        className="menu-item"
                        onClick={onOpenAdmin}
                      >
                        Admin Dashboard
                      </button>
                    </>
                  )}

                  <hr />

                  <button
                    className="menu-item"
                    onClick={onSignOut}
                  >
                    Sign Out
                  </button>

                </div>
              )}
            </div>
          ) : (
            <button
              className="account-trigger"
              onClick={onOpenAuth}
            >
              Sign In
            </button>
          )}

        </div>
      </div>
    </header>
  );
}

