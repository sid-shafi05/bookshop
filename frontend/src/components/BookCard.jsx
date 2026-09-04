// src/components/BookCard.jsx

function StarRating({ rating, count }) {
  const rounded = Math.round(Number(rating) * 2) / 2; // nearest half-star
  const full = Math.floor(rounded);
  const half = rounded - full === 0.5;
  const empty = 5 - full - (half ? 1 : 0);

  if (!count || Number(count) === 0) {
    return (
      <div className="rating-container">
        <span className="rating-num no-reviews">No reviews yet</span>
      </div>
    );
  }

  return (
    <div className="rating-container">
      <span className="rating-stars">
        {'★'.repeat(full)}
        {half ? '⯨' : ''}
        {'☆'.repeat(Math.max(empty, 0))}
      </span>
      <span className="rating-num">
        {Number(rating).toFixed(1)} ({count})
      </span>
    </div>
  );
}

export default function BookCard({ book, onAddToCart, onHeartClick, onOpenDetails }) {
  const genreText = Array.isArray(book.categories) ? book.categories.join(' • ') : (book.category_name || 'Book');
  const authorText = Array.isArray(book.authors) ? book.authors.join(', ') : (book.author_name || 'Various Authors');

  // Only show a real photo if cover_url is set and isn't the generic
  // schema default placeholder path — otherwise fall back to the art box.
  const hasRealCover = book.cover_url && book.cover_url !== '/images/placeholder-book.jpg';

  return (
    <div className="book-card" onClick={() => onOpenDetails(book.book_id)} role="button" tabIndex={0}>
      <div className="cover-wrapper">
        {hasRealCover ? (
          <img
            className="book-cover-photo"
            src={`http://localhost:3000${book.cover_url}`}
            alt={book.title}
          />
        ) : (
          <div className="book-cover-art">
            <span className="art-icon">📖</span>
            <span className="art-title">{book.title}</span>
          </div>
        )}
        <button
          className="wishlist-float-btn"
          title="Save to Wishlist"
          onClick={(event) => { event.stopPropagation(); onHeartClick(book); }}
        >
          ♡
        </button>
      </div>

      <div className="book-meta">
        <span className="genre-label">{genreText}</span>
        <h3 className="title-text" title={book.title}>{book.title}</h3>
        <p className="author-text">by {authorText}</p>

        <StarRating rating={book.average_rating} count={book.review_count} />

        <div className="price-row">
          <span className="price-tag">Tk {Number(book.price).toFixed(2)}</span>
          <span className={`stock-indicator ${book.stock_quantity > 0 ? 'in-stock' : 'out-stock'}`}>
            {book.stock_quantity > 0 ? 'In Stock' : 'Out of Stock'}
          </span>
        </div>

        <button
          className="cart-action-btn"
          disabled={book.stock_quantity <= 0}
          onClick={(event) => { event.stopPropagation(); onAddToCart(book.book_id); }}
        >
          {book.stock_quantity > 0 ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>
  );
}