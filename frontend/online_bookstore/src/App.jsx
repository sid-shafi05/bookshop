// src/App.jsx
import { useState, useEffect } from 'react';
import API from './api';
import './App.css';

function App() {
  const [books, setBooks] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const CUSTOMER_ID = 1;

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        setLoading(true);
        // 1. Fetch books from backend
        const booksRes = await API.get('/books');
        if (isMounted) {
          if (Array.isArray(booksRes.data)) {
            setBooks(booksRes.data);
          } else {
            setBooks([]);
          }
        }

        // 2. Fetch cart count from backend
        const cartRes = await API.get(`/cart/${CUSTOMER_ID}`);
        if (isMounted && cartRes.data) {
          setCartCount(cartRes.data.total_items || 0);
        }
      } catch (error) {
        console.error('Error connecting to backend:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateCartCount = async () => {
    try {
      const res = await API.get(`/cart/${CUSTOMER_ID}`);
      if (res.data) {
        setCartCount(res.data.total_items || 0);
      }
    } catch (error) {
      console.error('Failed to update cart count:', error);
    }
  };

  const handleAddToCart = async (bookId) => {
    try {
      await API.post('/cart/add', {
        customer_id: CUSTOMER_ID,
        book_id: bookId,
        quantity: 1
      });
      setMessage('✅ Book added to your Cart!');
      updateCartCount();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Add to cart error:', error);
      alert('Failed to add to cart');
    }
  };

  const handleAddToWishlist = async (bookId) => {
    try {
      const res = await API.post('/wishlist/add', {
        customer_id: CUSTOMER_ID,
        book_id: bookId
      });
      setMessage(res.data.message || 'Book saved to wishlist!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Wishlist error:', error);
      alert('Failed to save to wishlist');
    }
  };

  return (
    <div className="app-container">
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="nav-brand">
          <span style={{ fontSize: '28px' }}>📖</span>
          <h2>Rokomari-Style Bookshop</h2>
        </div>
        <div className="nav-actions">
          <button className="nav-btn">
            <span>❤️ Wishlist</span>
          </button>
          <button className="nav-btn cart-btn">
            <span>🛒 Cart ({cartCount})</span>
          </button>
        </div>
      </nav>

      {/* TOAST MESSAGE */}
      {message && <div className="toast-notification">{message}</div>}

      {/* MAIN CATALOG */}
      <main className="catalog-container">
        <h2 className="section-title">📚 Available Books</h2>

        {loading ? (
          <p className="loading-text">Loading catalog from PostgreSQL database...</p>
        ) : books.length === 0 ? (
          <p className="loading-text">No books found in database. Check that backend has books seeded!</p>
        ) : (
          <div className="books-grid">
            {books.map((book) => (
              <div key={book.book_id} className="book-card">
                <div className="book-cover-placeholder">
                  {book.cover_url ? (
                    <img src={book.cover_url} alt={book.title} />
                  ) : (
                    <span>📖 {book.title}</span>
                  )}
                </div>
                <div className="book-details">
                  <h3 className="book-title">{book.title}</h3>
                  <p className="book-stock">In Stock: {book.stock_quantity}</p>
                  <p className="book-price">{Number(book.price || 0).toFixed(2)} Tk</p>

                  <div className="card-buttons">
                    <button 
                      className="btn-cart"
                      onClick={() => handleAddToCart(book.book_id)}
                    >
                      🛒 Add to Cart
                    </button>
                    <button 
                      className="btn-wishlist"
                      onClick={() => handleAddToWishlist(book.book_id)}
                    >
                      ❤️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;