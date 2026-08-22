// src/components/WishlistDrawer.jsx
import { useState } from 'react';

export default function WishlistDrawer({
  isOpen,
  onClose,
  wishlists,
  selectedWishlistId,
  onSelectWishlist,
  books,
  onAddToCart,
  onRemoveItem,
  onCreateList,
  onDeleteList,
  onRenameList,
  onSignOut
}) {
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  if (!isOpen) return null;

  const activeWishlist = wishlists.find(w => w.wishlist_id === Number(selectedWishlistId)) || wishlists[0] || {};
  const isDefault = activeWishlist.wishlist_name === 'My Wishlist';

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    onCreateList(newListName.trim());
    setNewListName('');
    setShowCreateInput(false);
  };

  const handleRenameSubmit = (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    onRenameList(activeWishlist.wishlist_id, editName.trim());
    setIsEditing(false);
  };

  const handleAddAll = () => {
    if (!books || books.length === 0) return;
    books.forEach(b => onAddToCart(b.book_id));
  };

  return (
    <div className="wishlist-page-overlay" onClick={onClose}>
      <div className="wishlist-view-card" onClick={(e) => e.stopPropagation()}>
        
        {/* LEFT SIDEBAR */}
        <aside className="wishlist-sidebar">
          <div className="sidebar-group">
            <h4 className="sidebar-heading">Your Orders</h4>
          </div>

          <div className="sidebar-group active-group">
            <h4 className="sidebar-heading text-blue">Your Wishlists</h4>
            
            <div className="wishlist-links-list">
              {wishlists.map((w) => (
                <div 
                  key={w.wishlist_id}
                  className={`wishlist-link-item ${Number(selectedWishlistId) === w.wishlist_id ? 'active' : ''}`}
                  onClick={() => {
                    onSelectWishlist(w.wishlist_id);
                    setIsEditing(false);
                  }}
                >
                  <span className="list-title">{w.wishlist_name}</span>
                  <span className="list-count">{w.total_saved_books || 0}</span>
                </div>
              ))}
            </div>

            {!showCreateInput ? (
              <button className="create-wishlist-link" onClick={() => setShowCreateInput(true)}>
                Create New Wishlist
              </button>
            ) : (
              <form onSubmit={handleCreateSubmit} className="sidebar-create-form">
                <input 
                  type="text" 
                  placeholder="Wishlist Name" 
                  autoFocus
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                />
                <div className="create-btn-row">
                  <button type="submit" className="btn-save-sm">Save</button>
                  <button type="button" className="btn-cancel-sm" onClick={() => setShowCreateInput(false)}>Cancel</button>
                </div>
              </form>
            )}
          </div>

          <div className="sidebar-group">
            <h4 className="sidebar-heading">Your Profile</h4>
          </div>

          <div className="sidebar-group">
            <h4 className="sidebar-heading signout-text" onClick={onSignOut}>Sign Out</h4>
          </div>
        </aside>

        {/* RIGHT MAIN AREA */}
        <main className="wishlist-main-pane">
          <div className="wishlist-top-bar">
            <div>
              {isEditing ? (
                <form onSubmit={handleRenameSubmit} className="inline-rename-form">
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="btn-save-sm">Save</button>
                  <button type="button" className="btn-cancel-sm" onClick={() => setIsEditing(false)}>Cancel</button>
                </form>
              ) : (
                <h2 className="wishlist-display-title">
                  {activeWishlist.wishlist_name || 'My Wishlist'} ({books ? books.length : 0})
                </h2>
              )}

              <div className="wishlist-sub-actions">
                {!isDefault && (
                  <>
                  <button
                    className="action-link"
                    onClick={() => {
                      setEditName(activeWishlist.wishlist_name || '');
                      setIsEditing(true);
                    }}
                  >
        Edit
      </button>
      <span className="dot">•</span>
      
      {/* Updated Delete Button */}
      <button 
        className="action-link text-red" 
        onClick={() => {
          if (activeWishlist && activeWishlist.wishlist_id) {
            onDeleteList(activeWishlist.wishlist_id);
          }
        }}
      >
        Delete
      </button>
      
      <span className="dot">•</span>
    </>
  )}
                <button className="action-link" onClick={() => alert('Share link copied')}>
                  Share This Wishlist
                </button>
              </div>
            </div>

            <div className="top-right-actions">
              <button className="btn-add-all" onClick={handleAddAll}>
                Add All to Cart
              </button>
              <button className="btn-close-view" onClick={onClose}>✕</button>
            </div>
          </div>

          <div className="wishlist-books-container">
            {!books || books.length === 0 ? (
              <div className="empty-wishlist-view">
                <p>No books in this wishlist yet.</p>
              </div>
            ) : (
              <div className="wishlist-grid">
                {books.map((b) => (
                  <div key={b.book_id} className="wishlist-book-card">
                    <div className="card-cover-container">
                      <span className="discount-tag">Save 20%</span>
                      <div className="cover-box">
                        <span>📖 {b.title}</span>
                      </div>
                    </div>

                    <div className="card-details">
                      <h4 className="book-name">{b.title}</h4>
                      <p className="book-author-line">by {b.author_names || 'Various Authors'}</p>
                      <p className="book-price-line">Tk {Number(b.price).toFixed(2)}</p>

                      <div className="card-btn-group">
                        <button className="btn-card-cart" onClick={() => onAddToCart(b.book_id)}>
                          Add to Cart
                        </button>
                        <button className="btn-card-remove" onClick={() => onRemoveItem(activeWishlist.wishlist_id, b.book_id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

      </div>
    </div>
  );
}