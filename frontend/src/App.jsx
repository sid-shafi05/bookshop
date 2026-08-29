// src/App.jsx
import { useState, useEffect } from 'react';
import { api } from './api';
import Navbar from './components/Navbar';
import BookCard from './components/BookCard';
import CartDrawer from './components/CartDrawer';
import WishlistDrawer from './components/WishlistDrawer';
import SaveWishlistModal from './components/SaveWishlistModal';
import AuthModal from './components/AuthModal';
import AdminDashboard from './components/AdminDashboard';
import './App.css';

const AUTH_USER_KEY = 'bookstore_user';
const AUTH_TOKEN_KEY = 'bookstore_token';

function parseJwtPayload(token) {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  const payload = parseJwtPayload(token);
  if (!payload || !payload.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

export default function App() {
  const [books, setBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('featured');

  // NEW: which top-level view is showing — 'shop' or 'admin'
  const [currentView, setCurrentView] = useState('shop');

  const [user, setUser] = useState(() => {
    // Persist auth across restarts, but drop stale sessions when token is expired.
    const savedUser = localStorage.getItem(AUTH_USER_KEY);
    const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);

    if (!savedUser || !savedToken || isTokenExpired(savedToken)) {
      localStorage.removeItem(AUTH_USER_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      return null;
    }

    try {
      return JSON.parse(savedUser);
    } catch {
      localStorage.removeItem(AUTH_USER_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      return null;
    }
  });
  const [cart, setCart] = useState({ items: [], cart_subtotal: '0.00' });
  const [wishlists, setWishlists] = useState([]);
  const [selectedWishlistId, setSelectedWishlistId] = useState(null);
  const [currentWishlistBooks, setCurrentWishlistBooks] = useState([]);
  const [newWishlistName, setNewWishlistName] = useState('');
  const [bookToSave, setBookToSave] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const [showCart, setShowCart] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });

  // Initial Load
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        setLoading(true);
        const res = await fetch('http://localhost:3000/books');
        const booksData = await res.json();
        if (isMounted && Array.isArray(booksData)) {
          setBooks(booksData);
          setFilteredBooks(booksData);
        }
        if (user && user.id) {
          refreshCart(user.id);
          refreshWishlists(user.id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [user]);

  // Search & Filter
// Search, Filter & Sort (Protected against null/undefined crashes!)
  useEffect(() => {
    let result = [...books];

    // 1. Safe Category Filter
    if (selectedCategory !== 'All') {
      result = result.filter((b) => {
        if (!b) return false;
        if (Array.isArray(b.categories)) {
          return b.categories.some(c => c && String(c).toLowerCase() === selectedCategory.toLowerCase());
        }
        if (b.category_name) {
          return String(b.category_name).toLowerCase() === selectedCategory.toLowerCase();
        }
        return false;
      });
    }

    // 2. Safe Search Filter (Searches Title, Author, and Description safely)
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((b) => {
        if (!b) return false;

        const titleMatch = Boolean(b.title && String(b.title).toLowerCase().includes(q));
        
        let authorMatch = false;
        if (Array.isArray(b.authors)) {
          authorMatch = b.authors.some(a => a && String(a).toLowerCase().includes(q));
        } else if (b.author_name) {
          authorMatch = String(b.author_name).toLowerCase().includes(q);
        } else if (b.authors && typeof b.authors === 'string') {
          authorMatch = b.authors.toLowerCase().includes(q);
        }

        return titleMatch || authorMatch;
      });
    }

    // 3. Safe Sorting
    if (sortBy === 'price-low') {
      result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sortBy === 'price-high') {
      result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else {
      result.sort((a, b) => (b.book_id || 0) - (a.book_id || 0));
    }

    setFilteredBooks(result);
  }, [selectedCategory, searchQuery, sortBy, books]);

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(''), 3000); };
  const refreshCart = async (uid) => { const data = await api.getCart(uid).catch(() => ({ items: [], cart_subtotal: '0.00' })); setCart(data || { items: [], cart_subtotal: '0.00' }); };
  const handleSignOut = () => {
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_USER_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    setUser(null);
    setCart({ items: [], cart_subtotal: '0.00' });
    setWishlists([]);
    setSelectedWishlistId(null);
    setCurrentWishlistBooks([]);
    setShowCart(false);
    setShowWishlist(false);
    setCurrentView('shop'); // NEW: kick back to shop view on sign out
    showToast('Signed out');
  };
  const refreshWishlists = async (uid) => {
    const lists = await api.getCustomerWishlists(uid).catch(() => []);
    setWishlists(lists || []);
    if (lists && lists.length > 0) {
      const selectedExists = selectedWishlistId && lists.some(w => w.wishlist_id === Number(selectedWishlistId));
      const activeId = selectedExists ? Number(selectedWishlistId) : lists[0].wishlist_id;
      setSelectedWishlistId(activeId);
      loadWishlistBooks(activeId);
    } else {
      setSelectedWishlistId(null);
      setCurrentWishlistBooks([]);
    }
  };
  const loadWishlistBooks = async (wid) => {
    const data = await api.getWishlistBooks(wid).catch(() => ({ books: [] }));
    setCurrentWishlistBooks(data.books || []);
  };

  const handleAddToCart = async (bookId) => {
    if (!user) { setIsLoginMode(true); setShowAuthModal(true); return showToast('Please sign in first'); }
    try { await api.addToCart({ customer_id: user.id, book_id: bookId }); showToast('🛒 Added to Cart'); refreshCart(user.id); } catch (e) { showToast('Error adding to cart'); }
  };
  const handleSaveToSpecificList = async (wid) => {
    await api.addToWishlist({ wishlist_id: wid, book_id: bookToSave.book_id });
    showToast('❤️ Saved to Wishlist'); setBookToSave(null); refreshWishlists(user.id);
  };
  const handleCreateNewWishlist = async (e) => {
    // 1. STOPS THE PAGE FROM REFRESHING AND LOGGING YOU OUT!
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    const listName = typeof e === 'string' ? e : newWishlistName;
    if (!listName || !listName.trim()) return;

    if (!user) {
      showToast('Please sign in first');
      return;
    }

    try {
      // 2. Create the new list
      const res = await api.createWishlist({ 
        customer_id: user.id, 
        wishlist_name: listName.trim() 
      });

      showToast(`Created wishlist: "${listName.trim()}"`);

      // 3. If saving a book right now, insert the book into the new list!
      if (bookToSave && res.wishlist) {
        await api.addToWishlist({ 
          wishlist_id: res.wishlist.wishlist_id, 
          book_id: bookToSave.book_id 
        });
        showToast(`❤️ Saved to "${res.wishlist.wishlist_name}"!`);
      }

      setNewWishlistName('');
      setBookToSave(null);
      refreshWishlists(user.id);

    } catch (err) {
      alert(err.message || 'Failed to create wishlist');
    }
  };
  const handleDeleteWishlist = async (wid) => {
    if (!wid) return;
    try {
      await api.deleteWishlist(wid);
      showToast('Wishlist deleted successfully');
      setSelectedWishlistId(null);
      if (user && user.id) {
        refreshWishlists(user.id);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete wishlist');
    }
  };
const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      // 1. Call the API first to get 'res'
      const res = isLoginMode ? await api.login(authForm) : await api.signup(authForm);
      
      // 2. Extract user data from the response
      const userData = res.user || { 
        id: res.user_id, 
        username: res.username, 
        email: res.email, 
        role: res.role 
      };

      // 3. Save to React State & persistent storage
      setUser(userData);
      if (res.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, res.token);
      }
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));

      // 4. Close modal and show message
      setShowAuthModal(false);
      showToast(`Welcome, ${authForm.username || authForm.email}`);
      setAuthForm({ username: '', email: '', password: '' });

    } catch (err) {
      alert(err.message || 'Auth failed');
    }
  };

  return (
    <div className="bn-layout">
      <Navbar 
        selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        wishlistCount={wishlists.reduce((acc, curr) => acc + Number(curr.total_saved_books || 0), 0)}
        cartCount={cart.items ? cart.items.length : 0} user={user}
        onOpenWishlist={() => user ? setShowWishlist(true) : setShowAuthModal(true)}
        onOpenCart={() => user ? setShowCart(true) : setShowAuthModal(true)}
        onOpenAuth={() => { setIsLoginMode(true); setShowAuthModal(true); }}
        onOpenAdmin={() => setCurrentView('admin')}
        onSignOut={handleSignOut}
      />

      {toastMessage && <div className="toast-bar">{toastMessage}</div>}

      {currentView === 'admin' ? (
        <AdminDashboard onClose={() => setCurrentView('shop')} />
      ) : (
        <main className="catalog-wrapper">
          <div className="catalog-toolbar">
            <div>
              <h2 className="section-heading">{selectedCategory === 'All' ? 'Books & Collections' : selectedCategory}</h2>
              <span className="results-count">{filteredBooks.length} items available</span>
            </div>
            <div className="sort-box">
              <label>Sort:</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="featured">Featured / Newest</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>

          {loading ? <div className="empty-state">Loading books from database...</div> : (
            <div className="book-grid">
              {filteredBooks.map(b => (
                <BookCard key={b.book_id} book={b} onAddToCart={handleAddToCart} onHeartClick={(book) => user ? setBookToSave(book) : setShowAuthModal(true)} />
              ))}
            </div>
          )}
        </main>
      )}

      <CartDrawer 
        isOpen={showCart} onClose={() => setShowCart(false)} cart={cart}
        onUpdateQty={async (bid, qty) => { await api.updateCartQuantity({ customer_id: user.id, book_id: bid, updated_qty: qty }); refreshCart(user.id); }}
        onRemoveItem={async (bid) => { await api.removeFromCart({ customer_id: user.id, book_id: bid }); refreshCart(user.id); }}
      />

      <WishlistDrawer 
        isOpen={showWishlist} onClose={() => setShowWishlist(false)} wishlists={wishlists}
        selectedWishlistId={selectedWishlistId} onSelectWishlist={(wid) => { setSelectedWishlistId(wid); loadWishlistBooks(wid); }}
        books={currentWishlistBooks} onAddToCart={handleAddToCart}
        onRemoveItem={async (wid, bid) => { await api.removeFromWishlist({ wishlist_id: wid, book_id: bid }); refreshWishlists(user.id); }}
        onCreateList={handleCreateNewWishlist}
        onDeleteList={handleDeleteWishlist}
        onRenameList={async (wid, newName) => { await api.renameWishlist({ wishlist_id: wid, new_name: newName, customer_id: user.id }); refreshWishlists(user.id); }}
        onSignOut={handleSignOut}
      />

      <SaveWishlistModal 
        book={bookToSave} onClose={() => setBookToSave(null)} wishlists={wishlists}
        onSaveToSpecificList={handleSaveToSpecificList} onCreateNewWishlist={handleCreateNewWishlist}
        newWishlistName={newWishlistName} setNewWishlistName={setNewWishlistName}
      />

      <AuthModal 
        isOpen={showAuthModal} onClose={() => setShowAuthModal(false)}
        isLoginMode={isLoginMode} setIsLoginMode={setIsLoginMode}
        authForm={authForm} setAuthForm={setAuthForm} onSubmit={handleAuthSubmit}
      />
    </div>
  );
}