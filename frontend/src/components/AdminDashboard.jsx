// src/components/AdminDashboard.jsx
import { useState, useEffect, Fragment } from 'react';
import { api } from '../api';
import './AdminDashboard.css';
import NotificationBell from './NotificationBell';

const EMPTY_FORM = {
  title: '', isbn: '', description: '', publisher_name: '', author_names: '',
  price: '', stock_quantity: '', publication_year: '',
  category_ids: [],
  cover_url: '',
  cover_file: null,
  cover_preview: '',
};

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'cancelled'];
const DELIVERY_STATUSES = [
  'preparing',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered'
];
const DEFAULT_CATEGORY_NAMES = [
  'Fiction & Literature',
  'Self-Development',
  'Computer Science & Tech',
  'Sci-Fi & Fantasy',
  'Academic & Education',
  'Classics',
  'Business & Economics',
  'History & Politics',
  'Children\'s Books',
  'Poetry & Literature',
  'Travel & Lifestyle',
  'Bangla Literature',
  'Romance',
  'Mystery & Thriller',
  'Comics & Manga',
  'Religion & Spirituality',
  'Health & Wellness',
  'Cooking & Food',
  'Art & Design',
  'Music',
  'Sports & Fitness',
  'Technology & Innovation',
  'Biography & Memoir',
  'Philosophy & Psychology'
];

function formatPaymentMethod(method) {
  const labels = {
    cash_on_delivery: 'Cash on Delivery',
    mock_online: 'Online Payment (Demo)'
  };

  return labels[method] || (method ? method.replace(/_/g, ' ') : 'Not specified');
}

