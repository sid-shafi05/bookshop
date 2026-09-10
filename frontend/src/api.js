// frontend/src/api.js
const API_URL = 'http://localhost:3000';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

async function requestFormData(path, formData, method = 'POST') {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {},
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  // Admin
  getAdminBooks: () => request('/admin/books'),
  getAdminCategories: () => request('/admin/categories'),
  createBook: (bookFormData) => requestFormData('/admin/books', bookFormData, 'POST'),
  updateBook: (bookId, bookFormData) => requestFormData(`/admin/books/${bookId}`, bookFormData, 'PUT'),
  deleteBook: (bookId) => request(`/admin/books/${bookId}`, { method: 'DELETE' }),
  getAdminUsers: () => request('/admin/users'),
  createAdmin: (data) => request('/admin/admins', { method: 'POST', body: JSON.stringify(data) }),
  getAdminOrders: () => request('/admin/orders'),
  getAdminOrderDetail: (orderId) => request(`/admin/order-details/${orderId}`),
  updateOrderStatus: (orderId, newStatus) => request(`/admin/orders/${orderId}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) }),

  // Delivery assignment (admin)
  getDeliverymen: () => request('/admin/deliverymen'),
  createDeliveryman: (data) => request('/admin/deliverymen', { method: 'POST', body: JSON.stringify(data) }),
  updateDeliveryman: (id, data) => request(`/admin/deliverymen/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDeliveryman: (id) => request(`/admin/deliverymen/${id}`, { method: 'DELETE' }),
  shipOrder: (orderId, { deliveryman_id, shipping_method, tracking_number }) =>
    request(`/admin/orders/${orderId}/ship`, { method: 'POST', body: JSON.stringify({ deliveryman_id, shipping_method, tracking_number }) }),
  updateDeliveryStatus: (deliveryId, status) =>
    request(`/admin/deliveries/${deliveryId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Deliveryman dashboard
  getDeliverymanProfile: () => request('/deliveryman/me'),
  getDeliveryRequests: () => request('/deliveryman/requests'),
  getMyActiveDeliveries: () => request('/deliveryman/deliveries'),
  getMyDeliveryHistory: () => request('/deliveryman/deliveries/history'),
  getMyDeliveryDetail: (deliveryId) => request(`/deliveryman/deliveries/${deliveryId}`),
  acceptDelivery: (deliveryId) => request(`/deliveryman/deliveries/${deliveryId}/accept`, { method: 'POST' }),
  declineDelivery: (deliveryId) => request(`/deliveryman/deliveries/${deliveryId}/decline`, { method: 'POST' }),
  updateMyDeliveryStatus: (deliveryId, status) =>
    request(`/deliveryman/deliveries/${deliveryId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Books & Catalog
  getBooks: ({ genre = 'All', page = 1, limit = 12 } = {}) =>
    request(`/books?genre=${encodeURIComponent(genre)}&page=${page}&limit=${limit}`),
  getBook: (bookId) => request(`/books/${bookId}`),
  getGenres: () => request('/books/genres'),

  // Auth
  signup: ({ username, email, password }) =>
    request('/auth/signup', { method: 'POST', body: JSON.stringify({ username, email, password }) }),
  login: ({ email, password }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getCurrentUser: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  completeDeliverymanSetup: ({ token, username, password }) =>
    request('/auth/deliveryman-setup', { method: 'POST', body: JSON.stringify({ token, username, password }) }),

  // Cart
  getCart: (customerId) => request(`/cart/${customerId}`),
  addToCart: ({ customer_id, book_id, quantity = 1 }) =>
    request('/cart/add', { method: 'POST', body: JSON.stringify({ customer_id, book_id, quantity }) }),
  updateCartQuantity: ({ customer_id, book_id, updated_qty }) =>
    request('/cart/update', { method: 'PUT', body: JSON.stringify({ customer_id, book_id, updated_qty }) }),
  removeFromCart: ({ customer_id, book_id }) =>
    request('/cart/remove', { method: 'DELETE', body: JSON.stringify({ customer_id, book_id }) }),

  // Wishlist
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
  deleteWishlist: (wishlistId) =>
    request(`/wishlist/${wishlistId}`, { method: 'DELETE' }),

  // Orders (customer)
  checkout: (payload) => request('/orders/checkout', { method: 'POST', body: JSON.stringify(payload) }),
  getCustomerOrders: (customerId) => request(`/orders/customer/${customerId}`),
  getOrderDetail: (orderId) => request(`/orders/${orderId}`),
  cancelOrder: (orderId) => request(`/orders/${orderId}/cancel`, { method: 'PUT' }),

  // Reviews
  getBookReviews: (bookId) => request(`/reviews/book/${bookId}`),
  checkReviewEligibility: (customerId, bookId) => request(`/reviews/eligibility/${customerId}/${bookId}`),
  submitReview: ({ customer_id, book_id, rating, comment }) =>
    request('/reviews', { method: 'POST', body: JSON.stringify({ customer_id, book_id, rating, comment }) }),
};