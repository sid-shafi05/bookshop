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
import CheckoutModal from './components/CheckoutModal';
import OrdersView from './components/OrdersView';
import BookDetails from './components/BookDetails';
import './App.css';

const AUTH_USER_KEY = 'bookstore_user';
const VIEW_KEY = 'bookstore_view';

export default function App() {
  const [books, setBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('featured');

  // which top-level view is showing — 'shop', 'admin', or 'orders'
  // Restored from sessionStorage so a page refresh doesn't dump you back to the shop.
  const [currentView, setCurrentView] = useState(() => {
    const saved = sessionStorage.getItem(VIEW_KEY);
    return saved === 'admin' || saved === 'orders' ? saved : 'shop';
  });

  const [user, setUser] = useState(() => {
    // sessionStorage (not localStorage) so each browser TAB can hold its own
    // logged-in user — localStorage is shared across every tab on the origin,
    // which is why two accounts couldn't be used side by side before.
    const savedUser = sessionStorage.getItem(AUTH_USER_KEY);
    if (!savedUser) {
      sessionStorage.removeItem(AUTH_USER_KEY);
      return null;
    }

    try {
      return JSON.parse(savedUser);
    } catch {
      sessionStorage.removeItem(AUTH_USER_KEY);
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
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    let isMounted = true;
    api.getCurrentUser()
      .then((res) => {
        if (isMounted) {
          setUser(res.user);
          setCurrentView(res.user.role === 'admin' ? 'admin' : 'shop');
          sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
        }
      })
      .catch(() => {
        if (isMounted) {
          setUser(null);
          sessionStorage.removeItem(AUTH_USER_KEY);
        }
      })
      .finally(() => {
        if (isMounted) setAuthResolved(true);
      });
    return () => { isMounted = false; };
  }, []);

  const [showCart, setShowCart] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });

  // Order flow state
  const [showCheckout, setShowCheckout] = useState(false);
  const [ordersInitialId, setOrdersInitialId] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);

  useEffect(() => {
    sessionStorage.setItem(VIEW_KEY, currentView);
  }, [currentView]);

  // Initial Load
  const loadBooks = async () => {
    try {
      const res = await fetch('http://localhost:3000/books');
      const booksData = await res.json();
      if (Array.isArray(booksData)) {
        setBooks(booksData);
        setFilteredBooks(booksData);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        setLoading(true);
        await loadBooks();
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
  const refreshCart = async (uid) => {
    try {
      const data = await api.getCart(uid);
      setCart(data || { items: [], cart_subtotal: '0.00' });
    } catch (err) {
      showToast(err.message || 'Failed to load cart');
    }
  };
  const refreshWishlists = async (uid) => {
    try {
      const lists = await api.getCustomerWishlists(uid);
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
    } catch (err) {
      showToast(err.message || 'Failed to load wishlists');
    }
  };
  const loadWishlistBooks = async (wid) => {
    const data = await api.getWishlistBooks(wid).catch(() => ({ books: [] }));
    setCurrentWishlistBooks(data.books || []);
  };

  const handleAddToCart = async (bookId) => {
    if (!user) { setIsLoginMode(true); setShowAuthModal(true); return showToast('Please sign in first'); }
    try { await api.addToCart({ customer_id: user.id, book_id: bookId }); showToast('🛒 Added to Cart'); await refreshCart(user.id); } catch (e) { showToast(e.message || 'Error adding to cart'); }
  };
  const handleSaveToSpecificList = async (wid) => {
    try {
      const response = await api.addToWishlist({ wishlist_id: wid, book_id: bookToSave.book_id });
      showToast(response.added ? '❤️ Saved to Wishlist' : 'That book is already in this wishlist');
      setBookToSave(null);
      await refreshWishlists(user.id);
    } catch (err) {
      showToast(err.message || 'Failed to save to wishlist');
    }
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
        const saveResponse = await api.addToWishlist({
          wishlist_id: res.wishlist.wishlist_id,
          book_id: bookToSave.book_id
        });
        showToast(saveResponse.added
          ? `❤️ Saved to "${res.wishlist.wishlist_name}"!`
          : `That book is already in "${res.wishlist.wishlist_name}"`);
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
      if (isLoginMode) {
        const res = await api.login({ email: authForm.email, password: authForm.password });
        
        setUser(res.user);
        setCurrentView(res.user.role === 'admin' ? 'admin' : 'shop');
        sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
        showToast(`👋 Welcome back, ${res.user.username}!`);
      } else {
        const res = await api.signup(authForm);
        const registeredUser = res.user || {
          id: res.user_id, username: res.username, email: res.email, role: res.role
        };
        setUser(registeredUser);
        setCurrentView(registeredUser.role === 'admin' ? 'admin' : 'shop');
        sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(registeredUser));
        showToast('🎉 Account registered successfully!');
      }

      setShowAuthModal(false);
      setAuthForm({ username: '', email: '', password: '' });
    } catch (err) {
      alert(err.message || 'Authentication failed');
    }
  };

   const handleSignOut = async () => {
    try {
      // Optional: Calls the server-side logout to blacklist the token (Checklist 3.1)
      await api.logout().catch(() => {});
    } finally {
      setUser(null);
      sessionStorage.removeItem(AUTH_USER_KEY);
      sessionStorage.removeItem(VIEW_KEY);
      setCurrentView('shop');
      showToast('Signed out successfully');
    }
  };
  // ------------------------------------------------------------------
  // Order flow: Cart -> Checkout -> Pay -> Order tracking -> Review
  // ------------------------------------------------------------------
  const handleOpenCheckout = () => {
    if (!cart.items || cart.items.length === 0) { showToast('Your cart is empty'); return; }
    setShowCart(false);
    setShowCheckout(true);
  };

  const handleOrderPaid = (checkoutResponse) => {
    const order = checkoutResponse.order || checkoutResponse;
    setShowCheckout(false);
    refreshCart(user.id);
    setOrdersInitialId(order.order_id);
    setCurrentView('orders');
    showToast(
      order.payment_status === 'paid'
        ? `Order #${order.order_id} placed. Total: Tk ${checkoutResponse.total}. Simulated payment recorded.`
        : `Order #${order.order_id} placed. Total: Tk ${checkoutResponse.total}. Payment will be collected upon delivery.`
    );
  };

  const handleOpenOrders = () => {
    if (!user) { setIsLoginMode(true); setShowAuthModal(true); return; }
    setOrdersInitialId(null);
    setCurrentView('orders');
  };

  const handleOpenBook = async (bookId) => {
    try {
      setSelectedBook(await api.getBook(bookId));
    } catch (err) {
      showToast(err.message || 'Failed to load book details');
    }
  };

  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat);
    setCurrentView('shop');
  };

  if (!authResolved) {
    return <div className="auth-gate-loading">Checking your session...</div>;
  }

  if (!user) {
    return (
      <AuthModal
        isOpen
        onClose={() => {}}
        canClose={false}
        isLoginMode={isLoginMode}
        setIsLoginMode={setIsLoginMode}
        authForm={authForm}
        setAuthForm={setAuthForm}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <div className="bn-layout">
      {user.role !== 'admin' && (
        <Navbar
          selectedCategory={selectedCategory} setSelectedCategory={handleSelectCategory}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          wishlistCount={wishlists.reduce((acc, curr) => acc + Number(curr.total_saved_books || 0), 0)}
          cartCount={cart.items ? cart.items.length : 0} user={user}
          onOpenWishlist={() => user ? setShowWishlist(true) : setShowAuthModal(true)}
          onOpenCart={() => user ? setShowCart(true) : setShowAuthModal(true)}
          onOpenAuth={() => { setIsLoginMode(true); setShowAuthModal(true); }}
          onOpenAdmin={() => setCurrentView('admin')}
          onOpenOrders={handleOpenOrders}
          onSignOut={handleSignOut}
        />
      )}

      {toastMessage && <div className="toast-bar">{toastMessage}</div>}

      {user.role === 'admin' ? (
        <AdminDashboard user={user} onClose={handleSignOut} />
      ) : currentView === 'orders' ? (
        <OrdersView
          customerId={user ? user.id : null}
          initialOrderId={ordersInitialId}
          onCartChanged={() => user && refreshCart(user.id)}
          onReviewSubmitted={loadBooks}
          onClose={() => setCurrentView('shop')}
        />
      ) : selectedBook ? (
        <BookDetails
          book={selectedBook}
          customerId={user.id}
          onBack={() => setSelectedBook(null)}
          onAddToCart={handleAddToCart}
          onAddToWishlist={(book) => setBookToSave(book)}
        />
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
                <BookCard key={b.book_id} book={b} onAddToCart={handleAddToCart} onHeartClick={(book) => user ? setBookToSave(book) : setShowAuthModal(true)} onOpenDetails={handleOpenBook} />
              ))}
            </div>
          )}
        </main>
      )}

      <CartDrawer
        isOpen={showCart} onClose={() => setShowCart(false)} cart={cart}
        onUpdateQty={async (bid, qty) => { await api.updateCartQuantity({ customer_id: user.id, book_id: bid, updated_qty: qty }); refreshCart(user.id); }}
        onRemoveItem={async (bid) => { await api.removeFromCart({ customer_id: user.id, book_id: bid }); refreshCart(user.id); }}
        onCheckout={handleOpenCheckout}
      />

      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        cart={cart}
        customerId={user ? user.id : null}
        onOrderPaid={handleOrderPaid}
      />

      <WishlistDrawer
        isOpen={showWishlist} onClose={() => setShowWishlist(false)} wishlists={wishlists}
        selectedWishlistId={selectedWishlistId} onSelectWishlist={(wid) => { setSelectedWishlistId(wid); loadWishlistBooks(wid); }}
        books={currentWishlistBooks} onAddToCart={handleAddToCart}
        onRemoveItem={async (wid, bid) => { await api.removeFromWishlist({ wishlist_id: wid, book_id: bid }); refreshWishlists(user.id); }}
        onCreateList={handleCreateNewWishlist}
        onDeleteList={handleDeleteWishlist}
        onRenameList={async (wid, newName) => {
          try {
            await api.renameWishlist({
              wishlist_id: wid,
              new_name: newName,
              customer_id: user.id
            });
            await refreshWishlists(user.id);
            showToast('Wishlist renamed successfully');
          } catch (err) {
            alert(err.message || 'Failed to rename wishlist');
          }
        }}
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