export default function AdminDashboard({ onClose, user , onOpenProfile}) {
  const [activeTab, setActiveTab] = useState('books');

  return (
    <main className="admin-wrapper">
      <div className="admin-header-row">
        <h2>Admin Dashboard</h2>

        <div className="admin-profile-actions">
          <NotificationBell user={user} />

          <div className="admin-profile">
            <strong>{user?.username}</strong>
            <span>{user?.email}</span>
            <small>ADMIN</small>
          </div>
<button className="admin-back-btn" onClick={onOpenProfile}>My Profile</button> 
          <button className="admin-back-btn" onClick={onClose}>
            Sign Out
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        <TabButton
          label="Books"
          active={activeTab === 'books'}
          onClick={() => setActiveTab('books')}
        />

        <TabButton
          label="Coupons"
          active={activeTab === 'coupons'}
          onClick={() => setActiveTab('coupons')}
        />

        <TabButton
          label="Orders"
          active={activeTab === 'orders'}
          onClick={() => setActiveTab('orders')}
        />

        <TabButton
          label="Deliverymen"
          active={activeTab === 'deliverymen'}
          onClick={() => setActiveTab('deliverymen')}
        />
        <TabButton
          label="Returns"
          active={activeTab === 'returns'}
          onClick={() => setActiveTab('returns')}
        />
        <TabButton
          label="Users"
          active={activeTab === 'users'}
          onClick={() => setActiveTab('users')}
        />
      </div>

      <div className="admin-panel">
        {activeTab === 'books' && <BooksTab />}
        {activeTab === 'coupons' && <CouponsTab />}
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'deliverymen' && <DeliverymenTab />}
        {activeTab === 'returns' && <ReturnsTab />}
        {activeTab === 'users' && <UsersTab />}
      </div>
    </main>
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      className={`admin-tab-btn ${active ? 'active' : ''}`}
      onClick={onClick}
    >
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
  const [newCategoryName, setNewCategoryName] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const refreshCategories = async () => {
    try {
      const data = await api.getAdminCategories();
      const fallbackOptions = DEFAULT_CATEGORY_NAMES.map((category_name, index) => ({
        category_id: index + 1,
        category_name
      }));
      setCategoryOptions(Array.isArray(data) && data.length ? data : fallbackOptions);
    } catch (err) {
      console.error('Failed to refresh categories:', err);
      setCategoryOptions(
        DEFAULT_CATEGORY_NAMES.map((category_name, index) => ({
          category_id: index + 1,
          category_name
        }))
      );
    }
  };

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
    refreshCategories();
  }, []);

  const handleAddCategory = async (categoryText) => {
    const trimmed = String(categoryText || '').trim();

    if (!trimmed) {
      alert('Please enter a category name.');
      return;
    }

    try {
      await api.createCategory(trimmed);
      setNewCategoryName('');
      await refreshCategories();
    } catch (err) {
      alert(err.message || 'Failed to create category');
    }
  };

  const buildFormData = (form) => {
    const fd = new FormData();

    fd.append('title', form.title);
    fd.append('isbn', form.isbn || '');
    fd.append('description', form.description || '');
    fd.append('publisher_name', form.publisher_name || '');
    fd.append('author_names', form.author_names || '');
    fd.append('price', Number(form.price));
    fd.append('stock_quantity', Number(form.stock_quantity));
    fd.append(
      'publication_year',
      form.publication_year ? Number(form.publication_year) : ''
    );

    if (Array.isArray(form.category_ids)) {
      form.category_ids.forEach((categoryId) => fd.append('category_ids', categoryId));
    }

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
      category_ids: (book.categories || [])
        .map((categoryName) =>
          categoryOptions.find((category) => category.category_name === categoryName)?.category_id
        )
        .filter(Boolean),
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
      alert(
        err.message ||
        'Failed to delete book. It may have existing orders attached.'
      );
    }
  };

  const stockPillClass = (qty) => {
    if (qty <= 0) return 'out';
    if (qty <= 10) return 'low';
    return 'ok';
  };

  if (loading) {
    return <p className="admin-state-msg">Loading books...</p>;
  }

  if (error) {
    return <p className="admin-state-msg error">{error}</p>;
  }

  const visibleBooks = books.filter((book) => {
    const query = searchQuery.trim().toLowerCase();

    const matchesSearch =
      !query ||
      [book.title, book.isbn, ...(book.categories || [])]
        .some((value) =>
          String(value || '').toLowerCase().includes(query)
        );

    const matchesCategory =
      selectedCategory === 'All' ||
      (book.categories || []).includes(selectedCategory);

    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      <div className="admin-panel-toolbar">
        <h3>
          Book Inventory (
          {visibleBooks.length}
          {visibleBooks.length !== books.length
            ? ` of ${books.length}`
            : ''}
          )
        </h3>

        <div className="admin-books-tools">
          <input
            type="search"
            placeholder="Search stock..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />

          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
          >
            <option value="All">All categories</option>

            {categoryOptions.map((category) => (
              <option
                key={category.category_id}
                value={category.category_name}
              >
                {category.category_name}
              </option>
            ))}
          </select>
        </div>

        <button
          className={`admin-primary-btn ${
            showCreateForm ? 'cancel' : ''
          }`}
          onClick={() => {
            setEditingId(null);
            setShowCreateForm(!showCreateForm);
          }}
        >
          {showCreateForm ? 'Cancel' : '+ Add New Book'}
        </button>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="admin-form-card"
        >
          <BookFormFields
            form={createForm}
            setForm={setCreateForm}
            categories={categoryOptions}
            onAddCategory={handleAddCategory}
          />

          <div className="admin-form-actions">
            <button type="submit" className="btn-save">
              Create Book
            </button>
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
            <tr>
              <td colSpan={6} className="admin-empty-row">
                No books found.
              </td>
            </tr>
          ) : (
            visibleBooks.map((book) =>
              editingId === book.book_id ? (
                <tr key={book.book_id}>
                  <td colSpan={6} className="edit-row-cell">
                    <form
                      onSubmit={(e) =>
                        handleEditSubmit(e, book.book_id)
                      }
                    >
                      <BookFormFields
                        form={editForm}
                        setForm={setEditForm}
                        categories={categoryOptions}
                        onAddCategory={handleAddCategory}
                      />

                      <div className="admin-form-actions">
                        <button type="submit" className="btn-save">
                          Save Changes
                        </button>

                        <button
                          type="button"
                          className="btn-cancel"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
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
                        src={
                          book.cover_url.startsWith('http')
                            ? book.cover_url
                            : `http://localhost:3000${book.cover_url}`
                        }
                        alt={book.title}
                      />
                    )}
                  </td>

                  <td>{book.book_id}</td>

                  <td className="admin-cell-title">
                    {book.title}
                  </td>

                  <td>
                    Tk {Number(book.price).toFixed(2)}
                  </td>

                  <td>
                    <span
                      className={`admin-stock-pill ${
                        stockPillClass(book.stock_quantity)
                      }`}
                    >
                      {book.stock_quantity} in stock
                    </span>
                  </td>

                  <td>
                    <div className="admin-actions-cell">
                      <button
                        className="admin-icon-btn"
                        onClick={() => startEdit(book)}
                      >
                        Edit
                      </button>

                      <button
                        className="admin-icon-btn danger"
                        onClick={() =>
                          handleDelete(
                            book.book_id,
                            book.title
                          )
                        }
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


function BookFormFields({ form, setForm, categories, onAddCategory }) {
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const selectedCategoryNames = (form.category_ids || [])
    .map((categoryId) => categories.find((category) => String(category.category_id) === String(categoryId))?.category_name)
    .filter(Boolean);

  const toggleCategory = (categoryId) => {
    const current = new Set(form.category_ids || []);
    const categoryKey = String(categoryId);

    if (current.has(categoryKey)) {
      current.delete(categoryKey);
    } else {
      current.add(categoryKey);
    }

    setForm({
      ...form,
      category_ids: [...current]
    });
  };

  const handleAddNewCategory = async () => {
    if (!onAddCategory) return;
    await onAddCategory(newCategoryName);
    setNewCategoryName('');
    setShowCategoryPicker(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const previewUrl = URL.createObjectURL(file);

    setForm({
      ...form,
      cover_file: file,
      cover_preview: previewUrl,
      cover_url: ''
    });
  };

  return (
    <div className="admin-form-grid">
      <div style={{ gridColumn: '1 / -1' }}>
        <input
          placeholder="Title"
          required
          value={form.title}
          onChange={(e) =>
            setForm({
              ...form,
              title: e.target.value
            })
          }
          style={{ width: '100%' }}
        />
      </div>

      <input
        placeholder="ISBN"
        value={form.isbn}
        onChange={(e) =>
          setForm({
            ...form,
            isbn: e.target.value
          })
        }
      />

      <input
        placeholder="Publisher"
        value={form.publisher_name}
        onChange={(e) =>
          setForm({
            ...form,
            publisher_name: e.target.value
          })
        }
      />

      <input
        placeholder="Authors"
        value={form.author_names}
        onChange={(e) =>
          setForm({
            ...form,
            author_names: e.target.value
          })
        }
      />

      <input
        placeholder="Price"
        type="number"
        step="0.01"
        required
        value={form.price}
        onChange={(e) =>
          setForm({
            ...form,
            price: e.target.value
          })
        }
      />

      <input
        placeholder="Stock Qty"
        type="number"
        required
        value={form.stock_quantity}
        onChange={(e) =>
          setForm({
            ...form,
            stock_quantity: e.target.value
          })
        }
      />

      <input
        placeholder="Pub. Year"
        type="number"
        value={form.publication_year}
        onChange={(e) =>
          setForm({
            ...form,
            publication_year: e.target.value
          })
        }
      />

      <div className="admin-category-picker">
        <button
          type="button"
          className="admin-icon-btn admin-category-picker-trigger"
          onClick={() => setShowCategoryPicker((value) => !value)}
        >
          {selectedCategoryNames.length > 0
            ? `Choose Categories (${selectedCategoryNames.length})`
            : 'Choose Categories'}
        </button>

        {showCategoryPicker && (
          <div className="admin-category-picker-menu">
            {categories.map((category) => {
              const checked = (form.category_ids || []).includes(String(category.category_id));

              return (
                <label
                  key={category.category_id}
                  className="admin-category-option"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(category.category_id)}
                  />
                  <span>{category.category_name}</span>
                </label>
              );
            })}

            <div className="admin-category-create-row">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Create new category"
              />
              <button type="button" className="admin-icon-btn" onClick={handleAddNewCategory}>
                Add
              </button>
            </div>
          </div>
        )}

        {selectedCategoryNames.length > 0 && (
          <div className="admin-selected-categories">
            {selectedCategoryNames.map((categoryName) => (
              <span key={categoryName} className="admin-selected-category-pill">
                {categoryName}
              </span>
            ))}
          </div>
        )}
      </div>

      <textarea
        placeholder="Description"
        value={form.description}
        onChange={(e) =>
          setForm({
            ...form,
            description: e.target.value
          })
        }
        rows={4}
        style={{ gridColumn: '1 / -1' }}
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
            src={
              form.cover_preview ||
              (form.cover_url.startsWith('http')
                ? form.cover_url
                : `http://localhost:3000${form.cover_url}`)
            }
            alt="Cover preview"
          />

          <span>
            {form.cover_file
              ? form.cover_file.name
              : 'Current cover'}
          </span>
        </div>
      )}
    </div>
  );
}


