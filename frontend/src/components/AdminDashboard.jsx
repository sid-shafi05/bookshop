// src/components/AdminDashboard.jsx
import { useState, useEffect, Fragment } from 'react';
import { api } from '../api';
import './AdminDashboard.css';

const EMPTY_FORM = {
  title: '', isbn: '', price: '', stock_quantity: '', publication_year: '',
  category_id: '',
  cover_url: '',    // existing cover on the server, when editing a book that already has one
  cover_file: null, // newly picked File object, if any
  cover_preview: '', // local blob URL for whatever is currently selected/existing
};
const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'cancelled', 'returned'];
const DELIVERY_STATUSES = ['preparing', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed'];
const DEFAULT_CATEGORIES = [
  'Fiction & Literature', 'Self-Development', 'Computer Science & Tech',
  'Sci-Fi & Fantasy', 'Academic & Education', 'Classics'
];

function formatPaymentMethod(method) {
  const labels = {
    cash_on_delivery: 'Cash on Delivery',
    mock_online: 'Online Payment (Demo)'
  };
  return labels[method] || (method ? method.replace(/_/g, ' ') : 'Not specified');
}

export default function AdminDashboard({ onClose, user }) {
  const [activeTab, setActiveTab] = useState('books'); // 'books' | 'orders' | 'users' | 'deliverymen'

  return (
    <main className="admin-wrapper">
      <div className="admin-header-row">
        <h2>Admin Dashboard</h2>
        <div className="admin-profile-actions">
          <div className="admin-profile">
            <strong>{user?.username}</strong>
            <span>{user?.email}</span>
            <small>ADMIN</small>
          </div>
          <button className="admin-back-btn" onClick={onClose}>Sign Out</button>
        </div>
      </div>

      <div className="admin-tabs">
        <TabButton label="Books" active={activeTab === 'books'} onClick={() => setActiveTab('books')} />
        <TabButton label="Orders" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
        <TabButton label="Deliverymen" active={activeTab === 'deliverymen'} onClick={() => setActiveTab('deliverymen')} />
        <TabButton label="Users" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
      </div>

      <div className="admin-panel">
        {activeTab === 'books' && <BooksTab />}
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'deliverymen' && <DeliverymenTab />}
        {activeTab === 'users' && <UsersTab />}
      </div>
    </main>
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button className={`admin-tab-btn ${active ? 'active' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}

/* ==========================================================================
   BOOKS TAB — full CRUD, with a cover image upload
   ========================================================================== */
function BooksTab() {
  const [books, setBooks] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const loadBooks = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminBooks();
      setBooks(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      console.error('Failed to load admin books:', err);
      setError(err.message || 'Failed to load books.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooks();
    api.getAdminCategories().then((data) => setCategoryOptions(data.length ? data : DEFAULT_CATEGORIES.map((category_name, category_id) => ({ category_id: category_id + 1, category_name })))).catch(() => setCategoryOptions(DEFAULT_CATEGORIES.map((category_name, category_id) => ({ category_id: category_id + 1, category_name }))));
  }, []);

  const buildFormData = (form) => {
    const fd = new FormData();
    fd.append('title', form.title);
    fd.append('isbn', form.isbn || '');
    fd.append('price', Number(form.price));
    fd.append('stock_quantity', Number(form.stock_quantity));
    fd.append('publication_year', form.publication_year ? Number(form.publication_year) : '');
    fd.append('category_id', form.category_id || '');

    if (form.cover_file) {
      fd.append('cover_image', form.cover_file);
    } else if (form.cover_url) {
      fd.append('existing_cover_url', form.cover_url);
    }
    return fd;
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createBook(buildFormData(createForm));
      setCreateForm(EMPTY_FORM);
      setShowCreateForm(false);
      loadBooks();
    } catch (err) {
      alert(err.message || 'Failed to create book');
    }
  };

  const startEdit = (book) => {
    setShowCreateForm(false);
    setEditingId(book.book_id);
    setEditForm({
      title: book.title || '',
      isbn: book.isbn || '',
      price: book.price ?? '',
      stock_quantity: book.stock_quantity ?? '',
      publication_year: book.publication_year ?? '',
      category_id: categoryOptions.find((category) =>
        (book.categories || []).includes(category.category_name)
      )?.category_id || '',
      cover_url: book.cover_url || '',
      cover_file: null,
      cover_preview: '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const handleEditSubmit = async (e, bookId) => {
    e.preventDefault();
    try {
      await api.updateBook(bookId, buildFormData(editForm));
      cancelEdit();
      loadBooks();
    } catch (err) {
      alert(err.message || 'Failed to update book');
    }
  };

  const handleDelete = async (bookId, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await api.deleteBook(bookId);
      loadBooks();
    } catch (err) {
      alert(err.message || 'Failed to delete book. It may have existing orders attached.');
    }
  };

  const stockPillClass = (qty) => {
    if (qty <= 0) return 'out';
    if (qty <= 10) return 'low';
    return 'ok';
  };

  if (loading) return <p className="admin-state-msg">Loading books...</p>;
  if (error) return <p className="admin-state-msg error">{error}</p>;

  const visibleBooks = books.filter((book) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || [book.title, book.isbn, ...(book.categories || [])]
      .some((value) => String(value || '').toLowerCase().includes(query));
    const matchesCategory = selectedCategory === 'All' || (book.categories || []).includes(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      <div className="admin-panel-toolbar">
        <h3>Book Inventory ({visibleBooks.length}{visibleBooks.length !== books.length ? ` of ${books.length}` : ''})</h3>
        <div className="admin-books-tools">
          <input
            type="search"
            placeholder="Search stock..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
            <option value="All">All categories</option>
            {categoryOptions.map((category) => (
              <option key={category.category_id} value={category.category_name}>{category.category_name}</option>
            ))}
          </select>
        </div>
        <button
          className={`admin-primary-btn ${showCreateForm ? 'cancel' : ''}`}
          onClick={() => { setEditingId(null); setShowCreateForm(!showCreateForm); }}
        >
          {showCreateForm ? 'Cancel' : '+ Add New Book'}
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreateSubmit} className="admin-form-card">
          <BookFormFields form={createForm} setForm={setCreateForm} categories={categoryOptions} />
          <div className="admin-form-actions">
            <button type="submit" className="btn-save">Create Book</button>
          </div>
        </form>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th></th>
            <th>ID</th>
            <th>Title</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {books.length === 0 ? (
            <tr><td colSpan={6} className="admin-empty-row">No books found.</td></tr>
          ) : (
            visibleBooks.map((book) =>
              editingId === book.book_id ? (
                <tr key={book.book_id}>
                  <td colSpan={6} className="edit-row-cell">
                    <form onSubmit={(e) => handleEditSubmit(e, book.book_id)}>
                      <BookFormFields form={editForm} setForm={setEditForm} categories={categoryOptions} />
                      <div className="admin-form-actions">
                        <button type="submit" className="btn-save">Save Changes</button>
                        <button type="button" className="btn-cancel" onClick={cancelEdit}>Cancel</button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={book.book_id}>
                  <td>
                    {book.cover_url && (
                      <img
                        className="admin-table-thumb"
                        src={`http://localhost:3000${book.cover_url}`}
                        alt={book.title}
                      />
                    )}
                  </td>
                  <td>{book.book_id}</td>
                  <td className="admin-cell-title">{book.title}</td>
                  <td>Tk {Number(book.price).toFixed(2)}</td>
                  <td>
                    <span className={`admin-stock-pill ${stockPillClass(book.stock_quantity)}`}>
                      {book.stock_quantity} in stock
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions-cell">
                      <button className="admin-icon-btn" onClick={() => startEdit(book)}>Edit</button>
                      <button
                        className="admin-icon-btn danger"
                        onClick={() => handleDelete(book.book_id, book.title)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function BookFormFields({ form, setForm, categories }) {
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setForm({ ...form, cover_file: file, cover_preview: previewUrl });
  };

  return (
    <div className="admin-form-grid">
      <input
        placeholder="Title" required value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <input
        placeholder="ISBN" value={form.isbn}
        onChange={(e) => setForm({ ...form, isbn: e.target.value })}
      />
      <input
        placeholder="Price" type="number" step="0.01" required value={form.price}
        onChange={(e) => setForm({ ...form, price: e.target.value })}
      />
      <input
        placeholder="Stock Qty" type="number" required value={form.stock_quantity}
        onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
      />
      <input
        placeholder="Pub. Year" type="number" value={form.publication_year}
        onChange={(e) => setForm({ ...form, publication_year: e.target.value })}
      />
      <select
        value={form.category_id}
        onChange={(e) => setForm({ ...form, category_id: e.target.value })}
      >
        <option value="">No category</option>
        {categories.map((category) => (
          <option key={category.category_id} value={category.category_id}>
            {category.category_name}
          </option>
        ))}
      </select>

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="admin-file-input"
      />

      {(form.cover_preview || form.cover_url) && (
        <div className="admin-cover-preview">
          <img
            src={form.cover_preview || `http://localhost:3000${form.cover_url}`}
            alt="Cover preview"
          />
          <span>{form.cover_file ? form.cover_file.name : 'Current cover'}</span>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   ORDERS TAB — status flow: confirmed -> processing -> assign delivery
   (shipped) -> advance delivery sub-status -> delivered
   ========================================================================== */
function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [deliverymen, setDeliverymen] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [detailCache, setDetailCache] = useState({});
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [assigningId, setAssigningId] = useState(null);
  const [assignForm, setAssignForm] = useState({ deliveryman_id: '', shipping_method: '', tracking_number: '' });

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminOrders();
      setOrders(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      console.error('Failed to load orders:', err);
      setError(err.message || 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  };

  const loadDeliverymen = async () => {
    try {
      const data = await api.getDeliverymen();
      setDeliverymen((Array.isArray(data) ? data : []).filter((d) => d.is_active));
    } catch (err) {
      console.error('Failed to load deliverymen:', err);
    }
  };

  useEffect(() => { loadOrders(); loadDeliverymen(); }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await api.updateOrderStatus(orderId, newStatus);
      loadOrders();
    } catch (err) {
      alert(err.message || 'Failed to update order status');
    }
  };

  const toggleOrderDetails = async (orderId) => {
    if (expandedId === orderId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(orderId);
    if (detailCache[orderId]) return;
    setDetailLoadingId(orderId);
    try {
      const detail = await api.getAdminOrderDetail(orderId);
      setDetailCache((previous) => ({ ...previous, [orderId]: detail }));
    } catch (err) {
      setDetailCache((previous) => ({ ...previous, [orderId]: { error: err.message } }));
    } finally {
      setDetailLoadingId(null);
    }
  };

  const startAssign = (order) => {
    setAssigningId(order.order_id);
    setAssignForm({ deliveryman_id: deliverymen[0]?.deliveryman_id || '', shipping_method: 'Standard Delivery', tracking_number: '' });
  };

  const submitAssign = async (e, orderId) => {
    e.preventDefault();
    if (!assignForm.deliveryman_id) return alert('Please choose a deliveryman');
    try {
      await api.shipOrder(orderId, assignForm);
      setAssigningId(null);
      loadOrders();
    } catch (err) {
      alert(err.message || 'Failed to assign delivery');
    }
  };

  const handleDeliveryStatusChange = async (order, newStatus) => {
    try {
      await api.updateDeliveryStatus(order.delivery_id, newStatus);
      loadOrders();
    } catch (err) {
      alert(err.message || 'Failed to update delivery status');
    }
  };

  if (loading) return <p className="admin-state-msg">Loading orders...</p>;
  if (error) return <p className="admin-state-msg error">{error}</p>;

  return (
    <div>
      <div className="admin-panel-toolbar">
        <h3>Orders ({orders.length})</h3>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Status</th>
            <th>Fulfillment</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr><td colSpan={6} className="admin-empty-row">No orders found.</td></tr>
          ) : (
            orders.map((order) => (
              <Fragment key={order.order_id}>
                <tr className="admin-order-row" onClick={() => toggleOrderDetails(order.order_id)}>
                  <td>#{order.order_id}{/*<small className="admin-expand-hint">{expandedId === order.order_id ? 'Hide details' : 'View details'}</small>*/}</td>
                  <td>
                    <div className="admin-cell-title">{order.username}</div>
                    <div style={{ fontSize: '0.78rem', color: '#8c827a' }}>{order.email}</div>
                  </td>
                  <td>Tk {Number(order.total_amount).toFixed(2)}</td>
                  <td>
                    <span className={`admin-stock-pill ${order.payment_status === 'paid' ? 'ok' : 'low'}`}>
                      {order.payment_status}
                    </span>
                  </td>
                  <td>
                    {['shipped', 'delivered'].includes(order.status) ? (
                      <span className="admin-status-select" style={{ display: 'inline-block', cursor: 'default' }}>
                        {order.status}
                      </span>
                    ) : (
                      <select
                        className="admin-status-select"
                        value={order.status}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(e) => handleStatusChange(order.order_id, e.target.value)}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    {['confirmed', 'processing'].includes(order.status) &&
                      (order.payment_status === 'paid' || order.payment_method === 'cash_on_delivery') && (
                      <button className="admin-icon-btn" onClick={(event) => { event.stopPropagation(); startAssign(order); }}>
                        Assign Delivery
                      </button>
                    )}
                    {order.status === 'pending' && (
                      <span style={{ fontSize: '0.78rem', color: '#8c827a' }}>Awaiting payment</span>
                    )}
                    {order.status === 'shipped' && order.delivery_id && (
                      <div>
                        <select
                          className="admin-status-select"
                          value={order.delivery_status || 'picked_up'}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(e) => handleDeliveryStatusChange(order, e.target.value)}
                        >
                          {DELIVERY_STATUSES.map((s) => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        <div style={{ fontSize: '0.72rem', color: '#8c827a', marginTop: 4 }}>
                          {order.rider_name} · {order.rider_phone}
                        </div>
                      </div>
                    )}
                    {order.status === 'delivered' && (
                      <span className="admin-stock-pill ok">Delivered</span>
                    )}
                  </td>
                </tr>
                {expandedId === order.order_id && (
                  <tr>
                    <td colSpan={6} className="admin-order-detail-cell" onClick={(event) => event.stopPropagation()}>
                      {detailLoadingId === order.order_id && <p>Loading order details...</p>}
                      {detailCache[order.order_id]?.error && <p className="admin-state-msg error">{detailCache[order.order_id].error}</p>}
                      {detailCache[order.order_id] && !detailCache[order.order_id].error && (
                        <div className="admin-order-detail">
                          <p><strong>Payment method:</strong> {formatPaymentMethod(detailCache[order.order_id].order.payment_method)}</p>
                          <p><strong>Shipping address:</strong> {[detailCache[order.order_id].order.shipping_house_no, detailCache[order.order_id].order.shipping_street, detailCache[order.order_id].order.shipping_city, detailCache[order.order_id].order.shipping_country].filter(Boolean).join(', ') || 'Not provided'}</p>
                          <h4>Items</h4>
                          {detailCache[order.order_id].items.map((item) => (
                            <div className="admin-order-item" key={item.order_item_id}>
                              <span>{item.title}</span><span>× {item.quantity}</span><span>Tk {Number(item.unit_price).toFixed(2)}</span>
                            </div>
                          ))}
                          {detailCache[order.order_id].delivery && <p><strong>Delivery:</strong> {detailCache[order.order_id].delivery.deliveryman_name || 'Unassigned'}{detailCache[order.order_id].delivery.tracking_number ? ` · ${detailCache[order.order_id].delivery.tracking_number}` : ''}</p>}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                {assigningId === order.order_id && (
                  <tr>
                    <td colSpan={6} className="edit-row-cell">
                      <form onSubmit={(e) => submitAssign(e, order.order_id)} className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                        <select
                          value={assignForm.deliveryman_id}
                          onChange={(e) => setAssignForm({ ...assignForm, deliveryman_id: e.target.value })}
                          required
                        >
                          <option value="" disabled>Select deliveryman</option>
                          {deliverymen.map((d) => (
                            <option key={d.deliveryman_id} value={d.deliveryman_id}>{d.name} ({d.phone})</option>
                          ))}
                        </select>
                        <input
                          placeholder="Shipping method" value={assignForm.shipping_method}
                          onChange={(e) => setAssignForm({ ...assignForm, shipping_method: e.target.value })}
                        />
                        <input
                          placeholder="Tracking # (optional, auto-generated if blank)" value={assignForm.tracking_number}
                          onChange={(e) => setAssignForm({ ...assignForm, tracking_number: e.target.value })}
                        />
                        <div className="admin-form-actions">
                          <button type="submit" className="btn-save">Confirm &amp; Ship</button>
                          <button type="button" className="btn-cancel" onClick={() => setAssigningId(null)}>Cancel</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ==========================================================================
   DELIVERYMEN TAB — CRUD for the pool of riders
   ========================================================================== */
const EMPTY_RIDER_FORM = { name: '', phone: '', vehicle_type: '', is_active: true };

function DeliverymenTab() {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_RIDER_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_RIDER_FORM);

  const loadRiders = async () => {
    try {
      setLoading(true);
      const data = await api.getDeliverymen();
      setRiders(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      console.error('Failed to load deliverymen:', err);
      setError(err.message || 'Failed to load deliverymen.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRiders(); }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createDeliveryman(createForm);
      setCreateForm(EMPTY_RIDER_FORM);
      setShowCreateForm(false);
      loadRiders();
    } catch (err) {
      alert(err.message || 'Failed to add deliveryman');
    }
  };

  const startEdit = (rider) => {
    setShowCreateForm(false);
    setEditingId(rider.deliveryman_id);
    setEditForm({ name: rider.name, phone: rider.phone, vehicle_type: rider.vehicle_type || '', is_active: rider.is_active });
  };

  const handleEditSubmit = async (e, id) => {
    e.preventDefault();
    try {
      await api.updateDeliveryman(id, editForm);
      setEditingId(null);
      loadRiders();
    } catch (err) {
      alert(err.message || 'Failed to update deliveryman');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove "${name}" from the delivery team?`)) return;
    try {
      await api.deleteDeliveryman(id);
      loadRiders();
    } catch (err) {
      alert(err.message || 'Failed to remove deliveryman');
    }
  };

  if (loading) return <p className="admin-state-msg">Loading deliverymen...</p>;
  if (error) return <p className="admin-state-msg error">{error}</p>;

  return (
    <div>
      <div className="admin-panel-toolbar">
        <h3>Delivery Team ({riders.length})</h3>
        <button
          className={`admin-primary-btn ${showCreateForm ? 'cancel' : ''}`}
          onClick={() => { setEditingId(null); setShowCreateForm(!showCreateForm); }}
        >
          {showCreateForm ? 'Cancel' : '+ Add Deliveryman'}
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreateSubmit} className="admin-form-card">
          <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <input placeholder="Full Name" required value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
            <input placeholder="Phone" required value={createForm.phone}
              onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
            <input placeholder="Vehicle (e.g. Motorbike)" value={createForm.vehicle_type}
              onChange={(e) => setCreateForm({ ...createForm, vehicle_type: e.target.value })} />
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="btn-save">Add Deliveryman</button>
          </div>
        </form>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Phone</th>
            <th>Vehicle</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {riders.length === 0 ? (
            <tr><td colSpan={6} className="admin-empty-row">No deliverymen yet.</td></tr>
          ) : (
            riders.map((rider) =>
              editingId === rider.deliveryman_id ? (
                <tr key={rider.deliveryman_id}>
                  <td colSpan={6} className="edit-row-cell">
                    <form onSubmit={(e) => handleEditSubmit(e, rider.deliveryman_id)}>
                      <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                        <input placeholder="Full Name" required value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                        <input placeholder="Phone" required value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                        <input placeholder="Vehicle" value={editForm.vehicle_type}
                          onChange={(e) => setEditForm({ ...editForm, vehicle_type: e.target.value })} />
                        <select
                          value={editForm.is_active ? 'active' : 'inactive'}
                          onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'active' })}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                      <div className="admin-form-actions">
                        <button type="submit" className="btn-save">Save Changes</button>
                        <button type="button" className="btn-cancel" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={rider.deliveryman_id}>
                  <td>{rider.deliveryman_id}</td>
                  <td className="admin-cell-title">{rider.name}</td>
                  <td>{rider.phone}</td>
                  <td>{rider.vehicle_type || '—'}</td>
                  <td>
                    <span className={`admin-stock-pill ${rider.is_active ? 'ok' : 'out'}`}>
                      {rider.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions-cell">
                      <button className="admin-icon-btn" onClick={() => startEdit(rider)}>Edit</button>
                      <button className="admin-icon-btn danger" onClick={() => handleDelete(rider.deliveryman_id, rider.name)}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ==========================================================================
   USERS TAB — read-only
   ========================================================================== */
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ username: '', email: '', password: '' });

  useEffect(() => {
    let isMounted = true;
    const loadUsers = async () => {
      try {
        setLoading(true);
        const data = await api.getAdminUsers();
        if (isMounted) setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load users:', err);
        if (isMounted) setError(err.message || 'Failed to load users.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadUsers();
    return () => { isMounted = false; };
  }, []);

  if (loading) return <p className="admin-state-msg">Loading users...</p>;
  if (error) return <p className="admin-state-msg error">{error}</p>;

  const handleCreateAdmin = async (event) => {
    event.preventDefault();
    try {
      await api.createAdmin(createForm);
      setCreateForm({ username: '', email: '', password: '' });
      setShowCreateForm(false);
      window.location.reload();
    } catch (err) {
      alert(err.message || 'Failed to create admin');
    }
  };

  return (
    <div>
      <div className="admin-panel-toolbar">
        <h3>Registered Users ({users.length})</h3>
        <button
          className={`admin-primary-btn ${showCreateForm ? 'cancel' : ''}`}
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Cancel' : '+ Create Admin'}
        </button>
      </div>
      {showCreateForm && (
        <form onSubmit={handleCreateAdmin} className="admin-form-card">
          <div className="admin-form-grid">
            <input placeholder="Username" required value={createForm.username}
              onChange={(event) => setCreateForm({ ...createForm, username: event.target.value })} />
            <input type="email" pattern="[^\s@]+@[^\s@]+\.[A-Za-z]{2,}" title="Enter an email address with a valid domain" placeholder="Email" required value={createForm.email}
              onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} />
            <input type="password" placeholder="Password (min. 6 characters)" minLength={6} required value={createForm.password}
              onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} />
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="btn-save">Create Admin</button>
          </div>
        </form>
      )}
      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>City</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr><td colSpan={6} className="admin-empty-row">No users found.</td></tr>
          ) : (
            users.map((u) => (
              <tr key={u.user_id}>
                <td>{u.user_id}</td>
                <td className="admin-cell-title">{u.username}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`admin-role-badge ${u.role}`}>{u.role?.toUpperCase()}</span>
                </td>
                <td>{u.city || '—'}</td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}