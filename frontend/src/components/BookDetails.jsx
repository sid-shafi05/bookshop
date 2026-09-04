import { useEffect, useState } from 'react';
import { api } from '../api';

export default function BookDetails({ book, customerId, onBack, onAddToCart, onAddToWishlist }) {
  const [reviewData, setReviewData] = useState({ reviews: [], avg_rating: book.average_rating || 0, review_count: book.review_count || 0 });
  const [canReview, setCanReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      api.getBookReviews(book.book_id),
      api.checkReviewEligibility(customerId, book.book_id)
    ]).then(([reviews, eligibility]) => {
      if (active) {
        setReviewData(reviews);
        setCanReview(eligibility.eligible);
      }
    }).catch(() => {
      if (active) setMessage('Reviews are currently unavailable.');
    });
    return () => { active = false; };
  }, [book.book_id, customerId]);

  const submitReview = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api.submitReview({
        customer_id: customerId,
        book_id: book.book_id,
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment.trim()
      });
      const updatedReviews = await api.getBookReviews(book.book_id);
      setReviewData(updatedReviews);
      setCanReview(false);
      setReviewForm({ rating: 5, comment: '' });
      setMessage('Your review was submitted.');
    } catch (err) {
      setMessage(err.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  const authors = Array.isArray(book.authors) && book.authors.length > 0 ? book.authors.join(', ') : 'Various Authors';
  const categories = Array.isArray(book.categories) && book.categories.length > 0 ? book.categories.join(' • ') : 'Uncategorized';
  const hasCover = book.cover_url && book.cover_url !== '/images/placeholder-book.jpg';

  return (
    <main className="book-details-page">
      <button className="book-details-back" onClick={onBack}>Back to Books</button>
      <section className="book-details-main">
        <div className="book-details-cover">
          {hasCover ? (
            <img src={`http://localhost:3000${book.cover_url}`} alt={book.title} />
          ) : (
            <div className="book-cover-art"><span className="art-icon">📖</span><span className="art-title">{book.title}</span></div>
          )}
        </div>
        <div className="book-details-info">
          <span className="genre-label">{categories}</span>
          <h1>{book.title}</h1>
          <p className="author-text">by {authors}</p>
          <p className="book-details-rating">★ {Number(reviewData.avg_rating || 0).toFixed(1)} ({reviewData.review_count || 0} reviews)</p>
          <p className="book-details-description">{book.description || 'No description is available for this book yet.'}</p>
          <p>ISBN: {book.isbn || 'Not provided'}</p>
          {book.publication_year && <p>Published: {book.publication_year}</p>}
          <div className="book-details-price">Tk {Number(book.price).toFixed(2)}</div>
          <div className="book-details-actions">
            <button className="cart-action-btn" disabled={book.stock_quantity <= 0} onClick={() => onAddToCart(book.book_id)}>
              {book.stock_quantity > 0 ? 'Add to Cart' : 'Out of Stock'}
            </button>
            <button className="details-wishlist-btn" onClick={() => onAddToWishlist(book)}>Save to Wishlist</button>
          </div>
        </div>
      </section>

      <section className="book-reviews-section">
        <h2>Reviews and Ratings</h2>
        {canReview && (
          <form className="book-review-form" onSubmit={submitReview}>
            <select value={reviewForm.rating} onChange={(event) => setReviewForm({ ...reviewForm, rating: event.target.value })}>
              {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} stars</option>)}
            </select>
            <textarea required placeholder="Share your experience" value={reviewForm.comment} onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })} />
            <button className="btn-save" type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Review'}</button>
          </form>
        )}
        {message && <p className="book-details-message">{message}</p>}
        {reviewData.reviews.length === 0 ? <p>No reviews yet.</p> : reviewData.reviews.map((review) => (
          <article className="book-review" key={review.review_id}>
            <strong>{review.username}</strong><span> {'★'.repeat(review.rating)}</span>
            <p>{review.comment || 'No comment provided.'}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