/* ==========================================================================
   ORDERS TAB — status flow
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

  const [assignForm, setAssignForm] = useState({
    deliveryman_id: '',
    shipping_method: '',
    tracking_number: ''
  });

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

      setDeliverymen(
        (Array.isArray(data) ? data : [])
          .filter((d) => d.is_active)
      );
    } catch (err) {
      console.error('Failed to load deliverymen:', err);
    }
  };

  useEffect(() => {
    loadOrders();
    loadDeliverymen();
  }, []);

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

      setDetailCache((previous) => ({
        ...previous,
        [orderId]: detail
      }));
    } catch (err) {
      setDetailCache((previous) => ({
        ...previous,
        [orderId]: {
          error: err.message
        }
      }));
    } finally {
      setDetailLoadingId(null);
    }
  };

  const startAssign = (order) => {
    setAssigningId(order.order_id);

    setAssignForm({
      deliveryman_id:
        deliverymen[0]?.deliveryman_id || '',
      shipping_method: 'Standard Delivery',
      tracking_number: ''
    });
  };

  const submitAssign = async (e, orderId) => {
    e.preventDefault();

    if (!assignForm.deliveryman_id) {
      return alert('Please choose a deliveryman');
    }

    try {
      await api.shipOrder(orderId, assignForm);

      setAssigningId(null);
      loadOrders();
    } catch (err) {
      alert(err.message || 'Failed to assign delivery');
    }
  };

  const handleDeliveryStatusChange = async (
    order,
    newStatus
  ) => {
    try {
      await api.updateDeliveryStatus(
        order.delivery_id,
        newStatus
      );

      loadOrders();
    } catch (err) {
      alert(
        err.message ||
        'Failed to update delivery status'
      );
    }
  };

  if (loading) {
    return (
      <p className="admin-state-msg">
        Loading orders...
      </p>
    );
  }

  if (error) {
    return (
      <p className="admin-state-msg error">
        {error}
      </p>
    );
  }

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
          </tr>
        </thead>

        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="admin-empty-row"
              >
                No orders found.
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <Fragment key={order.order_id}>
                <tr
                  className="admin-order-row"
                  onClick={() =>
                    toggleOrderDetails(order.order_id)
                  }
                >
                  <td>#{order.order_id}</td>

                  <td>
                    <div className="admin-cell-title">
                      {order.username}
                    </div>

                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: '#8c827a'
                      }}
                    >
                      {order.email}
                    </div>
                  </td>

                  <td>
                    Tk {Number(order.total_amount).toFixed(2)}
                  </td>

                  <td>
                    {order.status === 'cancelled' ? (
                      <span
                        style={{
                          color: '#8c827a',
                          fontSize: '0.8rem'
                        }}
                      >
                        —
                      </span>
                    ) : (
                      <span
                        className={`admin-stock-pill ${
                          order.payment_status === 'paid'
                            ? 'ok'
                            : order.payment_status === 'partial_refund'
                            ? 'low'
                            : order.payment_status === 'refunded'
                            ? 'out'
                            : 'low'
                        }`}
                      >
                        {order.payment_status === 'partial_refund' ? 'Partial Refund' : order.payment_status === 'refunded' ? 'Refunded' : order.payment_status}
                      </span>
                    )}
                  </td>

                  <td>
                    {['shipped', 'delivered', 'cancelled'].includes(
                      order.status
                    ) ? (
                      <span
                        className="admin-status-select"
                        style={{
                          display: 'inline-block',
                          cursor: 'default'
                        }}
                      >
                        {order.status}
                      </span>
                    ) : (
                      <select
                        className="admin-status-select"
                        value={order.status}
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                        onChange={(e) =>
                          handleStatusChange(
                            order.order_id,
                            e.target.value
                          )
                        }
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>

                  <td>
                    {['confirmed', 'processing'].includes(
                      order.status
                    ) &&
                      (
                        order.payment_status === 'paid' ||
                        order.payment_method ===
                          'cash_on_delivery'
                      ) && (
                        <button
                          className="admin-icon-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            startAssign(order);
                          }}
                        >
                          Assign Delivery
                        </button>
                      )}

                    {order.status === 'pending' && (
                      <span
                        style={{
                          fontSize: '0.78rem',
                          color: '#8c827a'
                        }}
                      >
                        Awaiting payment
                      </span>
                    )}
                  </td>
                </tr>

                {expandedId === order.order_id && (
                  <tr>
                    <td
                      colSpan={5}
                      className="admin-order-detail-cell"
                      onClick={(event) =>
                        event.stopPropagation()
                      }
                    >
                      {detailLoadingId ===
                        order.order_id && (
                        <p>
                          Loading order details...
                        </p>
                      )}

                      {detailCache[order.order_id]
                        ?.error && (
                        <p className="admin-state-msg error">
                          {
                            detailCache[order.order_id]
                              .error
                          }
                        </p>
                      )}

                      {detailCache[order.order_id] &&
                        !detailCache[order.order_id]
                          .error && (
                          <div className="admin-order-detail">
                            <p>
                              <strong>
                                Payment method:
                              </strong>{' '}
                              {formatPaymentMethod(
                                detailCache[
                                  order.order_id
                                ].order.payment_method
                              )}
                            </p>

                            <p>
                              <strong>
                                Shipping address:
                              </strong>{' '}
                              {[
                                detailCache[
                                  order.order_id
                                ].order
                                  .shipping_house_no,
                                detailCache[
                                  order.order_id
                                ].order
                                  .shipping_street,
                                detailCache[
                                  order.order_id
                                ].order
                                  .shipping_city,
                                detailCache[
                                  order.order_id
                                ].order
                                  .shipping_country
                              ]
                                .filter(Boolean)
                                .join(', ') ||
                                'Not provided'}
                            </p>

                            <h4>Items</h4>

                            {detailCache[
                              order.order_id
                            ].items.map((item) => (
                              <div
                                className="admin-order-item"
                                key={item.order_item_id}
                              >
                                <span>
                                  {item.title}
                                </span>

                                <span>
                                  × {item.quantity}
                                </span>

                                <span>
                                  Tk{' '}
                                  {Number(
                                    item.unit_price
                                  ).toFixed(2)}
                                </span>
                              </div>
                            ))}

                            {detailCache[
                              order.order_id
                            ].delivery && (
                              <p>
                                <strong>
                                  Delivery:
                                </strong>{' '}
                                {detailCache[
                                  order.order_id
                                ].delivery
                                  .deliveryman_name ||
                                  'Unassigned'}

                                {detailCache[
                                  order.order_id
                                ].delivery
                                  .tracking_number
                                  ? ` · ${
                                      detailCache[
                                        order.order_id
                                      ].delivery
                                        .tracking_number
                                    }`
                                  : ''}
                              </p>
                            )}
                          </div>
                        )}
                    </td>
                  </tr>
                )}

                {assigningId === order.order_id && (
                  <tr>
                    <td
                      colSpan={6}
                      className="edit-row-cell"
                    >
                      <form
                        onSubmit={(e) =>
                          submitAssign(
                            e,
                            order.order_id
                          )
                        }
                        className="admin-form-grid"
                        style={{
                          gridTemplateColumns:
                            'repeat(3, 1fr)'
                        }}
                      >
                        <select
                          value={
                            assignForm.deliveryman_id
                          }
                          onChange={(e) =>
                            setAssignForm({
                              ...assignForm,
                              deliveryman_id:
                                e.target.value
                            })
                          }
                          required
                        >
                          <option
                            value=""
                            disabled
                          >
                            Select deliveryman
                          </option>

                          {deliverymen.map((d) => (
                            <option
                              key={d.deliveryman_id}
                              value={d.deliveryman_id}
                            >
                              {d.name} ({d.phone})
                            </option>
                          ))}
                        </select>

                        <input
                          placeholder="Shipping method"
                          value={
                            assignForm.shipping_method
                          }
                          onChange={(e) =>
                            setAssignForm({
                              ...assignForm,
                              shipping_method:
                                e.target.value
                            })
                          }
                        />

                        <input
                          placeholder="Tracking # (optional, auto-generated if blank)"
                          value={
                            assignForm.tracking_number
                          }
                          onChange={(e) =>
                            setAssignForm({
                              ...assignForm,
                              tracking_number:
                                e.target.value
                            })
                          }
                        />

                        <div className="admin-form-actions">
                          <button
                            type="submit"
                            className="btn-save"
                          >
                            Confirm &amp; Ship
                          </button>

                          <button
                            type="button"
                            className="btn-cancel"
                            onClick={() =>
                              setAssigningId(null)
                            }
                          >
                            Cancel
                          </button>
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
   RETURNS TAB
   ========================================================================== */

