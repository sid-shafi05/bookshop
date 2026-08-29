// src/components/Navbar.jsx
import { useState } from 'react';

const CATEGORIES = [
  'All',
  'Fiction & Literature',
  'Self-Development',
  'Computer Science & Tech',
  'Sci-Fi & Fantasy',
  'Academic & Education',
  'Classics'
];

export default function Navbar({
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  wishlistCount,
  cartCount,
  user,
  onOpenWishlist,
  onOpenCart,
  onOpenAuth,
  onOpenAdmin,
  onSignOut
}) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="bn-header">
      <div className="header-inner">
        <div className="logo-section" onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }}>
          <h1>BOOKSTORE</h1>
        </div>

        <div className="search-container">
          <input 
            type="text" 
            placeholder="Search by Title, Author, or Keyword..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="search-btn">Search</button>
        </div>

        <div className="nav-controls">
          <button className="nav-icon-btn" onClick={onOpenWishlist}>
            <span className="icon-symbol">♡</span>
            <span className="btn-label">Wishlists</span>
            {user && <span className="badge">{wishlistCount}</span>}
          </button>

          <button className="nav-icon-btn cart-accent" onClick={onOpenCart}>
            <span className="icon-symbol">🛒</span>
            <span className="btn-label">Cart</span>
            <span className="badge">{cartCount}</span>
          </button>

          {user ? (
            <div className="account-dropdown-wrapper">
              <button className="account-trigger" onClick={() => setShowProfileMenu(!showProfileMenu)}>
                <span>Hi, {user.username}</span>
                <span className="arrow">▾</span>
              </button>

              {showProfileMenu && (
                <div className="account-menu" onClick={() => setShowProfileMenu(false)}>
                  <div className="menu-header">
                    <strong>{user.username}</strong>
                    <span>{user.email}</span>
                    <small className="role-tag">{user.role?.toUpperCase()}</small>
                  </div>
                  <hr />
                  <button className="menu-item" onClick={onOpenWishlist}>My Wishlists</button>
                  <button className="menu-item" onClick={onOpenCart}>My Shopping Cart</button>
                  {user.role === 'admin' && (
                    <>
                      <hr />
                      <button className="menu-item" onClick={onOpenAdmin}>Admin Dashboard</button>
                    </>
                  )}
                  <hr />
                  <button className="menu-item signout-btn" onClick={onSignOut}>Sign Out</button>
                </div>
              )}
            </div>
          ) : (
            <button className="signin-link-btn" onClick={onOpenAuth}>
              Sign In / Join
            </button>
          )}
        </div>
      </div>

      <nav className="category-subnav">
        <div className="category-inner">
          {CATEGORIES.map((cat) => (
            <button 
              key={cat} 
              className={`cat-pill ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
}