import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
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

// Fetches a single book based on the :bookId URL param, then renders BookDetails.
function BookDetailsRoute({ user, onAddToCart, onAddToWishlist, showToast }) {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setBook(null);
    setNotFound(false);
    api.getBook(bookId)
      .then((data) => { if (active) setBook(data); })
      .catch((err) => {
        if (!active) return;
        showToast(err.message || 'Failed to load book details');
        setNotFound(true);
      });
    return () => { active = false; };
  }, [bookId]);

  if (notFound) return <Navigate to="/books" replace />;
  if (!book) return <div className="home-loading">Loading book...</div>;

  return (
    <BookDetails
      book={book}
      customerId={user?.id}
      onBack={() => navigate(-1)}
      onAddToCart={onAddToCart}
      onAddToWishlist={onAddToWishlist}
    />
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation/filter state that's shared between Navbar, HomePage, AllBooks
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState(['All']);
  const [searchQuery, setSearchQuery] = useState('');

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
  const [authResolved, setAuthResolved] = useState(false);

  const [showCart, setShowCart] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });

  const [showCheckout, setShowCheckout] = useState(false);
  const [ordersInitialId, setOrdersInitialId] = useState(null);

  useEffect(() => {
    let isMounted = true;
    api.getCurrentUser()
      .then((res) => {
        if (!isMounted) return;
        setUser(res.user);
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

  useEffect(() => { loadCategories(); }, []);

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
        sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
        showToast(`Welcome back, ${res.user.username}!`);
        if (res.user.role === 'admin') navigate('/admin');
        else if (res.user.role === 'deliveryman') navigate('/delivery');
        else navigate('/');
      } else {
        const res = await api.signup(authForm);
        const registeredUser = res.user || { id: res.user_id, username: res.username, email: res.email, role: res.role };
        setUser(registeredUser);
        sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(registeredUser));
        showToast('Account registered successfully!');
        navigate('/');
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
      navigate('/');
      showToast('Signed out successfully');
    }
  };

  const handleAddToCart = async (bookId) => {
    if (!user || user.role !== 'customer') { setIsLoginMode(true); setShowAuthModal(true); return; }
    try { await api.addToCart({ customer_id: user.id, book_id: bookId }); showToast('Added to Cart'); refreshCart(user.id); }
    catch (e) { showToast(e.message || 'Error adding to cart'); }
  };

  const handleHeartClick = (book) => (user ? setBookToSave(book) : setShowAuthModal(true));

  // Deliveryman setup uses a plain query-string link from an email, so it's
  // handled before the auth check / router below, exactly like before.
  if (location.pathname === '/deliveryman/setup') return <DeliverymanSetup />;
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
            navigate('/books');
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
          onOpenOrders={() => user && navigate('/orders')}
          onSignOut={handleSignOut}
          onHome={() => {
            setSelectedCategory('All');
            setSearchQuery('');
            navigate('/');
          }}
          onBrowseBooks={() => {
            setSelectedCategory('All');
            navigate('/books');
          }}
        />
      )}

      <Routes>
        <Route
          path="/admin"
          element={user?.role === 'admin' ? <AdminDashboard user={user} onClose={handleSignOut} /> : <Navigate to="/" replace />}
        />

        <Route
          path="/delivery"
          element={user?.role === 'deliveryman' ? <DeliverymanDashboard user={user} onClose={handleSignOut} /> : <Navigate to="/" replace />}
        />

        <Route
          path="/orders"
          element={
            user?.role === 'customer' ? (
              <OrdersView
                customerId={user.id}
                initialOrderId={ordersInitialId}
                onCartChanged={() => refreshCart(user.id)}
                onReviewSubmitted={() => {}}
                onClose={() => navigate('/')}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route
          path="/books/:bookId"
          element={
            <BookDetailsRoute
              user={user}
              onAddToCart={handleAddToCart}
              onAddToWishlist={handleHeartClick}
              showToast={showToast}
            />
          }
        />

        <Route
          path="/books"
          element={
            user?.role === 'admin' ? <Navigate to="/admin" replace />
            : user?.role === 'deliveryman' ? <Navigate to="/delivery" replace />
            : (
              <AllBooks
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                categories={categories}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onAddToCart={handleAddToCart}
                onHeartClick={handleHeartClick}
                onOpenDetails={(bookId) => navigate(`/books/${bookId}`)}
              />
            )
          }
        />

        <Route
          path="/"
          element={
            user?.role === 'admin' ? <Navigate to="/admin" replace />
            : user?.role === 'deliveryman' ? <Navigate to="/delivery" replace />
            : (
              <HomePage
                categories={categories}
                onAddToCart={handleAddToCart}
                onHeartClick={handleHeartClick}
                onOpenDetails={(bookId) => navigate(`/books/${bookId}`)}
                onBrowseCategory={(category) => {
                  setSelectedCategory(category);
                  setSearchQuery('');
                  navigate('/books');
                }}
                onBrowseAll={() => {
                  setSelectedCategory('All');
                  setSearchQuery('');
                  navigate('/books');
                }}
              />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

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
              navigate('/orders');
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