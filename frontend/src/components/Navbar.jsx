// src/components/Navbar.jsx

import { useState } from 'react';
import NotificationBell from './NotificationBell';

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

          {/* NOTIFICATIONS */}
          {user && <NotificationBell user={user} />}

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