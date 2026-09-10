import { useState, useEffect } from 'react';
import { api } from './api';
import Navbar from './components/Navbar';
import CartDrawer from './components/CartDrawer';
import WishlistDrawer from './components/WishlistDrawer';
import SaveWishlistModal from './components/SaveWishlistModal';
import AuthModal from './components/AuthModal';
import AdminDashboard from './components/AdminDashboard';
import DeliverymanDashboard from './components/DeliverymanDashboard';
import DeliverymanSetup from './components/DeliverymanSetup';
import CheckoutModal from './components/CheckoutModal';
import OrdersView from './components/OrdersView';
import BookDetails from './components/BookDetails';
import './App.css';
import HomePage from './components/HomePage';
import AllBooks from './components/AllBooks';

const AUTH_USER_KEY = 'bookstore_user';
const VIEW_KEY = 'bookstore_view';

export default function App() {
  const isDeliverymanSetupPage = window.location.pathname === '/deliveryman/setup';

  // Navigation & View State
  const [shopSection, setShopSection] = useState('home');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState(['All']);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [page, setPage] = useState(1);
  const [limit] = useState(12);

  // Books Data State
  const [books, setBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  const [currentView, setCurrentView] = useState(() => {
    const saved = sessionStorage.getItem(VIEW_KEY);
    return saved === 'admin' || saved === 'orders' || saved === 'delivery' ? saved : 'shop';
  });

  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem(AUTH_USER_KEY);
    if (!savedUser) return null;
    try { return JSON.parse(savedUser); }
    catch { sessionStorage.removeItem(AUTH_USER_KEY); return null; }
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

  const [showCart, setShowCart] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });

  const [showCheckout, setShowCheckout] = useState(false);
  const [ordersInitialId, setOrdersInitialId] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);

  useEffect(() => {
    let isMounted = true;
    api.getCurrentUser()
      .then((res) => {
        if (!isMounted) return;
        setUser(res.user);
        if (res.user.role === 'admin') setCurrentView('admin');
        else if (res.user.role === 'deliveryman') setCurrentView('delivery');
        else setCurrentView('shop');
        sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
      })
      .catch(() => {
        if (!isMounted) return;
        setUser(null);
        sessionStorage.removeItem(AUTH_USER_KEY);
      })
      .finally(() => isMounted && setAuthResolved(true));
    return () => { isMounted = false; };
  }, []);

  useEffect(() => { sessionStorage.setItem(VIEW_KEY, currentView); }, [currentView]);

  const loadCategories = async () => {
    try {
      const genres = await api.getGenres();
      const names = Array.isArray(genres) ? genres.map((g) => g.genre) : [];
      setCategories(['All', ...names]);
    } catch (err) {
      console.error(err);
      setCategories(['All']);
    }
  };

  const loadBooks = async () => {
    try {
      setLoading(true);
      const res = await api.getBooks({ genre: selectedCategory, page, limit });
      const bookRows = Array.isArray(res.data) ? res.data : [];
      setBooks(bookRows);
      setFilteredBooks(bookRows);
      setPagination(res.pagination || { page, totalPages: 1, total: bookRows.length });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadBooks(); }, [selectedCategory, page]);

  useEffect(() => {
    let result = [...books];
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((b) => {
        const titleMatch = Boolean(b?.title && String(b.title).toLowerCase().includes(q));
        const authorMatch = Array.isArray(b?.authors)
          ? b.authors.some(a => a && String(a).toLowerCase().includes(q))
          : false;
        return titleMatch || authorMatch;
      });
    }

    if (sortBy === 'price-low') result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    else if (sortBy === 'price-high') result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    else result.sort((a, b) => (b.book_id || 0) - (a.book_id || 0));

    setFilteredBooks(result);
  }, [books, searchQuery, sortBy]);

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(''), 3000); };

  const refreshCart = async (uid) => {
    try { setCart(await api.getCart(uid)); }
    catch (err) { showToast(err.message || 'Failed to load cart'); }
  };

  const refreshWishlists = async (uid) => {
    try {
      const lists = await api.getCustomerWishlists(uid);
      setWishlists(lists || []);
      if (lists?.length) {
        const activeId = selectedWishlistId && lists.some(w => w.wishlist_id === Number(selectedWishlistId))
          ? Number(selectedWishlistId) : lists[0].wishlist_id;
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

  useEffect(() => {
    if (user?.role === 'customer') {
      refreshCart(user.id);
      refreshWishlists(user.id);
    }
  }, [user]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLoginMode) {
        const res = await api.login({ email: authForm.email, password: authForm.password });
        setUser(res.user);
        if (res.user.role === 'admin') setCurrentView('admin');
        else if (res.user.role === 'deliveryman') setCurrentView('delivery');
        else setCurrentView('shop');
        sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
        showToast(`Welcome back, ${res.user.username}!`);
      } else {
        const res = await api.signup(authForm);
        const registeredUser = res.user || { id: res.user_id, username: res.username, email: res.email, role: res.role };
        setUser(registeredUser);
        setCurrentView('shop');
        sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(registeredUser));
        showToast('Account registered successfully!');
      }
      setShowAuthModal(false);
      setAuthForm({ username: '', email: '', password: '' });
    } catch (err) {
      alert(err.message || 'Authentication failed');
    }
  };

  const handleSignOut = async () => {
    try { await api.logout().catch(() => {}); }
    finally {
      setUser(null);
      sessionStorage.removeItem(AUTH_USER_KEY);
      sessionStorage.removeItem(VIEW_KEY);
      setCurrentView('shop');
      showToast('Signed out successfully');
    }
  };

  const handleAddToCart = async (bookId) => {
    if (!user || user.role !== 'customer') { setIsLoginMode(true); setShowAuthModal(true); return; }
    try { await api.addToCart({ customer_id: user.id, book_id: bookId }); showToast('Added to Cart'); refreshCart(user.id); }
    catch (e) { showToast(e.message || 'Error adding to cart'); }
  };

  const handleOpenBook = async (bookId) => {
    try { setSelectedBook(await api.getBook(bookId)); }
    catch (err) { showToast(err.message || 'Failed to load book details'); }
  };

  if (isDeliverymanSetupPage) return <DeliverymanSetup />;
  if (!authResolved) return <div className="auth-gate-loading">Checking your session...</div>;

  return (
    <div className="bn-layout">
      {toastMessage && <div className="toast-bar">{toastMessage}</div>}

      {(!user || user.role === 'customer') && (
        <Navbar
          selectedCategory={selectedCategory}
          setSelectedCategory={(category) => {
            setSelectedCategory(category);
            setSearchQuery('');
            setPage(1);
            setShopSection('all');
            setCurrentView('shop');
          }}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          categories={categories}
          wishlistCount={wishlists.reduce(
            (acc, curr) => acc + Number(curr.total_saved_books || 0),
            0
          )}
          cartCount={cart.items ? cart.items.length : 0}
          user={user}
          onOpenWishlist={() => (user ? setShowWishlist(true) : setShowAuthModal(true))}
          onOpenCart={() => (user ? setShowCart(true) : setShowAuthModal(true))}
          onOpenAuth={() => {
            setIsLoginMode(true);
            setShowAuthModal(true);
          }}
          onOpenOrders={() => user && setCurrentView('orders')}
          onSignOut={handleSignOut}
          onHome={() => {
            setSelectedCategory('All');
            setSearchQuery('');
            setPage(1);
            setShopSection('home');
            setCurrentView('shop');
          }}
          onBrowseBooks={() => {
            setSelectedCategory('All');
            setSearchQuery('');
            setPage(1);
            setShopSection('all');
            setCurrentView('shop');
          }}
        />
      )}

      {user?.role === 'admin' ? (
        <AdminDashboard user={user} onClose={handleSignOut} />
      ) : user?.role === 'deliveryman' ? (
        <DeliverymanDashboard user={user} onClose={handleSignOut} />
      ) : currentView === 'orders' && user ? (
        <OrdersView
          customerId={user.id}
          initialOrderId={ordersInitialId}
          onCartChanged={() => refreshCart(user.id)}
          onReviewSubmitted={loadBooks}
          onClose={() => setCurrentView('shop')}
        />
      ) : selectedBook ? (
        <BookDetails
          book={selectedBook}
          customerId={user?.id}
          onBack={() => setSelectedBook(null)}
          onAddToCart={handleAddToCart}
          onAddToWishlist={(book) => (user ? setBookToSave(book) : setShowAuthModal(true))}
        />
      ) : shopSection === 'home' ? (
        <HomePage
          categories={categories}
          onAddToCart={handleAddToCart}
          onHeartClick={(book) => (user ? setBookToSave(book) : setShowAuthModal(true))}
          onOpenDetails={handleOpenBook}
          onBrowseCategory={(category) => {
            setSelectedCategory(category);
            setSearchQuery('');
            setPage(1);
            setShopSection('all');
          }}
          onBrowseAll={() => {
            setSelectedCategory('All');
            setSearchQuery('');
            setPage(1);
            setShopSection('all');
          }}
        />
      ) : (
        <AllBooks
          selectedCategory={selectedCategory}
          setSelectedCategory={(category) => {
            setSelectedCategory(category);
            setPage(1);
          }}
          categories={categories}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onAddToCart={handleAddToCart}
          onHeartClick={(book) => (user ? setBookToSave(book) : setShowAuthModal(true))}
          onOpenDetails={handleOpenBook}
        />
      )}

      {user?.role === 'customer' && (
        <>
          <CartDrawer
            isOpen={showCart}
            onClose={() => setShowCart(false)}
            cart={cart}
            onUpdateQty={async (bid, qty) => {
              await api.updateCartQuantity({ customer_id: user.id, book_id: bid, updated_qty: qty });
              refreshCart(user.id);
            }}
            onRemoveItem={async (bid) => {
              await api.removeFromCart({ customer_id: user.id, book_id: bid });
              refreshCart(user.id);
            }}
            onCheckout={() => {
              if (!cart.items?.length) return showToast('Your cart is empty');
              setShowCart(false);
              setShowCheckout(true);
            }}
          />

          <CheckoutModal
            isOpen={showCheckout}
            onClose={() => setShowCheckout(false)}
            cart={cart}
            customerId={user.id}
            onOrderPaid={(checkoutResponse) => {
              const order = checkoutResponse.order || checkoutResponse;
              setShowCheckout(false);
              refreshCart(user.id);
              setOrdersInitialId(order.order_id);
              setCurrentView('orders');
            }}
          />

          <WishlistDrawer
            isOpen={showWishlist}
            onClose={() => setShowWishlist(false)}
            wishlists={wishlists}
            selectedWishlistId={selectedWishlistId}
            onSelectWishlist={(wid) => {
              setSelectedWishlistId(wid);
              loadWishlistBooks(wid);
            }}
            books={currentWishlistBooks}
            onAddToCart={handleAddToCart}
            onRemoveItem={async (wid, bid) => {
              await api.removeFromWishlist({ wishlist_id: wid, book_id: bid });
              refreshWishlists(user.id);
            }}
            onCreateList={async (name) => {
              await api.createWishlist({ customer_id: user.id, wishlist_name: name });
              refreshWishlists(user.id);
            }}
            onDeleteList={async (wid) => {
              await api.deleteWishlist(wid);
              refreshWishlists(user.id);
            }}
            onRenameList={async (wid, newName) => {
              await api.renameWishlist({ wishlist_id: wid, new_name: newName, customer_id: user.id });
              refreshWishlists(user.id);
            }}
            onSignOut={handleSignOut}
          />

          <SaveWishlistModal
            book={bookToSave}
            onClose={() => setBookToSave(null)}
            wishlists={wishlists}
            onSaveToSpecificList={async (wid) => {
              await api.addToWishlist({ wishlist_id: wid, book_id: bookToSave.book_id });
              setBookToSave(null);
              refreshWishlists(user.id);
            }}
            onCreateNewWishlist={async (name) => {
              const res = await api.createWishlist({ customer_id: user.id, wishlist_name: name });
              if (bookToSave && res.wishlist) {
                await api.addToWishlist({ wishlist_id: res.wishlist.wishlist_id, book_id: bookToSave.book_id });
              }
              setBookToSave(null);
              refreshWishlists(user.id);
            }}
            newWishlistName={newWishlistName}
            setNewWishlistName={setNewWishlistName}
          />
        </>
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        isLoginMode={isLoginMode}
        setIsLoginMode={setIsLoginMode}
        authForm={authForm}
        setAuthForm={setAuthForm}
        onSubmit={handleAuthSubmit}
      />
    </div>
  );
}