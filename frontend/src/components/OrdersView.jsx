// src/components/OrdersView.jsx
import { useEffect, useState, useRef } from 'react';
import { api } from '../api';

export default function OrdersView({ customerId, initialOrderId, onCartChanged, onReviewSubmitted, onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(initialOrderId || null);

  // Full detail (items/delivery/can_review) is fetched lazily per order,
  // since GET /orders/customer/:id only returns summary rows.
  const [detailCache, setDetailCache] = useState({}); // { [order_id]: { items, delivery, can_review } }
  const [detailLoadingId, setDetailLoadingId] = useState(null);

  const [reviewTarget, setReviewTarget] = useState(null); // { order_id, book_id, title }
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);

  const highlightRef = useRef(null);

  const loadOrders = async () => {
    if (!customerId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getCustomerOrders(customerId);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  useEffect(() => {
    if (initialOrderId) {
      setExpandedId(initialOrderId);
      loadDetail(initialOrderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrderId]);

  useEffect(() => {
    if (initialOrderId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [initialOrderId, orders]);

  const loadDetail = async (orderId) => {
    if (detailCache[orderId]) return; // already fetched
    setDetailLoadingId(orderId);
    try {
      const data = await api.getOrderDetail(orderId);
      setDetailCache((prev) => ({
        ...prev,
        [orderId]: { items: data.items || [], delivery: data.delivery, can_review: data.can_review },
      }));
    } catch (err) {
      setDetailCache((prev) => ({ ...prev, [orderId]: { items: [], error: err.message } }));
    } finally {
      setDetailLoadingId(null);
    }
  };

  const toggleExpand = (orderId) => {
    const next = expandedId === orderId ? null : orderId;
    setExpandedId(next);
    if (next) loadDetail(next);
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Cancel this order?')) return;
    try {
      const updated = await api.cancelOrder(orderId);
      setOrders((prev) => prev.map((o) => (o.order_id === orderId ? { ...o, ...updated } : o)));
      if (onCartChanged) onCartChanged();
    } catch (err) {
      alert(err.message || 'Failed to cancel order');
    }
  };

  const openReviewForm = (orderId, item) => {
    setReviewTarget({ order_id: orderId, book_id: item.book_id, title: item.title });
    setReviewForm({ rating: 5, comment: '' });
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!reviewTarget) return;
    setSubmittingReview(true);
    try {
      await api.submitReview({
        customer_id: customerId,
        book_id: reviewTarget.book_id,
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment.trim(),
      });
      // mark that item as reviewed locally so the button disappears
      setDetailCache((prev) => {
        const detail = prev[reviewTarget.order_id];
        if (!detail) return prev;
        return {
          ...prev,
          [reviewTarget.order_id]: {
            ...detail,
            items: detail.items.map((it) =>
              it.book_id === reviewTarget.book_id ? { ...it, already_reviewed: true } : it
            ),
          },
        };
      });
      setReviewTarget(null);
      if (onReviewSubmitted) onReviewSubmitted();
    } catch (err) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <main className="orders-page-wrapper">
      <div className="admin-header-row">
        <h2>My Orders</h2>
        <button className="admin-back-btn" onClick={onClose}>← Back to Shop</button>
      </div>

      <div className="orders-page-body">
          {loading && <div className="empty-state">Loading orders...</div>}
          {!loading && error && <div className="empty-state error-text">{error}</div>}
          {!loading && !error && orders.length === 0 && (
            <div className="empty-state">You haven't placed any orders yet.</div>
          )}

          {!loading && !error && orders.map((order) => {
            const isExpanded = expandedId === order.order_id;
            const isHighlighted = initialOrderId === order.order_id;
            const detail = detailCache[order.order_id];
            const status = (order.status || 'pending').toLowerCase();
            const canCancel = ['pending', 'confirmed'].includes(status);

            return (
              <div
                key={order.order_id}
                ref={isHighlighted ? highlightRef : null}
                className={`order-card${isHighlighted ? ' order-highlighted' : ''}`}
              >
                <div className="order-summary-row" onClick={() => toggleExpand(order.order_id)}>
                  <div>
                    <strong>Order #{order.order_id}</strong>
                    <div className="order-meta">
                      {order.order_date ? new Date(order.order_date).toLocaleDateString() : ''}
                      {' · '}
                      <span className={`order-status status-${status}`}>{order.status || 'Pending'}</span>
                      {' · '}
                      <span className={`order-payment status-${order.payment_status}`}>
                        {order.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
                    <div className="order-meta">
                      {order.item_count} item{Number(order.item_count) === 1 ? '' : 's'}
                      {order.delivery_status ? ` · ${order.delivery_status.replace(/_/g, ' ')}` : ''}
                      {order.tracking_number ? ` · Tracking: ${order.tracking_number}` : ''}
                    </div>
                  </div>
                  <div className="order-total">Tk {Number(order.total_amount ?? 0).toFixed(2)}</div>
                </div>

                {isExpanded && (
                  <div className="order-details">
                    {detailLoadingId === order.order_id && <p className="empty-state">Loading items...</p>}

                    {detail && detail.error && (
                      <p className="empty-state error-text">{detail.error}</p>
                    )}

                    {detail && !detail.error && detail.items.length === 0 && (
                      <p className="empty-state">No item details available.</p>
                    )}

                    {detail && !detail.error && detail.items.map((item) => (
                      <div key={item.order_item_id ?? item.book_id} className="order-item-row">
                        <span>{item.title || `Book #${item.book_id}`}</span>
                        <span>× {item.quantity ?? 1}</span>
                        <span>Tk {Number(item.unit_price ?? 0).toFixed(2)}</span>
                        {detail.can_review && !item.already_reviewed && (
                          <button
                            className="btn-link-review"
                            onClick={() => openReviewForm(order.order_id, item)}
                          >
                            Leave a Review
                          </button>
                        )}
                        {item.already_reviewed && <span className="review-done-tag">Reviewed ✓</span>}
                      </div>
                    ))}

                    {detail && detail.delivery && (
                      <p className="order-delivery-note">
                        Rider: {detail.delivery.deliveryman_name || '—'}
                        {detail.delivery.deliveryman_phone ? ` (${detail.delivery.deliveryman_phone})` : ''}
                      </p>
                    )}

                    {canCancel && (
                      <button className="btn-danger-outline" onClick={() => handleCancelOrder(order.order_id)}>
                        Cancel Order
                      </button>
                    )}

                  </div>
                )}
              </div>
            );
          })}
      </div>

        {reviewTarget && (
          <div className="review-modal-overlay" onClick={() => setReviewTarget(null)}>
            <form className="review-modal" onClick={(e) => e.stopPropagation()} onSubmit={submitReview}>
              <h4>Review: {reviewTarget.title}</h4>
              <label>
                Rating
                <select
                  value={reviewForm.rating}
                  onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })}
                >
                  {[5, 4, 3, 2, 1].map((r) => (
                    <option key={r} value={r}>{r} star{r === 1 ? '' : 's'}</option>
                  ))}
                </select>
              </label>
              <label>
                Comment
                <textarea
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                  placeholder="What did you think of this book?"
                  rows={3}
                />
              </label>
              <div className="admin-form-actions">
                <button type="submit" className="btn-save" disabled={submittingReview}>
                  {submittingReview ? 'Submitting…' : 'Submit Review'}
                </button>
                <button type="button" className="btn-cancel" onClick={() => setReviewTarget(null)}>Cancel</button>
              </div>
            </form>
          </div>
        )}
    </main>
  );
}