function ReturnsTab() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolving, setResolving] = useState({}); // { return_id: 'resellable'|'damaged' }
  const [expandedReturn, setExpandedReturn] = useState(null); // return_id

  const load = async () => {
    try {
      setLoading(true);

      const data = await api.getAdminReturns();

      setReturns(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      console.error('Failed to load returns:', err);
      setError(
        err.message || 'Failed to load returns.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resolve = async (returnId, decision, condition) => {
    try {
      await api.resolveReturn(returnId, decision, condition);
      load();
    } catch (err) {
      alert(
        err.message ||
        'Failed to update return'
      );
    }
  };

  const toggleExpand = (returnId) => {
    setExpandedReturn(prev => prev === returnId ? null : returnId);
  };

  if (loading) {
    return (
      <p className="admin-state-msg">
        Loading returns...
      </p>
    );
  }

  if (error) {
    return (
      <p className="admin-state-msg error">
        {error}
      </p>
    );
  }

  return (
    <div>
      <div className="admin-panel-toolbar">
        <h3>
          Return Requests ({returns.length})
        </h3>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Book</th>
            <th>Qty</th>
            <th>Refund</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Resolved</th>
          </tr>
        </thead>

        <tbody>
          {returns.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="admin-empty-row"
              >
                No return requests.
              </td>
            </tr>
          ) : (
            returns.map((r) => (
              <>
                <tr key={r.return_id} onClick={() => toggleExpand(r.return_id)} style={{ cursor: 'pointer' }}>
                  <td>#{r.order_id}</td>

                  <td>
                    <div className="admin-cell-title">
                      {r.username}
                    </div>

                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: '#8c827a'
                      }}
                    >
                      {r.email}
                    </div>
                  </td>

                  <td>{r.title}</td>
                  <td>{r.quantity}</td>
                  <td>Tk {Number(r.refund_amount).toFixed(2)}</td>

                  <td>
                    <div className="return-reason-cell" title={r.reason} onClick={(e) => e.stopPropagation()}>
                      {r.reason}
                    </div>
                  </td>

                  <td>
                    <span
                      className={`admin-stock-pill ${
                        r.status === 'approved'
                          ? 'ok'
                          : r.status === 'rejected'
                          ? 'out'
                          : 'low'
                      }`}
                    >
                      {r.status}
                      {r.condition && <span> ({r.condition})</span>}
                    </span>
                  </td>

                  <td>
                    {r.status === 'requested' ? (
                      <div className="admin-actions-cell">
                        <select
                          value={resolving[r.return_id] || ''}
                          onChange={(e) => setResolving(prev => ({ ...prev, [r.return_id]: e.target.value }))}
                          className="admin-select"
                        >
                          <option value="" disabled>Approve as...</option>
                          <option value="resellable">Resellable (restock)</option>
                          <option value="damaged">Damaged (write off)</option>
                        </select>
                        <button
                          className="admin-icon-btn"
                          onClick={() => {
                            const condition = resolving[r.return_id];
                            if (condition) {
                              resolve(r.return_id, 'approved', condition);
                              setResolving(prev => ({ ...prev, [r.return_id]: '' }));
                            }
                          }}
                          disabled={!resolving[r.return_id]}
                        >
                          Approve
                        </button>
                        <button
                          className="admin-icon-btn danger"
                          onClick={(e) => { e.stopPropagation(); resolve(r.return_id, 'rejected', null); }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.78rem',
                          color: '#8c827a'
                        }}
                      >
                        {r.resolved_at
                          ? new Date(
                              r.resolved_at
                            ).toLocaleDateString()
                          : '—'}
                      </span>
                    )}
                  </td>
                </tr>
                {expandedReturn === r.return_id && (
                  <tr>
                    <td colSpan={8}>
                      <div className="return-expanded-detail">
                        <div className="return-detail-row">
                          <strong>Full Reason:</strong>
                          <p>{r.reason}</p>
                        </div>
                        <div className="return-detail-row">
                          <strong>Requested At:</strong>
                          <span>{r.requested_at ? new Date(r.requested_at).toLocaleString() : '—'}</span>
                        </div>
                        <div className="return-detail-row">
                          <strong>Order ID:</strong>
                          <span>#{r.order_id}</span>
                        </div>
                        <div className="return-detail-row">
                          <strong>Customer:</strong>
                          <span>{r.username} ({r.email})</span>
                        </div>
                        <div className="return-detail-row">
                          <strong>Book:</strong>
                          <span>{r.title} × {r.quantity}</span>
                        </div>
                        <div className="return-detail-row">
                          <strong>Refund Amount:</strong>
                          <span>Tk {Number(r.refund_amount).toFixed(2)}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}


/* ==========================================================================
   DELIVERYMEN TAB
   ========================================================================== */

const EMPTY_RIDER_FORM = {
  name: '',
  phone: '',
  vehicle_type: '',
  email: '',
  is_active: true
};

function DeliverymenTab() {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [createForm, setCreateForm] =
    useState(EMPTY_RIDER_FORM);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] =
    useState(EMPTY_RIDER_FORM);

  const loadRiders = async () => {
    try {
      setLoading(true);

      const data = await api.getDeliverymen();

      setRiders(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      console.error(
        'Failed to load deliverymen:',
        err
      );

      setError(
        err.message ||
        'Failed to load deliverymen.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRiders();
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    try {
      await api.createDeliveryman(createForm);

      setCreateForm(EMPTY_RIDER_FORM);
      setShowCreateForm(false);

      loadRiders();
    } catch (err) {
      alert(
        err.message ||
        'Failed to add deliveryman'
      );
    }
  };

  const startEdit = (rider) => {
    setShowCreateForm(false);
    setEditingId(rider.deliveryman_id);

    setEditForm({
      name: rider.name,
      phone: rider.phone,
      vehicle_type: rider.vehicle_type || '',
      email: rider.email || '',
      is_active: rider.is_active
    });
  };

  const handleEditSubmit = async (e, id) => {
    e.preventDefault();

    try {
      await api.updateDeliveryman(id, editForm);

      setEditingId(null);
      loadRiders();
    } catch (err) {
      alert(
        err.message ||
        'Failed to update deliveryman'
      );
    }
  };

  const handleDelete = async (id, name) => {
    if (
      !window.confirm(
        `Remove "${name}" from the delivery team?`
      )
    ) {
      return;
    }

    try {
      await api.deleteDeliveryman(id);
      loadRiders();
    } catch (err) {
      alert(
        err.message ||
        'Failed to remove deliveryman'
      );
    }
  };

  if (loading) {
    return (
      <p className="admin-state-msg">
        Loading deliverymen...
      </p>
    );
  }

  if (error) {
    return (
      <p className="admin-state-msg error">
        {error}
      </p>
    );
  }

  return (
    <div>
      <div className="admin-panel-toolbar">
        <h3>
          Delivery Team ({riders.length})
        </h3>

        <button
          className={`admin-primary-btn ${
            showCreateForm ? 'cancel' : ''
          }`}
          onClick={() => {
            setEditingId(null);
            setShowCreateForm(!showCreateForm);
          }}
        >
          {showCreateForm
            ? 'Cancel'
            : '+ Add Deliveryman'}
        </button>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="admin-form-card"
        >
          <div
            className="admin-form-grid"
            style={{
              gridTemplateColumns:
                'repeat(4, 1fr)'
            }}
          >
            <input
              placeholder="Full Name"
              required
              value={createForm.name}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  name: e.target.value
                })
              }
            />

            <input
              placeholder="Phone"
              required
              value={createForm.phone}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  phone: e.target.value
                })
              }
            />

            <input
              type="email"
              placeholder="Email"
              required
              value={createForm.email}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  email: e.target.value
                })
              }
            />

            <input
              placeholder="Vehicle (e.g. Motorbike)"
              value={createForm.vehicle_type}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  vehicle_type: e.target.value
                })
              }
            />
          </div>

          <p
            style={{
              fontSize: '0.8rem',
              color: '#8c827a',
              marginTop: 6
            }}
          >
            An email will be sent to this address with
            a link for the deliveryman to set their own
            username and password.
          </p>

          <div className="admin-form-actions">
            <button
              type="submit"
              className="btn-save"
            >
              Add Deliveryman
            </button>
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
            <tr>
              <td
                colSpan={6}
                className="admin-empty-row"
              >
                No deliverymen yet.
              </td>
            </tr>
          ) : (
            riders.map((rider) =>
              editingId === rider.deliveryman_id ? (
                <tr key={rider.deliveryman_id}>
                  <td
                    colSpan={6}
                    className="edit-row-cell"
                  >
                    <form
                      onSubmit={(e) =>
                        handleEditSubmit(
                          e,
                          rider.deliveryman_id
                        )
                      }
                    >
                      <div
                        className="admin-form-grid"
                        style={{
                          gridTemplateColumns:
                            'repeat(4, 1fr)'
                        }}
                      >
                        <input
                          placeholder="Full Name"
                          required
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              name: e.target.value
                            })
                          }
                        />

                        <input
                          placeholder="Phone"
                          required
                          value={editForm.phone}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              phone: e.target.value
                            })
                          }
                        />

                        <input
                          placeholder="Vehicle"
                          value={
                            editForm.vehicle_type
                          }
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              vehicle_type:
                                e.target.value
                            })
                          }
                        />

                        <select
                          value={
                            editForm.is_active
                              ? 'active'
                              : 'inactive'
                          }
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              is_active:
                                e.target.value ===
                                'active'
                            })
                          }
                        >
                          <option value="active">
                            Active
                          </option>

                          <option value="inactive">
                            Inactive
                          </option>
                        </select>
                      </div>

                      <div className="admin-form-actions">
                        <button
                          type="submit"
                          className="btn-save"
                        >
                          Save Changes
                        </button>

                        <button
                          type="button"
                          className="btn-cancel"
                          onClick={() =>
                            setEditingId(null)
                          }
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={rider.deliveryman_id}>
                  <td>
                    {rider.deliveryman_id}
                  </td>

                  <td className="admin-cell-title">
                    {rider.name}
                  </td>

                  <td>{rider.phone}</td>

                  <td>
                    {rider.vehicle_type || '—'}
                  </td>

                  <td>
                    {rider.invite_pending ? (
                      <span className="admin-stock-pill low">
                        Pending Setup
                      </span>
                    ) : (
                      <span
                        className={`admin-stock-pill ${
                          rider.is_active
                            ? 'ok'
                            : 'out'
                        }`}
                      >
                        {rider.is_active
                          ? 'Active'
                          : 'Inactive'}
                      </span>
                    )}
                  </td>

                  <td>
                    <div className="admin-actions-cell">
                      <button
                        className="admin-icon-btn"
                        onClick={() =>
                          startEdit(rider)
                        }
                      >
                        Edit
                      </button>

                      <button
                        className="admin-icon-btn danger"
                        onClick={() =>
                          handleDelete(
                            rider.deliveryman_id,
                            rider.name
                          )
                        }
                      >
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
   COUPONS TAB
   ========================================================================== */

