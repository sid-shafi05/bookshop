// src/components/BookCard.jsx

function StarRating({ rating, count }) {
  const rounded = Math.round(Number(rating) * 2) / 2;
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
  const hasRealCover = book.cover_url && book.cover_url !== '/images/placeholder-book.jpg';
  const coverSrc = hasRealCover
    ? (book.cover_url.startsWith('http') ? book.cover_url : `http://localhost:3000${book.cover_url}`)
    : '';
  const stockQty = Number(book.stock_quantity ?? 0);
  const stockState = stockQty <= 0 ? 'out' : stockQty <= 5 ? 'low' : 'in';
  const stockText = stockQty <= 0 ? 'Out of Stock' : stockQty <= 5 ? `Only ${stockQty} left` : 'In Stock';

  return (
    <div className="book-card book-card-sm" onClick={() => onOpenDetails(book.book_id)} role="button" tabIndex={0}>
      <div className="cover-wrapper cover-wrapper-sm">
        {hasRealCover ? (
          <img className="book-cover-photo" src={coverSrc} alt={book.title} />
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

      <div className="book-meta book-meta-sm">
        <span className="genre-label">{genreText}</span>
        <h3 className="title-text title-clamp" title={book.title}>{book.title}</h3>
        <p className="author-text">by {authorText}</p>

        <StarRating rating={book.average_rating} count={book.review_count} />

        <div className="price-row">
          <span className="price-tag">Tk {Number(book.price).toFixed(2)}</span>
          <span className={`stock-indicator ${stockState === 'in' ? 'in-stock' : stockState === 'low' ? 'low-stock' : 'out-stock'}`}>
            {stockText}
          </span>
        </div>
        {book.stock_quantity > 0 && book.stock_quantity <= 5 && (
          <p className="stock-warning">Only {book.stock_quantity} left in stock</p>
        )}

        {stockState === 'low' && <div className="stock-warning">Low stock — add soon</div>}

        <button
          className="cart-action-btn"
          disabled={stockQty <= 0}
          onClick={(event) => { event.stopPropagation(); onAddToCart(book.book_id); }}
        >
          {stockQty > 0 ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>
  );
}