// src/components/SaveWishlistModal.jsx
export default function SaveWishlistModal({
  book,
  onClose,
  wishlists,
  onSaveToSpecificList,
  onCreateNewWishlist,
  newWishlistName,
  setNewWishlistName
}) {
  if (!book) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="wishlist-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <h3>Save to Wishlist</h3>
          <button className="close-x" onClick={onClose}>✕</button>
        </div>
        
        <p className="picker-subtitle">Select which list to save <strong>"{book.title}"</strong> into:</p>

        <div className="wishlist-choice-list">
          {wishlists.map((w) => (
            <button 
              key={w.wishlist_id} 
              className="wishlist-choice-btn"
              onClick={() => onSaveToSpecificList(w.wishlist_id)}
            >
              <span>📁 {w.wishlist_name}</span>
              <small>{w.total_saved_books || 0} items</small>
            </button>
          ))}
        </div>

        <form onSubmit={onCreateNewWishlist} className="create-and-save-form">
          <input 
            type="text" 
            placeholder="Wishlist Name" 
            value={newWishlistName}
            onChange={(e) => setNewWishlistName(e.target.value)}
          />
          <button type="submit">Create & Save</button>
        </form>
      </div>
    </div>
  );
}