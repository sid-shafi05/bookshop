// src/components/BookCard.jsx
export default function BookCard({ book, onAddToCart, onHeartClick }) {
  const genreText = Array.isArray(book.categories) ? book.categories.join(' • ') : (book.category_name || 'Book');
  const authorText = Array.isArray(book.authors) ? book.authors.join(', ') : (book.author_name || 'Various Authors');

  return (
    <div className="book-card">
      <div className="cover-wrapper">
        <div className="book-cover-art">
          <span className="art-icon">📖</span>
          <span className="art-title">{book.title}</span>
        </div>
        <button 
          className="wishlist-float-btn" 
          title="Save to Wishlist"
          onClick={() => onHeartClick(book)}
        >
          ♡
        </button>
      </div>

      <div className="book-meta">
        <span className="genre-label">{genreText}</span>
        <h3 className="title-text" title={book.title}>{book.title}</h3>
        <p className="author-text">by {authorText}</p>

        <div className="rating-container">
          <span className="rating-stars">★★★★★</span>
          <span className="rating-num">5.0</span>
        </div>

        <div className="price-row">
          <span className="price-tag">Tk {Number(book.price).toFixed(2)}</span>
          <span className={`stock-indicator ${book.stock_quantity > 0 ? 'in-stock' : 'out-stock'}`}>
            {book.stock_quantity > 0 ? 'In Stock' : 'Out of Stock'}
          </span>
        </div>

        <button 
          className="cart-action-btn"
          disabled={book.stock_quantity <= 0}
          onClick={() => onAddToCart(book.book_id)}
        >
          {book.stock_quantity > 0 ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>
  );
}