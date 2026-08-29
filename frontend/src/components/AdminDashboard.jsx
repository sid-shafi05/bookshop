// src/components/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { api } from '../api';
import './AdminDashboard.css';

const EMPTY_FORM = {
  title: '', isbn: '', price: '', stock_quantity: '', publication_year: '',
  cover_url: '',    // existing cover on the server, when editing a book that already has one
  cover_file: null, // newly picked File object, if any
  cover_preview: '', // local blob URL for whatever is currently selected/existing
};
const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];

export default function AdminDashboard({ onClose }) {
  const [activeTab, setActiveTab] = useState('books'); // 'books' | 'orders' | 'users'

  return (
    <main className="admin-wrapper">
      <div className="admin-header-row">
        <h2>Admin Dashboard</h2>
        <button className="admin-back-btn" onClick={onClose}>← Back to Shop</button>
      </div>

      <div className="admin-tabs">
        <TabButton label="Books" active={activeTab === 'books'} onClick={() => setActiveTab('books')} />
        <TabButton label="Orders" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
        <TabButton label="Users" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
      </div>

      <div className="admin-panel">
        {activeTab === 'books' && <BooksTab />}
        {activeTab === 'orders' && <OrdersTab />}
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
   BOOKS TAB — full CRUD, now with a cover image upload
   ========================================================================== */
function BooksTab() {
  const [books, setBooks] = useState([]);
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
      setError('Failed to load books.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBooks(); }, []);

  // Turns our plain form object into FormData — the shape the backend
  // needs now that these requests can carry an image file.
  const buildFormData = (form) => {
    const fd = new FormData();
    fd.append('title', form.title);
    fd.append('isbn', form.isbn || '');
    fd.append('price', Number(form.price));
    fd.append('stock_quantity', Number(form.stock_quantity));
    fd.append('publication_year', form.publication_year ? Number(form.publication_year) : '');

    if (form.cover_file) {
      // Field name MUST match upload.single('cover_image') on the backend.
      fd.append('cover_image', form.cover_file);
    } else if (form.cover_url) {
      // No new file chosen — tell the server to keep the existing cover.
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

  return (
    <div>
      <div className="admin-panel-toolbar">
        <h3>Book Inventory ({books.length})</h3>
        <button
          className={`admin-primary-btn ${showCreateForm ? 'cancel' : ''}`}
          onClick={() => { setEditingId(null); setShowCreateForm(!showCreateForm); }}
        >
          {showCreateForm ? 'Cancel' : '+ Add New Book'}
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreateSubmit} className="admin-form-card">
          <BookFormFields form={createForm} setForm={setCreateForm} />
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
            books.map((book) =>
              editingId === book.book_id ? (
                <tr key={book.book_id}>
                  <td colSpan={6} className="edit-row-cell">
                    <form onSubmit={(e) => handleEditSubmit(e, book.book_id)}>
                      <BookFormFields form={editForm} setForm={setEditForm} />
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

function BookFormFields({ form, setForm }) {
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Instant local preview — the actual upload happens on submit.
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
   ORDERS TAB — view + update status
   ========================================================================== */
function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminOrders();
      setOrders(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      console.error('Failed to load orders:', err);
      setError('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await api.updateOrderStatus(orderId, newStatus);
      loadOrders();
    } catch (err) {
      alert(err.message || 'Failed to update order status');
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
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr><td colSpan={5} className="admin-empty-row">No orders found.</td></tr>
          ) : (
            orders.map((order) => (
              <tr key={order.order_id}>
                <td>#{order.order_id}</td>
                <td>
                  <div className="admin-cell-title">{order.username}</div>
                  <div style={{ fontSize: '0.78rem', color: '#8c827a' }}>{order.email}</div>
                </td>
                <td>Tk {Number(order.total_amount).toFixed(2)}</td>
                <td>{new Date(order.order_date).toLocaleDateString()}</td>
                <td>
                  <select
                    className="admin-status-select"
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.order_id, e.target.value)}
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))
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

  useEffect(() => {
    let isMounted = true;
    const loadUsers = async () => {
      try {
        setLoading(true);
        const data = await api.getAdminUsers();
        if (isMounted) setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load users:', err);
        if (isMounted) setError('Failed to load users.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadUsers();
    return () => { isMounted = false; };
  }, []);

  if (loading) return <p className="admin-state-msg">Loading users...</p>;
  if (error) return <p className="admin-state-msg error">{error}</p>;

  return (
    <div>
      <div className="admin-panel-toolbar">
        <h3>Registered Users ({users.length})</h3>
      </div>
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