// frontend/src/api.js
const API_URL = 'http://localhost:3000';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  // Books & Catalog
  getBooks: () => request('/books'),
  
  // Auth
  signup: ({ username, email, password }) =>
    request('/auth/signup', { method: 'POST', body: JSON.stringify({ username, email, password }) }),
  login: ({ email, password }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  // Cart
  getCart: (customerId) => request(`/cart/${customerId}`),
  addToCart: ({ customer_id, book_id, quantity = 1 }) =>
    request('/cart/add', { method: 'POST', body: JSON.stringify({ customer_id, book_id, quantity }) }),
  updateCartQuantity: ({ customer_id, book_id, updated_qty }) =>
    request('/cart/update', { method: 'PUT', body: JSON.stringify({ customer_id, book_id, updated_qty }) }),
  removeFromCart: ({ customer_id, book_id }) =>
    request('/cart/remove', { method: 'DELETE', body: JSON.stringify({ customer_id, book_id }) }),
// Wishlist API
  getCustomerWishlists: (customerId) => request(`/wishlist/customer/${customerId}`),
  getWishlistBooks: (wishlistId) => request(`/wishlist/${wishlistId}`),
  createWishlist: ({ customer_id, wishlist_name }) =>
    request('/wishlist/create', { method: 'POST', body: JSON.stringify({ customer_id, wishlist_name }) }),
  renameWishlist: ({ wishlist_id, new_name, customer_id }) =>
    request('/wishlist/rename', { method: 'PUT', body: JSON.stringify({ wishlist_id, new_name, customer_id }) }),
  addToWishlist: ({ wishlist_id, book_id }) =>
    request('/wishlist/add', { method: 'POST', body: JSON.stringify({ wishlist_id, book_id }) }),
  removeFromWishlist: ({ wishlist_id, book_id }) =>
    request('/wishlist/remove_book', { method: 'DELETE', body: JSON.stringify({ wishlist_id, book_id }) }),
  deleteWishlist: (wishlist_id) =>
    request(`/wishlist/${wishlist_id}`, { method: 'DELETE' }),
};