const EMPTY_COUPON_FORM = {
  code: '',
  discount_percent: '',
  expiry_date: '',
  min_order_amount: '',
  max_discount: '',
  usage_limit: '', // blank = unlimited
  is_active: true,
};

function CouponsTab() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_COUPON_FORM);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_COUPON_FORM);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminCoupons();
      setCoupons(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      console.error('Failed to load coupons:', err);
      setError(err.message || 'Failed to load coupons.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCoupons(); }, []);

  const buildPayload = (form) => ({
    code: form.code.trim().toUpperCase(),
    discount_percent: Number(form.discount_percent),
    expiry_date: form.expiry_date || null,
    min_order_amount: form.min_order_amount === '' ? 0 : Number(form.min_order_amount),
    max_discount: form.max_discount === '' ? null : Number(form.max_discount),
    usage_limit: form.usage_limit === '' ? null : Number(form.usage_limit),
    is_active: form.is_active,
  });

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createCoupon(buildPayload(createForm));
      setCreateForm(EMPTY_COUPON_FORM);
      setShowCreateForm(false);
      loadCoupons();
    } catch (err) {
      alert(err.message || 'Failed to create coupon');
    }
  };

  const startEdit = (coupon) => {
    setShowCreateForm(false);
    setEditingId(coupon.coupon_id);
    setEditForm({
      code: coupon.code,
      discount_percent: coupon.discount_percent,
      expiry_date: coupon.expiry_date ? coupon.expiry_date.slice(0, 10) : '',
      min_order_amount: coupon.min_order_amount ?? '',
      max_discount: coupon.max_discount ?? '',
      usage_limit: coupon.usage_limit ?? '',
      is_active: coupon.is_active,
    });
  };

  const handleEditSubmit = async (e, id) => {
    e.preventDefault();
    try {
      // code is immutable after creation to avoid confusing anyone who
      // already has the old code — only the terms/limits get updated.
      const { code, ...rest } = buildPayload(editForm);
      await api.updateCoupon(id, rest);
      setEditingId(null);
      loadCoupons();
    } catch (err) {
      alert(err.message || 'Failed to update coupon');
    }
  };

  const handleDelete = async (id, code) => {
    if (!window.confirm(`Delete coupon "${code}"?`)) return;
    try {
      await api.deleteCoupon(id);
      loadCoupons();
    } catch (err) {
      alert(err.message || 'Failed to delete coupon');
    }
  };

  if (loading) return <p className="admin-state-msg">Loading coupons...</p>;
  if (error) return <p className="admin-state-msg error">{error}</p>;

  return (
    <div>
      <div className="admin-panel-toolbar">
        <h3>Coupons ({coupons.length})</h3>
        <button
          className={`admin-primary-btn ${showCreateForm ? 'cancel' : ''}`}
          onClick={() => { setEditingId(null); setShowCreateForm(!showCreateForm); }}
        >
          {showCreateForm ? 'Cancel' : '+ Add Coupon'}
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreateSubmit} className="admin-form-card">
          <CouponFormFields form={createForm} setForm={setCreateForm} codeEditable />
          <p style={{ fontSize: '0.8rem', color: '#8c827a', marginTop: 6 }}>
            Every current customer will get an in-app notification and an email about this coupon as soon as it's created.
          </p>
          <div className="admin-form-actions">
            <button type="submit" className="btn-save">Create Coupon</button>
          </div>
        </form>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Discount</th>
            <th>Min. Order</th>
            <th>Expiry</th>
            <th>Usage</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {coupons.length === 0 ? (
            <tr><td colSpan={7} className="admin-empty-row">No coupons yet.</td></tr>
          ) : (
            coupons.map((c) =>
              editingId === c.coupon_id ? (
                <tr key={c.coupon_id}>
                  <td colSpan={7} className="edit-row-cell">
                    <form onSubmit={(e) => handleEditSubmit(e, c.coupon_id)}>
                      <CouponFormFields form={editForm} setForm={setEditForm} codeEditable={false} />
                      <div className="admin-form-actions">
                        <button type="submit" className="btn-save">Save Changes</button>
                        <button type="button" className="btn-cancel" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={c.coupon_id}>
                  <td className="admin-cell-title">{c.code}</td>
                  <td>{Number(c.discount_percent)}%{c.max_discount ? ` (max Tk ${Number(c.max_discount).toFixed(2)})` : ''}</td>
                  <td>{Number(c.min_order_amount) > 0 ? `Tk ${Number(c.min_order_amount).toFixed(2)}` : '—'}</td>
                  <td>{c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : 'No expiry'}</td>
                  <td>
                    {c.usage_limit
                      ? `${c.times_used} / ${c.usage_limit}`
                      : `${c.times_used} (unlimited)`}
                  </td>
                  <td>
                    <span className={`admin-stock-pill ${c.is_active ? 'ok' : 'out'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions-cell">
                      <button className="admin-icon-btn" onClick={() => startEdit(c)}>Edit</button>
                      <button className="admin-icon-btn danger" onClick={() => handleDelete(c.coupon_id, c.code)}>Delete</button>
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

function CouponFormFields({ form, setForm, codeEditable }) {
  return (
    <div className="admin-form-grid">
      <input
        placeholder="Code (e.g. WELCOME10)"
        required
        disabled={!codeEditable}
        value={form.code}
        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
      />
      <input
        placeholder="Discount % "
        type="number" min="1" max="100" step="0.01"
        required
        value={form.discount_percent}
        onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
      />
      <input
        placeholder="Min. order amount (optional)"
        type="number" min="0" step="0.01"
        value={form.min_order_amount}
        onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
      />
      <input
        placeholder="Max discount cap (optional)"
        type="number" min="0" step="0.01"
        value={form.max_discount}
        onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
      />
      <input
        placeholder="Expiry date (optional)"
        type="date"
        value={form.expiry_date}
        onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
      />
      <input
        placeholder="Usage limit (blank = unlimited)"
        type="number" min="1" step="1"
        value={form.usage_limit}
        onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
      />
      <select
        value={form.is_active ? 'active' : 'inactive'}
        onChange={(e) => setForm({ ...form, is_active: e.target.value === 'active' })}
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </div>
  );
}
/* ==========================================================================
   USERS TAB — Create Admin: Name + Email only
   ========================================================================== */

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] =
    useState(false);

  // CHANGED:
  // username + password removed
  // name added
  const [createForm, setCreateForm] =
    useState({
      name: '',
      email: ''
    });

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      try {
        setLoading(true);

        const data = await api.getAdminUsers();

        if (isMounted) {
          setUsers(
            Array.isArray(data) ? data : []
          );
        }
      } catch (err) {
        console.error(
          'Failed to load users:',
          err
        );

        if (isMounted) {
          setError(
            err.message ||
            'Failed to load users.'
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <p className="admin-state-msg">
        Loading users...
      </p>
    );
  }

  if (error) {
    return (
      <p className="admin-state-msg error">
        {error}
      </p>
    );
  }

  const handleCreateAdmin = async (event) => {
    event.preventDefault();

    try {
      // Sends only:
      // {
      //   name: "...",
      //   email: "..."
      // }
      await api.createAdmin(createForm);

      setCreateForm({
        name: '',
        email: ''
      });

      setShowCreateForm(false);

      window.location.reload();
    } catch (err) {
      alert(
        err.message ||
        'Failed to create admin'
      );
    }
  };

  return (
    <div>
      <div className="admin-panel-toolbar">
        <h3>
          Registered Users ({users.length})
        </h3>

        <button
          className={`admin-primary-btn ${
            showCreateForm ? 'cancel' : ''
          }`}
          onClick={() =>
            setShowCreateForm(!showCreateForm)
          }
        >
          {showCreateForm
            ? 'Cancel'
            : '+ Create Admin'}
        </button>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreateAdmin}
          className="admin-form-card"
        >
          <div className="admin-form-grid">

            {/* NAME — instead of username */}
            <input
              placeholder="Full Name"
              required
              value={createForm.name}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  name: event.target.value
                })
              }
            />

            {/* EMAIL */}
            <input
              type="email"
              pattern="[^\s@]+@[^\s@]+\.[A-Za-z]{2,}"
              title="Enter an email address with a valid domain"
              placeholder="Email"
              required
              value={createForm.email}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  email: event.target.value
                })
              }
            />

          </div>

          <div className="admin-form-actions">
            <button
              type="submit"
              className="btn-save"
            >
              Create Admin
            </button>
          </div>
        </form>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>City</th>
            <th>Joined</th>
          </tr>
        </thead>

        <tbody>
          {users.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="admin-empty-row"
              >
                No users found.
              </td>
            </tr>
          ) : (
            users.map((u) => (
              <tr key={u.user_id}>
                <td>{u.user_id}</td>

                <td className="admin-cell-title">
                  {u.name || u.username}
                </td>

                <td>{u.email}</td>

                <td>
                  <span
                    className={`admin-role-badge ${u.role}`}
                  >
                    {u.role?.toUpperCase()}
                  </span>
                </td>

                <td>{u.city || '—'}</td>

                <td>
                  {new Date(
                    u.created_at
                  ).toLocaleDateString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}